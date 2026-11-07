// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ArcPool} from "../ArcPool.sol";
import {ArcPoolTestBase} from "./ArcPool.Base.t.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockVaultA, MockVaultB} from "./mocks/MockVaults.sol";

contract ArcPoolFuzzTest is ArcPoolTestBase {
    /// Deposit/redeem round trip never returns more than was deposited, even with
    /// other holders, deployed funds and unharvested vault yield around.
    function testFuzz_RoundTripNeverProfits(uint256 amt, uint256 otherAmt, uint256 yieldAmt, bool rebal) public {
        amt = bound(amt, 1, 1e15);
        otherAmt = bound(otherAmt, 0, 1e14);
        yieldAmt = bound(yieldAmt, 0, 1e13);

        if (otherAmt > 0) {
            _deposit(bob, otherAmt);
            pool.rebalance();
        }
        _deposit(alice, amt);
        if (rebal) pool.rebalance();
        vaultA.addYield(yieldAmt);

        uint256 out = _redeemAll(alice);
        assertLe(out, amt, "round trip must not profit");
        assertLe(pool.totalAssets(), pool.idleAssets() + pool.deployed());
    }

    /// With a loss in a vault, exits never pay more than deposited and totalAssets never reverts.
    function testFuzz_LossThenExit(uint256 amt, uint256 lossBps, bool useB) public {
        amt = bound(amt, 1e6, 1e13);
        lossBps = bound(lossBps, 0, 10_000);
        _deposit(alice, amt);
        pool.rebalance();

        if (useB) {
            vaultB.simulateLoss((pool.vaultAssets(1) * lossBps) / 10_000);
        } else {
            vaultA.simulateLoss((pool.vaultAssets(0) * lossBps) / 10_000);
        }
        pool.totalAssets(); // view must not revert / underflow
        uint256 out = _redeemAll(alice);
        assertLe(out, amt);
        assertLe(pool.totalAssets(), pool.idleAssets() + pool.deployed());
    }

    /// Entry is gross: a late depositor never extracts more than they put in after a harvest + full vest.
    function testFuzz_LateDepositorCannotCaptureYield(uint256 whale, uint256 yieldAmt) public {
        whale = bound(whale, 1e6, 1e14);
        yieldAmt = bound(yieldAmt, 1e6, 1e12);
        _funded();
        vaultA.addYield(yieldAmt);
        pool.harvest();
        _deposit(bob, whale);
        skip(VESTING + 1);
        uint256 bobOut = _redeemAll(bob);
        // tolerance for the 1e6 virtual shares: relative 1e-8 + a few wei
        assertLe(bobOut, whale + whale / 1e7 + 10);
    }
}

contract PoolHandler is Test {
    ArcPool public pool;
    MockUSDC public usdc;
    MockVaultA public a;
    MockVaultB public b;
    address[3] public actors;
    uint256 public ghostIn;
    uint256 public ghostOut;

    constructor(ArcPool pool_, MockUSDC usdc_, MockVaultA a_, MockVaultB b_) {
        pool = pool_;
        usdc = usdc_;
        a = a_;
        b = b_;
        actors = [makeAddr("h1"), makeAddr("h2"), makeAddr("h3")];
    }

    function deposit(uint256 seed, uint256 amt) external {
        address who = actors[seed % 3];
        amt = bound(amt, 1, 1e12);
        usdc.mint(who, amt);
        vm.startPrank(who);
        usdc.approve(address(pool), amt);
        pool.deposit(amt, who);
        vm.stopPrank();
        ghostIn += amt;
    }

    function redeem(uint256 seed, uint256 frac) external {
        address who = actors[seed % 3];
        uint256 shares = bound(frac, 0, pool.balanceOf(who));
        vm.prank(who);
        ghostOut += pool.redeem(shares, who, who);
    }

    function rebalance() external {
        pool.rebalance();
    }

    function harvest() external {
        pool.harvest();
    }

    function addYield(uint256 which, uint256 amt) external {
        amt = bound(amt, 0, 1e11);
        if (which % 2 == 0) a.addYield(amt);
        else b.addYield(amt);
        ghostIn += amt; // upper bound on value the pool can claim
    }

    function addRewards(uint256 seed, uint256 amt) external {
        if (pool.totalSupply() == 0) return;
        address who = actors[seed % 3];
        amt = bound(amt, 1, 1e11);
        usdc.mint(who, amt);
        vm.startPrank(who);
        usdc.approve(address(pool), amt);
        pool.addRewards(amt);
        vm.stopPrank();
        ghostIn += amt;
    }

    function warp(uint256 secs) external {
        skip(bound(secs, 0, 3 days));
    }
}

contract ArcPoolInvariantTest is ArcPoolTestBase {
    PoolHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new PoolHandler(pool, usdc, vaultA, vaultB);
        targetContract(address(handler));
    }

    /// Users can never withdraw more than all value that entered the system.
    function invariant_NoValueCreated() public view {
        assertLe(handler.ghostOut(), handler.ghostIn());
    }

    function invariant_TotalAssetsBoundedByBacking() public view {
        assertLe(pool.totalAssets(), pool.idleAssets() + pool.deployed());
    }

    function invariant_ShareValueNeverExceedsTotalAssets() public view {
        assertLe(pool.convertToAssets(pool.totalSupply()), pool.totalAssets());
    }
}
