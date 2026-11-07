// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ArcPool} from "../ArcPool.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockVaultA, MockVaultB} from "./mocks/MockVaults.sol";

/// @dev Shared fixture. No test functions here.
abstract contract ArcPoolTestBase is Test {
    MockUSDC internal usdc;
    MockVaultA internal vaultA;
    MockVaultB internal vaultB;
    ArcPool internal pool;

    address internal admin = makeAddr("admin");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal treasury = makeAddr("treasury");

    uint256 internal constant VESTING = 7 days;
    uint16 internal constant BUFFER = 1000; // 10%
    uint256 internal constant U = 1e6; // 1 USDC

    function setUp() public virtual {
        usdc = new MockUSDC();
        vaultA = new MockVaultA(IERC20(address(usdc)));
        vaultB = new MockVaultB(IERC20(address(usdc)));
        pool = _newPool(_two(), BUFFER, VESTING);
    }

    function _two() internal view returns (address[] memory vs) {
        vs = new address[](2);
        vs[0] = address(vaultA);
        vs[1] = address(vaultB);
    }

    function _newPool(address[] memory vs, uint16 buf, uint256 vest) internal returns (ArcPool) {
        return new ArcPool(IERC20(address(usdc)), admin, vest, vs, buf);
    }

    function _deposit(address who, uint256 amt) internal returns (uint256 shares) {
        usdc.mint(who, amt);
        vm.startPrank(who);
        usdc.approve(address(pool), amt);
        shares = pool.deposit(amt, who);
        vm.stopPrank();
    }

    function _redeemAll(address who) internal returns (uint256 assets) {
        uint256 shares = pool.balanceOf(who);
        vm.prank(who);
        assets = pool.redeem(shares, who, who);
    }

    function _addRewards(address funder, uint256 amt) internal {
        usdc.mint(funder, amt);
        vm.startPrank(funder);
        usdc.approve(address(pool), amt);
        pool.addRewards(amt);
        vm.stopPrank();
    }

    /// Alice deposits 1000 USDC; rebalance => idle 100, vaultA 450, vaultB 450.
    function _funded() internal {
        _deposit(alice, 1000 * U);
        pool.rebalance();
    }

    /// Funded pool + 50 USDC of yield sitting in each vault (unharvested).
    function _yielded() internal {
        _funded();
        vaultA.addYield(50 * U);
        vaultB.addYield(50 * U);
    }
}
