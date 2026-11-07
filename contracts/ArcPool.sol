// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title Arc Pool USDC
/// @notice ERC-4626 receipts for USDC held idle or lent to fixed external vaults on Arc.
/// @dev Intended for six-decimal, non-rebasing, non-fee-on-transfer USDC on Arc.
///      The external ERC-4626 vault list is fixed at construction and trusted. A vault
///      failure keeps attempted deposits idle or limits exits. Exits are instant only
///      while the idle buffer plus available vault liquidity cover them. Entry is priced
///      at gross value, so newcomers pay for unvested rewards and unharvested vault gains
///      and cannot dilute earlier holders' claim to them. Harvested gains and externally
///      funded rewards stream to holders linearly over vestingPeriod. Commission applies
///      only to addRewards, never to vault yield. Unvested rewards and unharvested gains
///      are excluded from net totalAssets. Exits are priced net and rise to the gross
///      price as the stream vests. By design, previewDeposit may return fewer shares than
///      convertToShares, and previewMint more assets than convertToAssets.
///      If all stakers exit mid-vest, the remaining unvested stream stays in the pool
///      and later depositors pay for it at the gross entry price, so it is effectively
///      forfeited rather than captured. All entry points are nonpayable;
///      native gas balances are never accounted for. With the six-decimal offset,
///      rUSDC has 12 decimals for six-decimal USDC. Direct token donations affect
///      totalAssets but not the rewards counter or fees.
contract ArcPool is ERC4626, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice A required constructor or commission address was zero.
    error ZeroAddress();
    /// @notice Reward funding must be nonzero.
    error ZeroRewardAmount();
    /// @notice Reward funding after commission must be nonzero.
    error ZeroNetRewards();
    /// @notice There must be outstanding receipts before rewards can be added.
    error NoStakers();
    /// @notice The requested reward commission exceeds 20 percent.
    error CommissionTooHigh(uint16 bps);
    /// @notice The vesting period must be between one hour and 30 days, inclusive.
    error InvalidVestingPeriod();
    /// @notice Between one and four external vaults must be supplied.
    error InvalidVaultCount();
    /// @notice An external vault was supplied more than once.
    error DuplicateVault();
    /// @notice An external vault does not use the pool's USDC asset.
    error VaultAssetMismatch();
    /// @notice The idle buffer exceeds 10,000 basis points.
    error BufferTooHigh();
    /// @notice At least one external vault could not be valued.
    error VaultReadFailed();
    /// @notice Idle USDC and successful vault exits do not cover the requested exit.
    error InsufficientLiquidity(uint256 needed, uint256 available);

    /// @notice Emitted when the administrator changes the deposit ceiling.
    event DepositCapUpdated(uint256 previousCap, uint256 newCap);
    /// @notice Emitted when the administrator changes reward commission settings.
    event CommissionUpdated(uint16 bps, address indexed treasury);
    /// @notice Emitted for gross reward funding and its commission in asset units.
    event RewardsAdded(address indexed funder, uint256 amount, uint256 commissionAssets);
    event Harvested(address indexed caller, uint256 gain);
    event Rebalanced(address indexed vault, uint256 assets);
    event VaultWithdrawn(address indexed vault, uint256 assets);
    event LossRealized(uint256 previousDeployed, uint256 newDeployed);

    /// @notice Timestamp at which the pool was created.
    uint256 public immutable launchTime;
    /// @notice Vesting duration used to weight newly funded net rewards.
    uint256 public immutable vestingPeriod;
    /// @notice Unvested USDC recorded when the reward stream was last updated.
    uint256 public lockedAtUpdate;
    /// @notice Start timestamp of the current reward stream.
    uint64 public vestStart;
    /// @notice End timestamp of the current reward stream.
    uint64 public vestEnd;
    /// @notice Gross USDC funded through addRewards, in underlying atomic units.
    uint256 public totalRewardsDistributed;
    /// @notice Ceiling on totalAssets for new deposits; rewards may exceed it.
    uint256 public depositCap = type(uint256).max;
    /// @notice Commission on newly funded rewards, in basis points; initially zero.
    uint16 public commissionBps;
    /// @notice Recipient of reward commission paid directly in USDC; initially unset.
    address public treasury;
    /// @dev Fixed, trusted external vaults; there is no function to modify this list.
    IERC4626[] private _vaults;
    /// @notice Target idle fraction of idle plus deployed assets, in basis points.
    uint16 public immutable bufferBps;
    /// @notice USDC cost basis currently lent, including already-harvested gains.
    uint256 public deployed;
    /// @notice Cumulative vault gains harvested into the reward stream.
    uint256 public totalYieldHarvested;

    /// @param usdc ERC-20 USDC asset; supplied explicitly, not inferred from gas currency.
    /// @param admin Account granted DEFAULT_ADMIN_ROLE.
    /// @param vestingPeriod_ Reward vesting duration, from one hour to 30 days inclusive.
    /// @param vaults_ One to four distinct, trusted ERC-4626 vaults using this USDC.
    /// @param bufferBps_ Target idle reserve, at most 10,000 basis points.
    constructor(
        IERC20 usdc,
        address admin,
        uint256 vestingPeriod_,
        address[] memory vaults_,
        uint16 bufferBps_
    ) ERC20("Arc Pool USDC", "rUSDC") ERC4626(usdc) {
        if (address(usdc) == address(0) || admin == address(0)) revert ZeroAddress();
        if (vestingPeriod_ < 1 hours || vestingPeriod_ > 30 days) revert InvalidVestingPeriod();
        uint256 length = vaults_.length;
        if (length == 0 || length > 4) revert InvalidVaultCount();
        if (bufferBps_ > 10_000) revert BufferTooHigh();
        for (uint256 i; i < length; ++i) {
            address vault = vaults_[i];
            if (vault == address(0)) revert ZeroAddress();
            for (uint256 j; j < i; ++j) {
                if (vaults_[j] == vault) revert DuplicateVault();
            }
            if (IERC4626(vault).asset() != address(usdc)) revert VaultAssetMismatch();
            _vaults.push(IERC4626(vault));
        }
        bufferBps = bufferBps_;
        vestingPeriod = vestingPeriod_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        launchTime = block.timestamp;
    }

    /// @notice USDC rewards remaining unvested, capped at idle plus deployed assets.
    function lockedRewards() public view returns (uint256) {
        return _lockedRewards(idleAssets() + deployed);
    }

    /// @dev All readers use this same cap, including weighted-average vesting updates.
    function _lockedRewards(uint256 backing) internal view returns (uint256) {
        if (block.timestamp >= vestEnd) return 0;
        uint256 locked = Math.mulDiv(lockedAtUpdate, vestEnd - block.timestamp, vestEnd - vestStart);
        return Math.min(locked, backing);
    }

    /// @notice USDC available to receipt holders, excluding unvested rewards.
    /// @dev Unharvested external vault gains are excluded; losses are recognized by
    ///      state-changing entry points when all external vault reads succeed.
    function totalAssets() public view override returns (uint256) {
        uint256 backing = idleAssets() + deployed;
        uint256 locked = _lockedRewards(backing);
        return locked >= backing ? 0 : backing - locked;
    }

    /// @dev Gross backing includes locked rewards and readable unharvested vault gains.
    function _grossAssets() internal view returns (uint256) {
        (bool ok, uint256 value) = _tryVaultValue();
        uint256 pending = ok && value > deployed ? value - deployed : 0;
        return idleAssets() + deployed + pending;
    }

    /// @notice Preview deposit receipts at gross entry value, rounding down.
    /// @dev Newcomers pay for unvested rewards and unharvested vault gains so they cannot
    ///      dilute earlier holders. Exits remain net-priced and rise to the gross price
    ///      as the stream vests. May return fewer shares than convertToShares by design.
    function previewDeposit(uint256 assets) public view override returns (uint256) {
        return Math.mulDiv(
            assets, totalSupply() + 10 ** _decimalsOffset(), _grossAssets() + 1, Math.Rounding.Floor
        );
    }

    /// @notice Preview mint cost at gross entry value, rounding up.
    /// @dev Newcomers pay for unvested rewards and unharvested vault gains so they cannot
    ///      dilute earlier holders. Exits remain net-priced and rise to the gross price
    ///      as the stream vests. May return more assets than convertToAssets by design.
    function previewMint(uint256 shares) public view override returns (uint256) {
        return Math.mulDiv(
            shares, _grossAssets() + 1, totalSupply() + 10 ** _decimalsOffset(), Math.Rounding.Ceil
        );
    }

    /// @notice Remaining deposit capacity, in USDC atomic units, or zero while paused.
    /// @dev Donations and vested rewards also consume capacity. Lowering the cap below
    ///      totalAssets blocks new funding through deposit/mint but never exits.
    function maxDeposit(address) public view override returns (uint256) {
        if (paused()) return 0;
        uint256 assets = totalAssets();
        return assets >= depositCap ? 0 : depositCap - assets;
    }

    /// @notice Maximum receipts mintable within the remaining asset capacity.
    /// @dev Rounds down so previewMint(result) cannot exceed remaining capacity.
    ///      Saturates at uint256.max if the mathematical share limit is larger.
    function maxMint(address receiver) public view override returns (uint256) {
        uint256 capacity = maxDeposit(receiver);
        if (capacity == 0) return 0;

        uint256 numerator = totalSupply() + 10 ** _decimalsOffset();
        uint256 denominator = _grossAssets() + 1;
        if (numerator > denominator) {
            uint256 largestConvertibleAssets = Math.mulDiv(type(uint256).max, denominator, numerator);
            if (capacity > largestConvertibleAssets) return type(uint256).max;
        }
        return Math.mulDiv(capacity, numerator, denominator);
    }

    /// @notice Fund a linear reward stream for receipt holders, even while deposits are paused.
    /// @param amount Gross USDC atomic units to pull from the caller with its allowance.
    /// @dev Commission is paid directly in USDC to the treasury; no shares are minted.
    ///      The duration is the rounded-up, balance-weighted average of the remaining
    ///      duration for locked rewards and vestingPeriod for new net rewards.
    ///      A new reward shifts the unlock deadline in proportion to its size relative
    ///      to the still-locked balance, so dust cannot meaningfully delay existing rewards.
    function addRewards(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroRewardAmount();
        uint256 supply = totalSupply();
        if (supply == 0) revert NoStakers();

        address recipient = treasury;
        uint256 commissionAssets;
        if (commissionBps != 0 && recipient != address(0)) {
            commissionAssets = Math.mulDiv(amount, commissionBps, 10_000);
        }
        uint256 net = amount - commissionAssets;
        if (net == 0) revert ZeroNetRewards();
        // Capture capped existing locks before the incoming reward increases backing.
        _vest(net);

        IERC20(asset()).safeTransferFrom(_msgSender(), address(this), net);
        if (commissionAssets > 0) {
            IERC20(asset()).safeTransferFrom(_msgSender(), recipient, commissionAssets);
        }
        totalRewardsDistributed += amount;

        emit RewardsAdded(_msgSender(), amount, commissionAssets);
    }

    /// @dev Merge new net rewards with the capped remaining linear stream.
    function _vest(uint256 net) internal {
        uint256 currentLocked = lockedRewards();
        uint256 remaining = vestEnd > block.timestamp ? vestEnd - block.timestamp : 0;
        uint256 newDuration = Math.ceilDiv(
            currentLocked * remaining + net * vestingPeriod, currentLocked + net
        );
        lockedAtUpdate = currentLocked + net;
        vestStart = uint64(block.timestamp);
        vestEnd = uint64(block.timestamp + newDuration);
    }

    /// @notice Harvest vault gains without commission and vest them for receipt holders.
    /// @dev Permissionless and allowed while paused. A failed vault read reverts.
    function harvest() external nonReentrant returns (uint256 gain) {
        return _harvest();
    }

    /// @notice Lend excess idle USDC equally across the fixed vault list.
    /// @dev Permissionless and allowed while paused. Failed deposits remain idle;
    ///      allocation dust also stays idle. External vault max* functions are not used.
    function rebalance() external nonReentrant returns (uint256 moved) {
        return _rebalance();
    }

    /// @notice Recall USDC from a fixed vault into the pool's idle balance.
    /// @dev Permissionless and allowed while paused; external vault max* functions are not used.
    ///      Callers can use smaller amounts to free partial liquidity before redeeming
    ///      when vaults are illiquid. Vault exit reverts bubble so callers can retry.
    ///      Outstanding readable gains are vested before recall so they cannot become instantly redeemable.
    /// @param i Fixed vault index; an out-of-range index reverts.
    /// @param assets USDC to recall; uint256.max or at least the position value redeems all shares.
    /// @return got USDC actually received by the pool.
    function recallFromVault(uint256 i, uint256 assets) external nonReentrant returns (uint256 got) {
        IERC4626 vault = _vaults[i];
        _realizeLoss();
        _recognizeGain();
        (bool ok, uint256 have) = _trySingleVaultValue(vault);
        if (!ok) revert VaultReadFailed();
        if (have == 0) return 0;

        IERC20 usdc = IERC20(asset());
        uint256 balanceBefore = usdc.balanceOf(address(this));
        if (assets == type(uint256).max || assets >= have) {
            vault.redeem(vault.balanceOf(address(this)), address(this), address(this));
        } else {
            vault.withdraw(assets, address(this), address(this));
        }
        got = usdc.balanceOf(address(this)) - balanceBefore;
        deployed -= Math.min(got, deployed);
        emit VaultWithdrawn(address(vault), got);
    }

    /// @notice Harvest and then rebalance under one reentrancy guard.
    function sync() external nonReentrant returns (uint256 gain, uint256 moved) {
        gain = _harvest();
        moved = _rebalance();
    }

    function _harvest() internal returns (uint256 gain) {
        (bool ok, uint256 value) = _tryVaultValue();
        if (!ok) revert VaultReadFailed();
        if (value < deployed) {
            uint256 previousDeployed = deployed;
            deployed = value;
            emit LossRealized(previousDeployed, value);
            return 0;
        }
        return _recognizeGain();
    }

    /// @dev Vest readable pending gains; failed reads and losses leave accounting unchanged.
    function _recognizeGain() internal returns (uint256 gain) {
        (bool ok, uint256 value) = _tryVaultValue();
        if (ok && totalSupply() > 0 && value > deployed) {
            gain = value - deployed;
            deployed = value;
            _vest(gain);
            totalYieldHarvested += gain;
            emit Harvested(_msgSender(), gain);
        }
    }

    function _rebalance() internal returns (uint256 moved) {
        _realizeLoss();
        uint256 idle = idleAssets();
        uint256 target = Math.mulDiv(idle + deployed, bufferBps, 10_000);
        if (idle <= target) return 0;
        uint256 per = (idle - target) / _vaults.length;
        if (per == 0) return 0;

        IERC20 usdc = IERC20(asset());
        for (uint256 i; i < _vaults.length; ++i) {
            IERC4626 vault = _vaults[i];
            usdc.forceApprove(address(vault), per);
            uint256 balanceBefore = usdc.balanceOf(address(this));
            try vault.deposit(per, address(this)) returns (uint256) {} catch {}
            usdc.forceApprove(address(vault), 0);
            uint256 spent = balanceBefore - usdc.balanceOf(address(this));
            deployed += spent;
            moved += spent;
            emit Rebalanced(address(vault), spent);
        }
    }

    /// @dev A failed read never causes a markdown, including when other vaults succeed.
    function _realizeLoss() internal {
        (bool ok, uint256 value) = _tryVaultValue();
        if (ok && value < deployed) {
            uint256 previousDeployed = deployed;
            deployed = value;
            emit LossRealized(previousDeployed, value);
        }
    }

    function _tryVaultValue() internal view returns (bool ok, uint256 value) {
        for (uint256 i; i < _vaults.length; ++i) {
            (bool readable, uint256 assets) = _trySingleVaultValue(_vaults[i]);
            if (!readable) return (false, 0);
            value += assets;
        }
        return (true, value);
    }

    function _trySingleVaultValue(IERC4626 vault) internal view returns (bool ok, uint256 value) {
        try vault.balanceOf(address(this)) returns (uint256 shares) {
            try vault.convertToAssets(shares) returns (uint256 assets) {
                return (true, assets);
            } catch {
                return (false, 0);
            }
        } catch {
            return (false, 0);
        }
    }

    /// @notice Number of fixed external vaults.
    function vaultsLength() external view returns (uint256) {
        return _vaults.length;
    }

    /// @notice External vault at an index; an out-of-range index reverts.
    function vaultAt(uint256 i) external view returns (address) {
        return address(_vaults[i]);
    }

    /// @notice Current USDC value in one vault, or zero on a failed vault read.
    function vaultAssets(uint256 i) external view returns (uint256) {
        (bool ok, uint256 value) = _trySingleVaultValue(_vaults[i]);
        return ok ? value : 0;
    }

    /// @notice USDC currently held directly by this pool, including locked rewards.
    function idleAssets() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    /// @notice Unharvested vault gain, or zero if any vault read fails.
    function pendingYield() external view returns (uint256) {
        (bool ok, uint256 value) = _tryVaultValue();
        return ok && value > deployed ? value - deployed : 0;
    }

    /// @notice Amount currently lendable, including allocation rounding and readable losses.
    /// @dev Mirrors rebalance's loss recognition; a failed read leaves cost basis unchanged.
    function rebalanceAmount() external view returns (uint256) {
        (bool ok, uint256 value) = _tryVaultValue();
        uint256 basis = ok && value < deployed ? value : deployed;
        uint256 idle = idleAssets();
        uint256 target = Math.mulDiv(idle + basis, bufferBps, 10_000);
        if (idle <= target) return 0;
        return ((idle - target) / _vaults.length) * _vaults.length;
    }

    /// @notice Recognize readable vault losses before pricing a deposit.
    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        _realizeLoss();
        return super.deposit(assets, receiver);
    }

    /// @notice Recognize readable vault losses before pricing a mint.
    function mint(uint256 shares, address receiver) public override returns (uint256) {
        _realizeLoss();
        return super.mint(shares, receiver);
    }

    /// @notice Recognize readable vault losses before pricing a withdrawal.
    function withdraw(uint256 assets, address receiver, address owner) public override returns (uint256) {
        _realizeLoss();
        return super.withdraw(assets, receiver, owner);
    }

    /// @notice Recognize readable vault losses before pricing a redemption.
    function redeem(uint256 shares, address receiver, address owner) public override returns (uint256) {
        _realizeLoss();
        return super.redeem(shares, receiver, owner);
    }

    /// @dev Use only valuation and exit calls, not external vault max* functions.
    ///      Exits vest outstanding readable gains before pulling vault assets so gains cannot become instantly redeemable.
    function _ensureLiquidity(uint256 assets) internal {
        IERC20 usdc = IERC20(asset());
        _realizeLoss();
        _recognizeGain();
        uint256 idle = usdc.balanceOf(address(this));
        if (idle >= assets) return;
        uint256 need = assets - idle;
        for (uint256 i; i < _vaults.length && need > 0; ++i) {
            IERC4626 vault = _vaults[i];
            uint256 shares;
            try vault.balanceOf(address(this)) returns (uint256 balance) {
                shares = balance;
            } catch {
                continue;
            }
            uint256 have;
            try vault.convertToAssets(shares) returns (uint256 value) {
                have = value;
            } catch {
                continue;
            }
            if (have == 0) continue;
            uint256 balanceBefore = usdc.balanceOf(address(this));
            if (have <= need) {
                try vault.redeem(shares, address(this), address(this)) returns (uint256) {} catch {
                    if (have < 2) continue;
                    try vault.withdraw(have / 2, address(this), address(this)) returns (uint256) {} catch {
                        continue;
                    }
                }
            } else {
                try vault.withdraw(need, address(this), address(this)) returns (uint256) {} catch {
                    if (need < 2) continue;
                    try vault.withdraw(need / 2, address(this), address(this)) returns (uint256) {} catch {
                        continue;
                    }
                }
            }
            uint256 got = usdc.balanceOf(address(this)) - balanceBefore;
            deployed -= Math.min(got, deployed);
            need = got >= need ? 0 : need - got;
            emit VaultWithdrawn(address(vault), got);
        }
        uint256 available = usdc.balanceOf(address(this));
        if (available < assets) revert InsufficientLiquidity(assets, available);
    }

    /// @notice Set the asset ceiling for future deposits and mints.
    /// @dev Zero disables positive deposits. uint256.max is the default ceiling.
    /// @param newCap New cap in USDC atomic units; may be below current totalAssets.
    function setDepositCap(uint256 newCap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 previousCap = depositCap;
        depositCap = newCap;
        emit DepositCapUpdated(previousCap, newCap);
    }

    /// @notice Configure the commission on future addRewards calls only.
    /// @param bps Basis points, at most 2,000 (20 percent).
    /// @param newTreasury USDC commission recipient; required when bps is nonzero.
    function setCommission(uint16 bps, address newTreasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (bps > 2_000) revert CommissionTooHigh(bps);
        if (bps != 0 && newTreasury == address(0)) revert ZeroAddress();
        commissionBps = bps;
        treasury = newTreasury;
        emit CommissionUpdated(bps, newTreasury);
    }

    /// @notice Disable deposits and mints without restricting receipt transfers or exits.
    /// @dev Emits the inherited Paused event.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Re-enable deposits and mints subject to remaining capacity.
    /// @dev Emits the inherited Unpaused event.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice USDC atomic units per whole rUSDC (six USDC decimals for the intended asset).
    function exchangeRate() public view returns (uint256) {
        return convertToAssets(10 ** uint256(decimals()));
    }

    /// @dev Shared guard for both ERC-4626 deposit and mint, including zero amounts.
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
        whenNotPaused
    {
        super._deposit(caller, receiver, assets, shares);
    }

    /// @dev Shared reentrancy protection for withdraw/redeem; deliberately no pause check.
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
        nonReentrant
    {
        _ensureLiquidity(assets);
        super._withdraw(caller, receiver, owner, assets, shares);
    }

    /// @dev Virtual-share offset for ERC-4626 inflation-attack mitigation.
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }
}
