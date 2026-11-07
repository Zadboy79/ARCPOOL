// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Vm} from "forge-std/Vm.sol";
import {ArcPool} from "../ArcPool.sol";
import {ArcPoolTestBase} from "./ArcPool.Base.t.sol";

/// Exits pulling from vaults, recallFromVault, partial liquidity and loss realization.
contract ArcPoolLiquidityTest is ArcPoolTestBase {
    // ------------------------------------------------------------------ exits
    function test_Redeem_PullsLiquidityFromVaults() public {
        _funded(); // idle 100, vaults 900
        vm.expectEmit(true, false, false, false, address(pool));
        emit ArcPool.VaultWithdrawn(address(vaultA), 0);
        uint256 out = _redeemAll(alice);

        assertEq(out, 1000 * U);
        assertEq(usdc.balanceOf(alice), 1000 * U);
        assertEq(pool.totalAssets(), 0);
        assertEq(pool.deployed(), 0);
        assertEq(pool.idleAssets(), 0);
        assertEq(pool.vaultAssets(0), 0);
        assertEq(pool.vaultAssets(1), 0);
    }

    function test_Withdraw_PartialPullsAndKeepsTotalAssetsConsistent() public {
        _funded();
        vm.expectEmit(true, false, false, true, address(pool));
        emit ArcPool.VaultWithdrawn(address(vaultA), 400 * U);
        vm.prank(alice);
        pool.withdraw(500 * U, alice, alice);

        assertEq(usdc.balanceOf(alice), 500 * U);
        assertEq(pool.idleAssets(), 0);
        assertEq(pool.deployed(), 500 * U);
        assertEq(pool.totalAssets(), 500 * U);
        assertApproxEqAbs(pool.vaultAssets(0), 50 * U, 1);
        assertApproxEqAbs(pool.vaultAssets(1), 450 * U, 1);
        // remaining shares are worth the remaining assets
        assertApproxEqAbs(pool.convertToAssets(pool.balanceOf(alice)), 500 * U, 2);
    }

    function test_Exits_TwoHoldersStayConsistent() public {
        _deposit(alice, 500 * U);
        _deposit(bob, 500 * U);
        pool.rebalance();
        _redeemAll(alice);
        assertApproxEqAbs(pool.totalAssets(), 500 * U, 5);
        assertApproxEqAbs(pool.convertToAssets(pool.balanceOf(bob)), pool.totalAssets(), 5);
        assertApproxEqAbs(_redeemAll(bob), 500 * U, 5);
    }

    function test_Redeem_VestsOutstandingGainBeforePulling() public {
        _funded();
        vaultA.addYield(100 * U);
        assertEq(pool.totalYieldHarvested(), 0);
        uint256 half = pool.balanceOf(alice) / 2;
        vm.prank(alice);
        uint256 out = pool.redeem(half, alice, alice);

        // priced at net (gain excluded)
        assertEq(out, 500 * U);
        assertGt(pool.totalYieldHarvested(), 0);
        assertGt(pool.lockedRewards(), 0);
        assertEq(pool.pendingYield(), 0);
        // the gain stays locked: remaining half is worth only ~500 now
        assertApproxEqAbs(pool.convertToAssets(pool.balanceOf(alice)), 500 * U, 2);
    }

    function test_Redeem_SkipsUnreadableVault() public {
        _funded();
        vaultA.setConvertReverts(true);
        // idle 100 + vaultB 450 = 550 reachable
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(ArcPool.InsufficientLiquidity.selector, 600 * U, 550 * U));
        pool.withdraw(600 * U, alice, alice);
        pool.withdraw(500 * U, alice, alice);
        vm.stopPrank();
        assertEq(usdc.balanceOf(alice), 500 * U);
        assertApproxEqAbs(pool.vaultAssets(1), 50 * U, 1);
    }

    // ----------------------------------------------------------------- recall
    function test_Recall_VestsGainFirstSoItIsNotInstantlyRedeemable() public {
        _funded();
        vaultA.addYield(100 * U);
        uint256 taBefore = pool.totalAssets();
        assertEq(taBefore, 1000 * U);

        uint256 got = pool.recallFromVault(0, 200 * U);

        assertEq(got, 200 * U);
        assertEq(pool.totalAssets(), taBefore, "recall must not change totalAssets");
        assertEq(pool.idleAssets(), 300 * U);
        assertGt(pool.totalYieldHarvested(), 0);
        assertEq(pool.lockedRewards(), pool.totalYieldHarvested(), "gain still fully locked");
        assertEq(pool.pendingYield(), 0);
        // holder cannot pull out the gain
        assertApproxEqAbs(pool.convertToAssets(pool.balanceOf(alice)), 1000 * U, 2);
        assertEq(_redeemAll(alice), 1000 * U);
    }

    function test_Recall_MaxRedeemsWholePosition() public {
        _funded();
        uint256 got = pool.recallFromVault(0, type(uint256).max);
        assertApproxEqAbs(got, 450 * U, 1);
        assertEq(pool.vaultAssets(0), 0);
        assertEq(pool.deployed(), 900 * U - got);
        assertEq(pool.totalAssets(), 1000 * U);
    }

    function test_Recall_AmountAtLeastPositionRedeemsAll() public {
        _funded();
        uint256 have = pool.vaultAssets(1);
        pool.recallFromVault(1, have + 5);
        assertEq(pool.vaultAssets(1), 0);
    }

    function test_Recall_EmptyVaultReturnsZero() public {
        _deposit(alice, 100 * U);
        assertEq(pool.recallFromVault(0, 10 * U), 0);
    }

    function test_Recall_RevertsOnUnreadableVault() public {
        _funded();
        vaultA.setConvertReverts(true);
        vm.expectRevert(ArcPool.VaultReadFailed.selector);
        pool.recallFromVault(0, 10 * U);
        // other vault unaffected
        assertEq(pool.recallFromVault(1, 10 * U), 10 * U);
    }

    function test_Recall_RevertsOnBadIndex() public {
        vm.expectRevert();
        pool.recallFromVault(2, 1);
    }

    // ------------------------------------------------------ partial liquidity
    function test_PartialLiquidity_RevertsThenSucceedsAfterSmallRecalls() public {
        _funded(); // idle 100, A 450, B 450
        vaultA.setWithdrawLimit(300 * U);
        vaultB.setWithdrawLimit(300 * U);
        uint256 shares = pool.balanceOf(alice);

        // each vault gives 225 (half fallback) => 100 + 450 = 550 available
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(ArcPool.InsufficientLiquidity.selector, 1000 * U, 550 * U));
        pool.redeem(shares, alice, alice);
        // revert rolled everything back
        assertEq(pool.balanceOf(alice), shares);
        assertEq(pool.deployed(), 900 * U);

        // recalling an amount above the cap bubbles the vault revert
        vm.expectRevert();
        pool.recallFromVault(0, type(uint256).max);

        assertEq(pool.recallFromVault(0, 300 * U), 300 * U);
        assertEq(pool.recallFromVault(1, 300 * U), 300 * U);
        assertEq(pool.idleAssets(), 700 * U);

        vm.prank(alice);
        uint256 out = pool.redeem(shares, alice, alice);
        assertApproxEqAbs(out, 1000 * U, 2);
        assertEq(pool.balanceOf(alice), 0);
    }

    function test_PartialLiquidity_SmallExitServedFromIdleDespiteStuckVaults() public {
        _funded();
        vaultA.setWithdrawLimit(0);
        vaultB.setWithdrawLimit(0);
        vm.prank(alice);
        pool.withdraw(100 * U, alice, alice); // exactly idle
        assertEq(usdc.balanceOf(alice), 100 * U);
    }

    // ------------------------------------------------------------------ loss
    function test_Deposit_RealizesLossBeforePricing() public {
        _funded();
        vaultA.simulateLoss(90 * U);
        uint256 newDeployed = pool.vaultAssets(0) + pool.vaultAssets(1);
        assertLt(newDeployed, 900 * U);

        usdc.mint(bob, 100 * U);
        vm.startPrank(bob);
        usdc.approve(address(pool), 100 * U);
        vm.expectEmit(false, false, false, true, address(pool));
        emit ArcPool.LossRealized(900 * U, newDeployed);
        uint256 shares = pool.deposit(100 * U, bob);
        vm.stopPrank();

        assertEq(pool.deployed(), newDeployed);
        // priced against post-loss gross value (idle 100 + deployed)
        uint256 expected = (100 * U * (1e15 + 1e6)) / (100 * U + newDeployed + 1);
        assertEq(shares, expected);
        // bob is not diluted into subsidising the loss: he can exit for ~his deposit
        assertApproxEqAbs(_redeemAll(bob), 100 * U, 100);
    }

    function test_Redeem_RealizesLossAndPaysLess() public {
        _funded();
        vaultA.simulateLoss(90 * U);
        uint256 shares = pool.balanceOf(alice);
        vm.expectEmit(false, false, false, false, address(pool));
        emit ArcPool.LossRealized(0, 0);
        vm.prank(alice);
        uint256 out = pool.redeem(shares, alice, alice);
        assertApproxEqAbs(out, 910 * U, 10);
        assertApproxEqAbs(pool.deployed(), 0, 10);
    }

    function test_Withdraw_RealizesLoss() public {
        _funded();
        vaultB.simulateLoss(45 * U);
        vm.expectEmit(false, false, false, false, address(pool));
        emit ArcPool.LossRealized(0, 0);
        vm.prank(alice);
        pool.withdraw(10 * U, alice, alice);
        assertLt(pool.deployed(), 900 * U);
    }

    function test_Harvest_RealizesLossAndReturnsZero() public {
        _funded();
        vaultB.simulateLoss(90 * U);
        uint256 newDeployed = pool.vaultAssets(0) + pool.vaultAssets(1);
        vm.expectEmit(false, false, false, true, address(pool));
        emit ArcPool.LossRealized(900 * U, newDeployed);
        assertEq(pool.harvest(), 0);
        assertEq(pool.deployed(), newDeployed);
        assertEq(pool.totalYieldHarvested(), 0);
    }

    function test_Rebalance_RealizesLoss() public {
        _funded();
        vaultA.simulateLoss(90 * U);
        pool.rebalance();
        assertLt(pool.deployed(), 900 * U);
    }

    function test_UnreadableVaultDoesNotMarkAnythingDown() public {
        _funded();
        vaultA.setConvertReverts(true);
        vaultB.simulateLoss(90 * U); // real loss in the readable vault
        vm.recordLogs();

        _deposit(bob, 100 * U);
        vm.prank(alice);
        pool.withdraw(10 * U, alice, alice);
        pool.rebalance();

        // never marked down (rebalance of the new deposit may only grow it)
        assertGe(pool.deployed(), 900 * U);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            assertTrue(logs[i].topics[0] != ArcPool.LossRealized.selector, "unexpected LossRealized");
        }
        // pendingYield is zero while any vault is unreadable
        assertEq(pool.pendingYield(), 0);
        assertEq(pool.vaultAssets(0), 0);
    }

    function test_UnreadableVault_HarvestReverts() public {
        _funded();
        vaultB.setConvertReverts(true);
        vm.expectRevert(ArcPool.VaultReadFailed.selector);
        pool.harvest();
    }
}
