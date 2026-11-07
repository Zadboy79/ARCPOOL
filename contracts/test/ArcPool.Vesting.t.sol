// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ArcPool} from "../ArcPool.sol";
import {ArcPoolTestBase} from "./ArcPool.Base.t.sol";

/// Harvest, linear vesting, gross entry pricing, net exit pricing and addRewards.
contract ArcPoolVestingTest is ArcPoolTestBase {
    uint256 internal constant TOL = 1e4; // 0.01 USDC

    // ---------------------------------------------------------------- harvest
    function test_Harvest_YieldExcludedUntilHarvested() public {
        _yielded();
        assertEq(pool.totalAssets(), 1000 * U, "unharvested yield must not count");
        assertApproxEqAbs(pool.pendingYield(), 100 * U, 4);
        assertEq(pool.totalYieldHarvested(), 0);

        vm.expectEmit(true, false, false, false, address(pool));
        emit ArcPool.Harvested(carol, 0);
        vm.prank(carol); // permissionless
        uint256 gain = pool.harvest();

        assertApproxEqAbs(gain, 100 * U, 4);
        assertEq(pool.totalYieldHarvested(), gain);
        assertEq(pool.pendingYield(), 0);
        assertEq(pool.deployed(), 900 * U + gain);
        assertEq(pool.totalAssets(), 1000 * U, "harvested gain starts fully locked");
    }

    function test_Harvest_VestsLinearly() public {
        _yielded();
        uint256 gain = pool.harvest();
        uint256 base = 1000 * U;

        assertEq(pool.totalAssets(), base); // 0%
        skip(VESTING / 4);
        assertApproxEqAbs(pool.totalAssets(), base + gain / 4, 2); // 25%
        skip(VESTING / 4);
        assertApproxEqAbs(pool.totalAssets(), base + gain / 2, 2); // 50%
        skip(VESTING / 2);
        assertEq(pool.totalAssets(), base + gain); // 100%
        skip(VESTING);
        assertEq(pool.totalAssets(), base + gain); // stays
        assertEq(pool.lockedRewards(), 0);
    }

    function test_Harvest_SecondHarvestWithoutNewYieldIsZero() public {
        _yielded();
        pool.harvest();
        assertEq(pool.harvest(), 0);
    }

    function test_Harvest_SecondGainMergesIntoStream() public {
        _yielded();
        uint256 g1 = pool.harvest();
        skip(VESTING / 2);
        vaultA.addYield(60 * U);
        uint256 g2 = pool.harvest();
        assertApproxEqAbs(g2, 60 * U, 3);
        assertEq(pool.totalYieldHarvested(), g1 + g2);
        assertApproxEqAbs(pool.lockedRewards(), g1 / 2 + g2, 5);
    }

    function test_Harvest_RevertsWhenAnyVaultUnreadable() public {
        _yielded();
        vaultA.setConvertReverts(true);
        vm.expectRevert(ArcPool.VaultReadFailed.selector);
        pool.harvest();
    }

    function test_Harvest_NoCommissionOnVaultYield() public {
        vm.prank(admin);
        pool.setCommission(2000, treasury);
        _yielded();
        pool.harvest();
        assertEq(usdc.balanceOf(treasury), 0);
    }

    // ------------------------------------------------- gross entry / net exit
    function test_Entry_WhaleAfterHarvestCannotCaptureYield() public {
        _yielded();
        uint256 gain = pool.harvest();
        _deposit(bob, 10_000 * U);
        skip(VESTING + 1);

        uint256 aliceOut = _redeemAll(alice);
        uint256 bobOut = _redeemAll(bob);
        assertApproxEqAbs(aliceOut, 1000 * U + gain, TOL, "early holder gets the gain");
        assertApproxEqAbs(bobOut, 10_000 * U, TOL, "whale gets ~its deposit");
        assertLe(bobOut, 10_000 * U + TOL);
    }

    function test_Entry_WhaleAfterAddRewardsCannotCaptureRewards() public {
        _funded();
        _addRewards(carol, 100 * U);
        _deposit(bob, 10_000 * U);
        skip(VESTING + 1);

        assertApproxEqAbs(_redeemAll(alice), 1100 * U, TOL, "early holder gets the rewards");
        assertApproxEqAbs(_redeemAll(bob), 10_000 * U, TOL, "whale gets ~its deposit");
    }

    function test_Entry_WhaleBeforeHarvestPaysForPendingYield() public {
        _yielded(); // 100 USDC of unharvested vault gain
        _deposit(bob, 10_000 * U);
        pool.harvest();
        skip(VESTING + 1);

        assertApproxEqAbs(_redeemAll(alice), 1100 * U, TOL);
        assertApproxEqAbs(_redeemAll(bob), 10_000 * U, TOL);
    }

    function test_Entry_WhaleCannotProfitFromImmediateExit() public {
        _yielded();
        pool.harvest();
        _deposit(bob, 10_000 * U);
        assertLe(_redeemAll(bob), 10_000 * U, "gross-in / net-out can never profit");
    }

    function test_Entry_DepositThenHarvestGainsNothing() public {
        _yielded(); // alice 1000 in, 100 unharvested gain
        _deposit(bob, 1000 * U);
        uint256 bobSharesBefore = pool.balanceOf(bob);
        // bob harvests right after depositing
        vm.prank(bob);
        uint256 gain = pool.harvest();
        assertApproxEqAbs(gain, 100 * U, 4);
        assertEq(pool.balanceOf(bob), bobSharesBefore);
        // immediately after: bob's exit is net-priced, below his deposit
        assertLt(pool.convertToAssets(bobSharesBefore), 1000 * U);

        skip(VESTING + 1);
        uint256 aliceOut = _redeemAll(alice);
        uint256 bobOut = _redeemAll(bob);
        assertApproxEqAbs(bobOut, 1000 * U, TOL, "bob gains nothing");
        assertApproxEqAbs(aliceOut, 1000 * U + gain, TOL, "alice keeps all of the gain");
    }

    function test_Exit_UsesNetPrice() public {
        _yielded();
        pool.harvest();
        uint256 shares = pool.balanceOf(alice);
        assertEq(pool.convertToAssets(shares), 1000 * U, "net price excludes locked gain");
        assertEq(_redeemAll(alice), 1000 * U);
    }

    function test_Entry_PreviewsReflectGrossVsNet() public {
        _yielded();
        pool.harvest();
        assertLt(pool.previewDeposit(1000 * U), pool.convertToShares(1000 * U));
        assertGt(pool.previewMint(1e12), pool.convertToAssets(1e12));
        skip(VESTING);
        // fully vested => gross == net (to rounding)
        assertApproxEqAbs(pool.previewMint(1e12), pool.convertToAssets(1e12), 2);
    }

    function test_Exit_FullExitMidVestLeavesLockedAmountUnclaimable() public {
        _deposit(alice, 1000 * U);
        _addRewards(carol, 100 * U);
        assertEq(_redeemAll(alice), 1000 * U);
        assertEq(pool.totalSupply(), 0);
        assertEq(pool.totalAssets(), 0, "locked remainder is excluded and capped");

        // a later depositor never gets more than they paid in
        _deposit(bob, 100 * U);
        skip(VESTING + 1);
        assertLe(_redeemAll(bob), 100 * U);
    }

    // ------------------------------------------------------------ addRewards
    function test_AddRewards_CommissionGoesToTreasuryInUsdc() public {
        vm.expectEmit(true, true, false, true, address(pool));
        emit ArcPool.CommissionUpdated(1000, treasury);
        vm.prank(admin);
        pool.setCommission(1000, treasury);
        _deposit(alice, 1000 * U);
        uint256 supply = pool.totalSupply();

        usdc.mint(carol, 100 * U);
        vm.startPrank(carol);
        usdc.approve(address(pool), 100 * U);
        vm.expectEmit(true, false, false, true, address(pool));
        emit ArcPool.RewardsAdded(carol, 100 * U, 10 * U);
        pool.addRewards(100 * U);
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), 10 * U);
        assertEq(pool.idleAssets(), 1090 * U);
        assertEq(pool.totalRewardsDistributed(), 100 * U);
        assertEq(pool.lockedRewards(), 90 * U);
        assertEq(pool.totalAssets(), 1000 * U);
        assertEq(pool.totalSupply(), supply, "no shares minted for commission");
        assertEq(pool.balanceOf(treasury), 0);
    }

    function test_AddRewards_NoCommissionWhenUnset() public {
        _deposit(alice, 1000 * U);
        _addRewards(carol, 100 * U);
        assertEq(pool.lockedRewards(), 100 * U);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_AddRewards_NoCommissionWhenBpsZeroEvenWithTreasury() public {
        vm.prank(admin);
        pool.setCommission(0, treasury);
        _deposit(alice, 1000 * U);
        _addRewards(carol, 100 * U);
        assertEq(usdc.balanceOf(treasury), 0);
        assertEq(pool.lockedRewards(), 100 * U);
    }

    function test_AddRewards_VestsLinearly() public {
        _deposit(alice, 1000 * U);
        _addRewards(carol, 100 * U);
        assertEq(pool.totalAssets(), 1000 * U);
        skip(VESTING / 2);
        assertEq(pool.totalAssets(), 1050 * U);
        skip(VESTING / 2);
        assertEq(pool.totalAssets(), 1100 * U);
    }

    function test_AddRewards_DustCannotMeaningfullyDelay() public {
        _deposit(alice, 1000 * U);
        _addRewards(carol, 100 * U);
        skip(VESTING / 2);
        uint256 remBefore = pool.vestEnd() - block.timestamp;
        _addRewards(bob, 1); // 1 wei of USDC
        uint256 remAfter = pool.vestEnd() - block.timestamp;
        assertLe(remAfter, remBefore + 1);
        assertGe(remAfter, remBefore);
        assertApproxEqAbs(pool.lockedRewards(), 50 * U, 2);
    }

    function test_AddRewards_EqualSizeAveragesDuration() public {
        _deposit(alice, 1000 * U);
        _addRewards(carol, 100 * U);
        skip(VESTING / 2); // 50 locked, 3.5 days remaining
        _addRewards(carol, 50 * U); // new 50 over 7 days
        // (50*3.5d + 50*7d) / 100 = 5.25d
        assertEq(pool.vestEnd() - block.timestamp, (VESTING * 3) / 4);
        assertApproxEqAbs(pool.lockedRewards(), 100 * U, 1);
        assertEq(pool.totalAssets(), 1050 * U);
    }

    function test_AddRewards_RevertsWithNoStakers() public {
        usdc.mint(carol, 10 * U);
        vm.startPrank(carol);
        usdc.approve(address(pool), 10 * U);
        vm.expectRevert(ArcPool.NoStakers.selector);
        pool.addRewards(10 * U);
        vm.stopPrank();
    }

    function test_AddRewards_RevertsOnZeroAmount() public {
        _deposit(alice, 1000 * U);
        vm.expectRevert(ArcPool.ZeroRewardAmount.selector);
        pool.addRewards(0);
    }

    function test_AddRewards_MaxCommissionNeverZeroNet() public {
        vm.prank(admin);
        pool.setCommission(2000, treasury);
        _deposit(alice, 1000 * U);
        _addRewards(carol, 1); // commission rounds to 0, net 1: no ZeroNetRewards
        assertEq(pool.totalRewardsDistributed(), 1);
        _addRewards(carol, 100 * U);
        assertEq(usdc.balanceOf(treasury), 20 * U);
    }

    // --------------------------------------------------------- setCommission
    function test_SetCommission_RevertsAboveTwentyPercent() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(ArcPool.CommissionTooHigh.selector, uint16(2001)));
        pool.setCommission(2001, treasury);
    }

    function test_SetCommission_RevertsOnZeroTreasuryWithBps() public {
        vm.prank(admin);
        vm.expectRevert(ArcPool.ZeroAddress.selector);
        pool.setCommission(100, address(0));
        vm.prank(admin);
        pool.setCommission(0, address(0)); // allowed
        assertEq(pool.commissionBps(), 0);
    }

    function test_SetCommission_OnlyAdmin() public {
        bytes memory err =
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, bytes32(0));
        vm.prank(alice);
        vm.expectRevert(err);
        pool.setCommission(100, treasury);
    }

    function test_SetCommission_StoresValues() public {
        vm.prank(admin);
        pool.setCommission(2000, treasury);
        assertEq(pool.commissionBps(), 2000);
        assertEq(pool.treasury(), treasury);
    }
}
