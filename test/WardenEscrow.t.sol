// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {WardenEscrow} from "../contracts/WardenEscrow.sol";
import {MockFXRP, MockAssetManager} from "./mocks/Mocks.sol";

/// @notice Unit tests for the contract that actually custodies funds.
/// The properties that matter here are the ones that would lose somebody's
/// money: only the resolver can trigger a release, an escrow can only resolve
/// once, and a false verdict must leave the funds exactly where they are.
contract WardenEscrowTest is Test {
    // Real FXRP has 6 decimals and a 10 FXRP redemption lot, the same figures
    // Phase 3 hit on Coston2 ("amount below one lot" with 4.0 FXRP left over).
    uint256 constant LOT_SIZE_UBA = 10_000_000;
    uint256 constant ONE_LOT = LOT_SIZE_UBA;

    string constant XRPL_ADDRESS = "rQhiVPjkhTQE9FXriKJhX9LZL9Jy9b4xnP";
    bytes32 constant CONDITION_ID = keccak256("temperature > 28C in Dubai");

    MockFXRP fxrp;
    MockAssetManager assetManager;
    WardenEscrow escrow;

    address buyer = makeAddr("buyer");
    address resolver = makeAddr("resolver");
    address stranger = makeAddr("stranger");

    event EscrowFunded(
        uint256 indexed escrowId,
        bytes32 indexed conditionId,
        address indexed buyer,
        string beneficiaryXrplAddress,
        uint256 amount
    );
    event EscrowResolved(uint256 indexed escrowId, bool outcome);
    event EscrowReleased(uint256 indexed escrowId, string beneficiaryXrplAddress, uint256 redeemedAmountUBA);

    function setUp() public {
        fxrp = new MockFXRP();
        assetManager = new MockAssetManager(fxrp, LOT_SIZE_UBA);
        escrow = new WardenEscrow(address(fxrp), address(assetManager));

        fxrp.mint(buyer, 100 * ONE_LOT);
        vm.prank(buyer);
        fxrp.approve(address(escrow), type(uint256).max);
    }

    function _fund(uint256 amount) internal returns (uint256 escrowId) {
        vm.prank(buyer);
        escrowId = escrow.fund(CONDITION_ID, XRPL_ADDRESS, amount);
    }

    function _wireResolver() internal {
        escrow.setResolver(resolver);
    }

    // --- constructor ---------------------------------------------------

    function test_RevertWhen_ConstructedWithZeroFxrp() public {
        vm.expectRevert("fxrp = 0");
        new WardenEscrow(address(0), address(assetManager));
    }

    function test_RevertWhen_ConstructedWithZeroAssetManager() public {
        vm.expectRevert("assetManager = 0");
        new WardenEscrow(address(fxrp), address(0));
    }

    // --- fund ----------------------------------------------------------

    function test_Fund_MovesTokensIntoEscrowAndRecordsTerms() public {
        uint256 escrowId = _fund(ONE_LOT);

        assertEq(escrowId, 0, "first escrow should be id 0");
        assertEq(fxrp.balanceOf(address(escrow)), ONE_LOT, "escrow should custody the FXRP");
        assertEq(escrow.heldBalance(), ONE_LOT, "heldBalance should match the token balance");

        WardenEscrow.Escrow memory e = escrow.getEscrow(escrowId);
        assertEq(e.conditionId, CONDITION_ID);
        assertEq(e.buyer, buyer);
        assertEq(e.beneficiaryXrplAddress, XRPL_ADDRESS);
        assertEq(e.amount, ONE_LOT);
        assertEq(uint8(e.status), uint8(WardenEscrow.ConditionStatus.Unresolved));
        assertEq(e.fundedAt, uint64(block.timestamp));
    }

    function test_Fund_EmitsEscrowFunded() public {
        vm.expectEmit(true, true, true, true, address(escrow));
        emit EscrowFunded(0, CONDITION_ID, buyer, XRPL_ADDRESS, ONE_LOT);
        _fund(ONE_LOT);
    }

    function test_Fund_AssignsSequentialIds() public {
        assertEq(_fund(ONE_LOT), 0);
        assertEq(_fund(ONE_LOT), 1);
        assertEq(_fund(ONE_LOT), 2);
        assertEq(escrow.nextEscrowId(), 3);
        assertEq(escrow.heldBalance(), 3 * ONE_LOT);
    }

    function test_RevertWhen_FundingZeroAmount() public {
        vm.prank(buyer);
        vm.expectRevert("amount = 0");
        escrow.fund(CONDITION_ID, XRPL_ADDRESS, 0);
    }

    function test_RevertWhen_FundingWithEmptyXrplAddress() public {
        vm.prank(buyer);
        vm.expectRevert("beneficiaryXrplAddress empty");
        escrow.fund(CONDITION_ID, "", ONE_LOT);
    }

    /// A token that reports failure by returning false instead of reverting
    /// must not produce an escrow record that claims to hold funds it doesn't.
    function test_RevertWhen_TransferFromReturnsFalse() public {
        fxrp.setTransferFromReturnsFalse(true);
        vm.prank(buyer);
        vm.expectRevert("FXRP transferFrom failed");
        escrow.fund(CONDITION_ID, XRPL_ADDRESS, ONE_LOT);
    }

    // --- setResolver ---------------------------------------------------

    function test_SetResolver_StoresResolver() public {
        _wireResolver();
        assertEq(escrow.resolver(), resolver);
    }

    function test_RevertWhen_SettingResolverTwice() public {
        _wireResolver();
        vm.expectRevert("resolver already set");
        escrow.setResolver(makeAddr("another resolver"));
    }

    function test_RevertWhen_SettingResolverToZero() public {
        vm.expectRevert("resolver = 0");
        escrow.setResolver(address(0));
    }

    // --- resolveAndRelease ---------------------------------------------

    /// The access control that matters: release is gated on being the wired
    /// resolver, not on any caller-supplied claim.
    function test_RevertWhen_NonResolverTriesToRelease() public {
        uint256 escrowId = _fund(ONE_LOT);
        _wireResolver();

        vm.prank(stranger);
        vm.expectRevert("not resolver");
        escrow.resolveAndRelease(escrowId, true);
    }

    function test_RevertWhen_ReleasingBeforeResolverIsWired() public {
        uint256 escrowId = _fund(ONE_LOT);
        vm.prank(stranger);
        vm.expectRevert("not resolver");
        escrow.resolveAndRelease(escrowId, true);
    }

    function test_ResolveAndRelease_TrueOutcomeRedeemsForXrp() public {
        uint256 escrowId = _fund(ONE_LOT);
        _wireResolver();

        vm.prank(resolver);
        uint256 redeemed = escrow.resolveAndRelease(escrowId, true);

        assertEq(redeemed, ONE_LOT, "should redeem the full lot");
        assertEq(assetManager.redeemCallCount(), 1);
        assertEq(assetManager.lastLots(), 1, "should convert amount into whole lots");
        assertEq(assetManager.lastRedeemerAddress(), XRPL_ADDRESS, "payout must target the beneficiary's XRPL address");
        assertEq(escrow.heldBalance(), 0, "FXRP should have left the escrow");
        assertEq(uint8(escrow.getEscrow(escrowId).status), uint8(WardenEscrow.ConditionStatus.Resolved));
    }

    function test_ResolveAndRelease_EmitsResolvedThenReleased() public {
        uint256 escrowId = _fund(ONE_LOT);
        _wireResolver();

        vm.expectEmit(true, false, false, true, address(escrow));
        emit EscrowResolved(escrowId, true);
        vm.expectEmit(true, false, false, true, address(escrow));
        emit EscrowReleased(escrowId, XRPL_ADDRESS, ONE_LOT);

        vm.prank(resolver);
        escrow.resolveAndRelease(escrowId, true);
    }

    function test_ResolveAndRelease_RoundsDownToWholeLots() public {
        // 2.5 lots of FXRP can only redeem 2 whole lots; the remainder stays.
        uint256 amount = (5 * ONE_LOT) / 2;
        uint256 escrowId = _fund(amount);
        _wireResolver();

        vm.prank(resolver);
        uint256 redeemed = escrow.resolveAndRelease(escrowId, true);

        assertEq(assetManager.lastLots(), 2);
        assertEq(redeemed, 2 * ONE_LOT);
        assertEq(escrow.heldBalance(), amount - 2 * ONE_LOT, "sub-lot remainder stays in the escrow");
    }

    /// A false verdict must be a no-op on the money: marked resolved, nothing
    /// redeemed, funds still in the contract.
    function test_ResolveAndRelease_FalseOutcomeLeavesFundsUntouched() public {
        uint256 escrowId = _fund(ONE_LOT);
        _wireResolver();

        vm.expectEmit(true, false, false, true, address(escrow));
        emit EscrowResolved(escrowId, false);

        vm.prank(resolver);
        uint256 redeemed = escrow.resolveAndRelease(escrowId, false);

        assertEq(redeemed, 0, "nothing should be redeemed on a false verdict");
        assertEq(assetManager.redeemCallCount(), 0, "AssetManager must not be touched");
        assertEq(escrow.heldBalance(), ONE_LOT, "funds stay put");
        assertEq(uint8(escrow.getEscrow(escrowId).status), uint8(WardenEscrow.ConditionStatus.Resolved));
    }

    function test_RevertWhen_ResolvingTwice() public {
        uint256 escrowId = _fund(ONE_LOT);
        _wireResolver();

        vm.prank(resolver);
        escrow.resolveAndRelease(escrowId, true);

        vm.prank(resolver);
        vm.expectRevert("already resolved");
        escrow.resolveAndRelease(escrowId, true);
    }

    /// Even a false resolution closes the escrow — otherwise a second, true
    /// verdict could release funds the first one declined.
    function test_RevertWhen_ResolvingAgainAfterFalseOutcome() public {
        uint256 escrowId = _fund(ONE_LOT);
        _wireResolver();

        vm.prank(resolver);
        escrow.resolveAndRelease(escrowId, false);

        vm.prank(resolver);
        vm.expectRevert("already resolved");
        escrow.resolveAndRelease(escrowId, true);
    }

    /// The exact failure Phase 3 hit on Coston2 with 4.0 FXRP left over.
    function test_RevertWhen_AmountIsBelowOneLot() public {
        uint256 escrowId = _fund(ONE_LOT - 1);
        _wireResolver();

        vm.prank(resolver);
        vm.expectRevert("amount below one lot");
        escrow.resolveAndRelease(escrowId, true);
    }

    /// A sub-lot escrow that reverts on release must stay unresolved and keep
    /// its funds, not end up marked resolved with the money stuck.
    function test_SubLotEscrowStaysUnresolvedAndKeepsFunds() public {
        uint256 escrowId = _fund(ONE_LOT - 1);
        _wireResolver();

        vm.prank(resolver);
        try escrow.resolveAndRelease(escrowId, true) {
            revert("expected revert");
        } catch {}

        assertEq(uint8(escrow.getEscrow(escrowId).status), uint8(WardenEscrow.ConditionStatus.Unresolved));
        assertEq(escrow.heldBalance(), ONE_LOT - 1);
    }

    // --- fuzz ----------------------------------------------------------

    function testFuzz_FundThenReleaseConservesValue(uint256 amount) public {
        amount = bound(amount, ONE_LOT, 50 * ONE_LOT);

        uint256 escrowId = _fund(amount);
        _wireResolver();
        assertEq(escrow.heldBalance(), amount);

        vm.prank(resolver);
        uint256 redeemed = escrow.resolveAndRelease(escrowId, true);

        uint256 expectedLots = amount / LOT_SIZE_UBA;
        assertEq(redeemed, expectedLots * LOT_SIZE_UBA);
        assertEq(escrow.heldBalance(), amount - redeemed, "remainder must equal what was not redeemed");
    }
}
