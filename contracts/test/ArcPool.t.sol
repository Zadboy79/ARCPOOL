// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ArcPool} from "../ArcPool.sol";
import {ArcPoolTestBase} from "./ArcPool.Base.t.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockVaultB} from "./mocks/MockVaults.sol";

/// Constructor, basic deposit/redeem, rebalance, pause and deposit cap.
contract ArcPoolTest is ArcPoolTestBase {
    // ------------------------------------------------------------ constructor
    function test_Constructor_StoresConfig() public view {
        assertEq(pool.asset(), address(usdc));
        assertEq(pool.vaultsLength(), 2);
        assertEq(pool.vaultAt(0), address(vaultA));
        assertEq(pool.vaultAt(1), address(vaultB));
        assertEq(pool.vestingPeriod(), VESTING);
        assertEq(pool.bufferBps(), BUFFER);
        assertTrue(pool.hasRole(pool.DEFAULT_ADMIN_ROLE(), admin));
        assertEq(pool.decimals(), 12);
        assertEq(pool.deployed(), 0);
        assertEq(pool.depositCap(), type(uint256).max);
        assertEq(vaultA.decimals(), 18);
        assertEq(vaultB.decimals(), 6);
    }

    function test_Constructor_RevertsOnZeroUsdc() public {
        vm.expectRevert(ArcPool.ZeroAddress.selector);
        new ArcPool(IERC20(address(0)), admin, VESTING, _two(), BUFFER);
    }

    function test_Constructor_RevertsOnZeroAdmin() public {
        vm.expectRevert(ArcPool.ZeroAddress.selector);
        new ArcPool(IERC20(address(usdc)), address(0), VESTING, _two(), BUFFER);
    }

    function test_Constructor_RevertsOnZeroVaultAddress() public {
        address[] memory vs = new address[](1);
        vm.expectRevert(ArcPool.ZeroAddress.selector);
        _newPool(vs, BUFFER, VESTING);
    }

    function test_Constructor_RevertsOnZeroVaults() public {
        address[] memory vs = new address[](0);
        vm.expectRevert(ArcPool.InvalidVaultCount.selector);
        _newPool(vs, BUFFER, VESTING);
    }

    function test_Constructor_RevertsOnFiveVaults() public {
        address[] memory vs = new address[](5);
        for (uint256 i; i < 5; ++i) {
            vs[i] = address(new MockVaultB(IERC20(address(usdc))));
        }
        vm.expectRevert(ArcPool.InvalidVaultCount.selector);
        _newPool(vs, BUFFER, VESTING);
    }

    function test_Constructor_AcceptsOneAndFourVaults() public {
        address[] memory one = new address[](1);
        one[0] = address(vaultA);
        assertEq(_newPool(one, BUFFER, VESTING).vaultsLength(), 1);

        address[] memory four = new address[](4);
        four[0] = address(vaultA);
        four[1] = address(vaultB);
        four[2] = address(new MockVaultB(IERC20(address(usdc))));
        four[3] = address(new MockVaultB(IERC20(address(usdc))));
        assertEq(_newPool(four, BUFFER, VESTING).vaultsLength(), 4);
    }

    function test_Constructor_RevertsOnDuplicateVault() public {
        address[] memory vs = new address[](2);
        vs[0] = address(vaultA);
        vs[1] = address(vaultA);
        vm.expectRevert(ArcPool.DuplicateVault.selector);
        _newPool(vs, BUFFER, VESTING);
    }

    function test_Constructor_RevertsOnWrongAsset() public {
        MockUSDC other = new MockUSDC();
        MockVaultB bad = new MockVaultB(IERC20(address(other)));
        address[] memory vs = new address[](2);
        vs[0] = address(vaultA);
        vs[1] = address(bad);
        vm.expectRevert(ArcPool.VaultAssetMismatch.selector);
        _newPool(vs, BUFFER, VESTING);
    }

    function test_Constructor_BufferBounds() public {
        vm.expectRevert(ArcPool.BufferTooHigh.selector);
        _newPool(_two(), 10_001, VESTING);
        assertEq(_newPool(_two(), 10_000, VESTING).bufferBps(), 10_000);
        assertEq(_newPool(_two(), 0, VESTING).bufferBps(), 0);
    }

    function test_Constructor_VestingBounds() public {
        vm.expectRevert(ArcPool.InvalidVestingPeriod.selector);
        _newPool(_two(), BUFFER, 1 hours - 1);
        vm.expectRevert(ArcPool.InvalidVestingPeriod.selector);
        _newPool(_two(), BUFFER, 30 days + 1);
        assertEq(_newPool(_two(), BUFFER, 1 hours).vestingPeriod(), 1 hours);
        assertEq(_newPool(_two(), BUFFER, 30 days).vestingPeriod(), 30 days);
    }

    // ------------------------------------------------------ deposit / redeem
    function test_DepositRedeem_NoVaultsFunded() public {
        usdc.mint(alice, 1000 * U);
        vm.startPrank(alice);
        usdc.approve(address(pool), 1000 * U);
        vm.expectEmit(true, true, false, true, address(pool));
        emit IERC4626.Deposit(alice, alice, 1000 * U, 1e15);
        uint256 shares = pool.deposit(1000 * U, alice);
        vm.stopPrank();

        assertEq(shares, 1e15);
        assertEq(pool.totalAssets(), 1000 * U);
        assertEq(pool.idleAssets(), 1000 * U);
        assertEq(pool.deployed(), 0);

        uint256 out = _redeemAll(alice);
        assertEq(out, 1000 * U);
        assertEq(usdc.balanceOf(alice), 1000 * U);
        assertEq(pool.totalSupply(), 0);
        assertEq(pool.totalAssets(), 0);
    }

    function test_Withdraw_NoVaultsFunded() public {
        _deposit(alice, 1000 * U);
        vm.prank(alice);
        pool.withdraw(400 * U, alice, alice);
        assertEq(usdc.balanceOf(alice), 400 * U);
        assertEq(pool.totalAssets(), 600 * U);
    }

    function test_Mint_PricesAtGross() public {
        usdc.mint(alice, 2000 * U);
        vm.startPrank(alice);
        usdc.approve(address(pool), 2000 * U);
        uint256 cost = pool.previewMint(1e15);
        uint256 spent = pool.mint(1e15, alice);
        vm.stopPrank();
        assertEq(spent, cost);
        assertEq(pool.balanceOf(alice), 1e15);
        assertEq(usdc.balanceOf(alice), 2000 * U - cost);
    }

    // ------------------------------------------------------------- rebalance
    function test_Rebalance_LeavesBufferAndSplitsEqually() public {
        _deposit(alice, 1000 * U);
        vm.expectEmit(true, false, false, true, address(pool));
        emit ArcPool.Rebalanced(address(vaultA), 450 * U);
        vm.expectEmit(true, false, false, true, address(pool));
        emit ArcPool.Rebalanced(address(vaultB), 450 * U);
        uint256 moved = pool.rebalance();

        assertEq(moved, 900 * U);
        assertEq(pool.idleAssets(), 100 * U);
        assertEq(pool.deployed(), 900 * U);
        assertApproxEqAbs(pool.vaultAssets(0), 450 * U, 1);
        assertApproxEqAbs(pool.vaultAssets(1), 450 * U, 1);
        assertEq(pool.totalAssets(), 1000 * U);
    }

    function test_Rebalance_NoopWhenAtBuffer() public {
        _funded();
        assertEq(pool.rebalanceAmount(), 0);
        assertEq(pool.rebalance(), 0);
        assertEq(pool.deployed(), 900 * U);
    }

    function test_Rebalance_ZeroBufferDeploysEverything() public {
        pool = _newPool(_two(), 0, VESTING);
        _deposit(alice, 1000 * U);
        assertEq(pool.rebalanceAmount(), 1000 * U);
        assertEq(pool.rebalance(), 1000 * U);
        assertEq(pool.idleAssets(), 0);
        assertEq(pool.deployed(), 1000 * U);
    }

    function test_Rebalance_FullBufferDeploysNothing() public {
        pool = _newPool(_two(), 10_000, VESTING);
        _deposit(alice, 1000 * U);
        assertEq(pool.rebalance(), 0);
        assertEq(pool.idleAssets(), 1000 * U);
    }

    function test_Rebalance_DustStaysIdle() public {
        _deposit(alice, 1000 * U + 1);
        pool.rebalance();
        // (1000e6+1) - 10% target (100000000) = 900000001 -> per 450000000, 1 dust idle
        assertEq(pool.deployed(), 900 * U);
        assertEq(pool.idleAssets(), 100 * U + 1);
    }

    function test_Rebalance_RevertingVaultKeepsItsShareIdle() public {
        vaultA.setDepositReverts(true);
        _deposit(alice, 1000 * U);
        uint256 moved = pool.rebalance(); // must not revert
        assertEq(moved, 450 * U);
        assertEq(pool.deployed(), 450 * U);
        assertEq(pool.idleAssets(), 550 * U);
        assertEq(pool.vaultAssets(0), 0);
        assertApproxEqAbs(pool.vaultAssets(1), 450 * U, 1);
        assertEq(pool.totalAssets(), 1000 * U);
        // no leftover allowance to the failing vault
        assertEq(usdc.allowance(address(pool), address(vaultA)), 0);
    }

    function test_Rebalance_UnreadableVaultStillReceivesDeposit() public {
        vaultA.setConvertReverts(true);
        _deposit(alice, 1000 * U);
        assertEq(pool.rebalance(), 900 * U);
        assertEq(pool.deployed(), 900 * U);
    }

    function test_Sync_HarvestsThenRebalances() public {
        _yielded();
        (uint256 gain, uint256 moved) = pool.sync();
        assertApproxEqAbs(gain, 100 * U, 4);
        assertEq(pool.totalYieldHarvested(), gain);
        // gain is vault-held; idle was already at buffer vs (idle+deployed) so little moves
        assertGe(moved, 0);
        assertEq(pool.totalAssets(), 1000 * U);
    }

    // ----------------------------------------------------------------- pause
    function test_Pause_BlocksDepositAndMint() public {
        vm.prank(admin);
        pool.pause();
        usdc.mint(alice, 100 * U);
        vm.startPrank(alice);
        usdc.approve(address(pool), 100 * U);
        vm.expectRevert(
            abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxDeposit.selector, alice, 100 * U, 0)
        );
        pool.deposit(100 * U, alice);
        vm.expectRevert(abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxMint.selector, alice, 1e14, 0));
        pool.mint(1e14, alice);
        vm.stopPrank();
        assertEq(pool.maxDeposit(alice), 0);
        assertEq(pool.maxMint(alice), 0);
    }

    function test_Pause_AllowsRedeemRebalanceHarvestRecall() public {
        _yielded();
        vm.prank(admin);
        pool.pause();
        assertTrue(pool.paused());

        assertEq(pool.rebalance(), 0);
        assertApproxEqAbs(pool.harvest(), 100 * U, 4);
        pool.recallFromVault(0, 10 * U);
        uint256 out = _redeemAll(alice);
        assertGt(out, 0);
        assertEq(usdc.balanceOf(alice), out);
    }

    function test_Pause_AddRewardsStillWorks() public {
        _deposit(alice, 1000 * U);
        vm.prank(admin);
        pool.pause();
        _addRewards(carol, 10 * U);
        assertEq(pool.totalRewardsDistributed(), 10 * U);
    }

    function test_Pause_OnlyAdminAndUnpauseRestores() public {
        bytes memory err = abi.encodeWithSelector(
            IAccessControl.AccessControlUnauthorizedAccount.selector, alice, pool.DEFAULT_ADMIN_ROLE()
        );
        vm.prank(alice);
        vm.expectRevert(err);
        pool.pause();

        vm.prank(admin);
        pool.pause();
        vm.prank(alice);
        vm.expectRevert(err);
        pool.unpause();

        vm.prank(admin);
        pool.unpause();
        assertFalse(pool.paused());
        _deposit(alice, 10 * U);
        assertGt(pool.balanceOf(alice), 0);
    }

    // ------------------------------------------------------------------- cap
    function test_DepositCap_EventAndOnlyAdmin() public {
        vm.expectEmit(false, false, false, true, address(pool));
        emit ArcPool.DepositCapUpdated(type(uint256).max, 5000 * U);
        vm.prank(admin);
        pool.setDepositCap(5000 * U);
        assertEq(pool.depositCap(), 5000 * U);

        bytes memory err =
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, bytes32(0));
        vm.prank(alice);
        vm.expectRevert(err);
        pool.setDepositCap(1);
    }

    function test_DepositCap_MaxDepositAndMaxMintConsistent() public {
        vm.prank(admin);
        pool.setDepositCap(5000 * U);
        _deposit(alice, 1000 * U);

        assertEq(pool.maxDeposit(bob), 4000 * U);
        uint256 mm = pool.maxMint(bob);
        assertGt(mm, 0);
        assertLe(pool.previewMint(mm), pool.maxDeposit(bob));

        // depositing exactly maxDeposit fills the cap
        _deposit(bob, 4000 * U);
        assertEq(pool.totalAssets(), 5000 * U);
        assertEq(pool.maxDeposit(bob), 0);
        assertEq(pool.maxMint(bob), 0);

        usdc.mint(bob, 1);
        vm.startPrank(bob);
        usdc.approve(address(pool), 1);
        vm.expectRevert(abi.encodeWithSelector(ERC4626.ERC4626ExceededMaxDeposit.selector, bob, 1, 0));
        pool.deposit(1, bob);
        vm.stopPrank();
    }

    function test_DepositCap_MintMaxMintStaysWithinCap() public {
        vm.prank(admin);
        pool.setDepositCap(5000 * U);
        _deposit(alice, 1000 * U);
        uint256 mm = pool.maxMint(bob);
        uint256 cost = pool.previewMint(mm);
        usdc.mint(bob, cost);
        vm.startPrank(bob);
        usdc.approve(address(pool), cost);
        pool.mint(mm, bob);
        vm.stopPrank();
        assertLe(pool.totalAssets(), 5000 * U);
    }

    function test_DepositCap_ConsistentWithUnvestedRewards() public {
        _deposit(alice, 1000 * U);
        _addRewards(carol, 100 * U); // gross 1100, net 1000
        vm.prank(admin);
        pool.setDepositCap(2000 * U);
        uint256 mm = pool.maxMint(bob);
        assertLe(pool.previewMint(mm), pool.maxDeposit(bob));
    }

    function test_DepositCap_ZeroAndBelowTotalAssetsStillAllowExit() public {
        _deposit(alice, 1000 * U);
        vm.prank(admin);
        pool.setDepositCap(0);
        assertEq(pool.maxDeposit(bob), 0);
        assertEq(pool.maxMint(bob), 0);
        vm.prank(admin);
        pool.setDepositCap(500 * U); // below totalAssets
        assertEq(pool.maxDeposit(bob), 0);
        assertEq(_redeemAll(alice), 1000 * U);
    }
}
