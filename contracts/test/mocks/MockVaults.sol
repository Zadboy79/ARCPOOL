// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {MockUSDC} from "./MockUSDC.sol";

/// @dev ERC-4626 mock with failure/liquidity/yield/loss knobs. The public entry points
///      skip OZ's max* checks (like Morpho VaultV2 whose max* return 0), and
///      withdraw/redeem revert when the assets requested exceed `withdrawLimit`.
abstract contract MockVaultBase is ERC4626 {
    bool public immutable zeroMax;
    uint256 public withdrawLimit = type(uint256).max;
    bool public convertReverts;
    bool public depositReverts;

    constructor(IERC20 asset_, string memory name_, string memory symbol_, bool zeroMax_)
        ERC20(name_, symbol_)
        ERC4626(asset_)
    {
        zeroMax = zeroMax_;
    }

    // ---- test helpers ----
    /// (a) add yield by minting USDC straight into the vault
    function addYield(uint256 amount) external {
        MockUSDC(asset()).mint(address(this), amount);
    }

    /// (b) simulate a loss by burning USDC held by the vault
    function simulateLoss(uint256 amount) external {
        MockUSDC(asset()).burn(address(this), amount);
    }

    /// (c) per-call liquidity cap: withdraw/redeem revert if assets out exceed it
    function setWithdrawLimit(uint256 limit) external {
        withdrawLimit = limit;
    }

    /// (d) make convertToAssets / deposit revert
    function setConvertReverts(bool v) external {
        convertReverts = v;
    }

    function setDepositReverts(bool v) external {
        depositReverts = v;
    }

    // ---- behaviour ----
    function convertToAssets(uint256 shares) public view override returns (uint256) {
        if (convertReverts) revert("convert disabled");
        return super.convertToAssets(shares);
    }

    function maxDeposit(address a) public view override returns (uint256) {
        return zeroMax ? 0 : super.maxDeposit(a);
    }

    function maxMint(address a) public view override returns (uint256) {
        return zeroMax ? 0 : super.maxMint(a);
    }

    function maxWithdraw(address o) public view override returns (uint256) {
        return zeroMax ? 0 : super.maxWithdraw(o);
    }

    function maxRedeem(address o) public view override returns (uint256) {
        return zeroMax ? 0 : super.maxRedeem(o);
    }

    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        if (depositReverts) revert("deposit disabled");
        uint256 shares = previewDeposit(assets);
        _deposit(_msgSender(), receiver, assets, shares);
        return shares;
    }

    function mint(uint256 shares, address receiver) public override returns (uint256) {
        if (depositReverts) revert("deposit disabled");
        uint256 assets = previewMint(shares);
        _deposit(_msgSender(), receiver, assets, shares);
        return assets;
    }

    function withdraw(uint256 assets, address receiver, address owner_) public override returns (uint256) {
        uint256 shares = previewWithdraw(assets);
        _withdraw(_msgSender(), receiver, owner_, assets, shares);
        return shares;
    }

    function redeem(uint256 shares, address receiver, address owner_) public override returns (uint256) {
        uint256 assets = previewRedeem(shares);
        _withdraw(_msgSender(), receiver, owner_, assets, shares);
        return assets;
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares)
        internal
        override
    {
        if (assets > withdrawLimit) revert("insufficient liquidity");
        super._withdraw(caller, receiver, owner_, assets, shares);
    }
}

/// @dev Vault A: 18-decimal shares (offset 12), max* all return 0 (Morpho VaultV2 style).
contract MockVaultA is MockVaultBase {
    constructor(IERC20 asset_) MockVaultBase(asset_, "Vault A", "vA", true) {}

    function _decimalsOffset() internal pure override returns (uint8) {
        return 12;
    }
}

/// @dev Vault B: plain 6-decimal shares, standard max*.
contract MockVaultB is MockVaultBase {
    constructor(IERC20 asset_) MockVaultBase(asset_, "Vault B", "vB", false) {}
}
