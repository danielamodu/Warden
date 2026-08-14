// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, Vm} from "forge-std/Test.sol";
import {WardenEscrow} from "../contracts/WardenEscrow.sol";
import {WardenDisputeResolver} from "../contracts/WardenDisputeResolver.sol";
import {MockFXRP, MockAssetManager, MockMachineManager} from "./mocks/Mocks.sol";

/// @notice Tests for Warden's central trust claim: that a dispute verdict is
/// only ever acted on if it carries a signature from the real, on-chain
/// registered TEE. `submitVerdict` is permissionless by design — anyone may
/// relay a verdict — so the signature check is the *entire* access control,
/// and these tests exist to prove it actually holds.
///
/// The signing scheme reconstructed here is tee-node's own, traced in PHASE3.md:
///   ActionResult.Hash() = keccak256(keccak256(data) || id || keccak256(tag) || status)
///   Payload.Hash()      = keccak256(abi.encode("TEE_ACTION_RESULT", chainId, actionResultHash))
///   signed              = keccak256("\x19Ethereum Signed Message:\n32" || payloadHash)
contract WardenDisputeResolverTest is Test {
    uint256 constant LOT_SIZE_UBA = 10_000_000;
    uint256 constant ONE_LOT = LOT_SIZE_UBA;

    // Warden's real extension id on Coston2 (see PHASE3.md).
    uint256 constant WARDEN_EXTENSION_ID = 66120;
    uint256 constant OTHER_EXTENSION_ID = 99999;

    string constant XRPL_ADDRESS = "rQhiVPjkhTQE9FXriKJhX9LZL9Jy9b4xnP";
    string constant SUBMISSION_TAG = "submit";
    uint8 constant STATUS_SUCCESS = 1;

    MockFXRP fxrp;
    MockAssetManager assetManager;
    MockMachineManager machineManager;
    WardenEscrow escrow;
    WardenDisputeResolver resolver;

    Vm.Wallet tee;      // the genuine, registered TEE
    Vm.Wallet impostor; // a well-formed signer that simply isn't it

    address buyer = makeAddr("buyer");
    address relayer = makeAddr("relayer");

    event VerdictSubmitted(uint256 indexed escrowId, bool outcome, address indexed teeId, bytes32 instructionId);

    function setUp() public {
        tee = vm.createWallet("warden-tee");
        impostor = vm.createWallet("impostor");

        fxrp = new MockFXRP();
        assetManager = new MockAssetManager(fxrp, LOT_SIZE_UBA);
        escrow = new WardenEscrow(address(fxrp), address(assetManager));
        machineManager = new MockMachineManager();

        resolver = new WardenDisputeResolver(address(escrow), address(machineManager), WARDEN_EXTENSION_ID);
        escrow.setResolver(address(resolver));

        // Register the genuine TEE under Warden's extension, exactly as
        // FlareTeeManager would after a successful attestation.
        machineManager.register(
            tee.addr, bytes32(tee.publicKeyX), bytes32(tee.publicKeyY), WARDEN_EXTENSION_ID
        );

        fxrp.mint(buyer, 100 * ONE_LOT);
        vm.prank(buyer);
        fxrp.approve(address(escrow), type(uint256).max);
        vm.prank(buyer);
        escrow.fund(keccak256("disputed delivery window"), XRPL_ADDRESS, ONE_LOT);
    }

    // --- helpers -------------------------------------------------------

    function _verdictData(uint256 escrowId, bool outcome, uint64 rulingNumber) internal pure returns (bytes memory) {
        return abi.encode(escrowId, outcome, rulingNumber);
    }

    /// Rebuilds the hash tee-node signs, then signs it with `w`.
    function _sign(
        Vm.Wallet memory w,
        bytes32 instructionId,
        string memory submissionTag,
        uint8 status,
        bytes memory data
    ) internal view returns (bytes memory) {
        bytes32 actionResultHash =
            keccak256(abi.encodePacked(keccak256(data), instructionId, keccak256(bytes(submissionTag)), status));
        bytes32 payloadHash = keccak256(abi.encode(bytes32("TEE_ACTION_RESULT"), block.chainid, actionResultHash));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(w.privateKey, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }

    // --- the happy path ------------------------------------------------

    /// The address the contract derives from the registered public key must be
    /// the address that key actually signs with — the whole check rests on it.
    function test_DerivedTeeAddressMatchesRegisteredPublicKey() public view {
        (bytes32 x, bytes32 y) = machineManager.getPublicKey(tee.addr);
        address derived = address(uint160(uint256(keccak256(abi.encodePacked(x, y)))));
        assertEq(derived, tee.addr, "pubkey-to-address derivation must match the signer");
    }

    function test_SubmitVerdict_AcceptsGenuineTeeSignatureAndReleases() public {
        bytes32 instructionId = keccak256("instruction-1");
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        vm.prank(relayer);
        uint256 redeemed = resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);

        assertEq(redeemed, ONE_LOT, "a genuine true verdict should redeem the escrow");
        assertEq(assetManager.redeemCallCount(), 1);
        assertEq(assetManager.lastRedeemerAddress(), XRPL_ADDRESS);
        assertEq(escrow.heldBalance(), 0);
        assertTrue(resolver.consumedInstructionIds(instructionId), "instruction should be marked consumed");
    }

    function test_SubmitVerdict_EmitsVerdictSubmitted() public {
        bytes32 instructionId = keccak256("instruction-emit");
        bytes memory data = _verdictData(0, true, 7);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        vm.expectEmit(true, true, false, true, address(resolver));
        emit VerdictSubmitted(0, true, tee.addr, instructionId);

        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);
    }

    /// Relaying is deliberately permissionless: the signature, not msg.sender,
    /// is what authorises the verdict.
    function test_SubmitVerdict_MayBeRelayedByAnyone() public {
        bytes32 instructionId = keccak256("instruction-anyone");
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        vm.prank(makeAddr("a complete stranger"));
        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);

        assertEq(escrow.heldBalance(), 0);
    }

    /// tee-node signs via go-ethereum's crypto.Sign, whose recovery id is 0/1
    /// rather than Ethereum's conventional 27/28. Both must be accepted.
    function test_SubmitVerdict_AcceptsGoEthereumRecoveryId() public {
        bytes32 instructionId = keccak256("instruction-recid");
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        // Rewrite the trailing v from 27/28 down to go-ethereum's 0/1.
        sig[64] = bytes1(uint8(sig[64]) - 27);

        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);
        assertEq(escrow.heldBalance(), 0, "a 0/1 recovery id must verify identically");
    }

    function test_SubmitVerdict_FalseOutcomeKeepsFundsLocked() public {
        bytes32 instructionId = keccak256("instruction-false");
        bytes memory data = _verdictData(0, false, 2);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        uint256 redeemed = resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);

        assertEq(redeemed, 0);
        assertEq(assetManager.redeemCallCount(), 0, "a false verdict must not redeem");
        assertEq(escrow.heldBalance(), ONE_LOT, "funds stay locked");
    }

    // --- forgery ------------------------------------------------------

    /// The headline claim. A structurally perfect verdict signed by anybody
    /// other than the registered TEE must be refused.
    function test_RevertWhen_SignedByImpostor() public {
        bytes32 instructionId = keccak256("instruction-forged");
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(impostor, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        vm.expectRevert("signature does not match registered TEE");
        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);

        assertEq(escrow.heldBalance(), ONE_LOT, "forged verdict must not move funds");
    }

    /// Flipping the outcome after the TEE signed it must invalidate it.
    function test_RevertWhen_VerdictDataTamperedAfterSigning() public {
        bytes32 instructionId = keccak256("instruction-tamper");
        bytes memory signedData = _verdictData(0, false, 1);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, signedData);

        bytes memory tamperedData = _verdictData(0, true, 1); // false -> true

        vm.expectRevert("signature does not match registered TEE");
        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, tamperedData, sig);

        assertEq(escrow.heldBalance(), ONE_LOT);
    }

    /// Retargeting a genuine verdict at a different escrow must fail too.
    function test_RevertWhen_VerdictRetargetedAtAnotherEscrow() public {
        vm.prank(buyer);
        escrow.fund(keccak256("second escrow"), XRPL_ADDRESS, ONE_LOT);

        bytes32 instructionId = keccak256("instruction-retarget");
        bytes memory signedData = _verdictData(0, true, 1);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, signedData);

        bytes memory retargeted = _verdictData(1, true, 1); // escrow 0 -> escrow 1

        vm.expectRevert("signature does not match registered TEE");
        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, retargeted, sig);
    }

    function test_RevertWhen_InstructionIdTampered() public {
        bytes32 instructionId = keccak256("instruction-original");
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        vm.expectRevert("signature does not match registered TEE");
        resolver.submitVerdict(tee.addr, keccak256("some-other-id"), SUBMISSION_TAG, STATUS_SUCCESS, data, sig);
    }

    function test_RevertWhen_SubmissionTagTampered() public {
        bytes32 instructionId = keccak256("instruction-tag");
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        vm.expectRevert("signature does not match registered TEE");
        resolver.submitVerdict(tee.addr, instructionId, "end", STATUS_SUCCESS, data, sig);
    }

    function test_RevertWhen_SignatureLengthIsWrong() public {
        bytes32 instructionId = keccak256("instruction-shortsig");
        bytes memory data = _verdictData(0, true, 1);

        vm.expectRevert("bad signature length");
        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, hex"deadbeef");
    }

    /// An unregistered teeId has no public key, so nothing can recover to it.
    function test_RevertWhen_TeeIsNotRegisteredAtAll() public {
        Vm.Wallet memory ghost = vm.createWallet("unregistered");
        machineManager.register(ghost.addr, bytes32(0), bytes32(0), WARDEN_EXTENSION_ID);

        bytes32 instructionId = keccak256("instruction-ghost");
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(ghost, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        vm.expectRevert("signature does not match registered TEE");
        resolver.submitVerdict(ghost.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);
    }

    // --- replay & scope -------------------------------------------------

    /// A genuine verdict must be usable exactly once.
    function test_RevertWhen_VerdictIsReplayed() public {
        bytes32 instructionId = keccak256("instruction-replay");
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);

        vm.expectRevert("verdict already submitted");
        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);

        assertEq(assetManager.redeemCallCount(), 1, "replay must not trigger a second redemption");
    }

    /// A real, correctly signed verdict from a TEE registered under somebody
    /// else's extension must not be usable here.
    function test_RevertWhen_TeeBelongsToAnotherExtension() public {
        Vm.Wallet memory foreignTee = vm.createWallet("another-project-tee");
        machineManager.register(
            foreignTee.addr, bytes32(foreignTee.publicKeyX), bytes32(foreignTee.publicKeyY), OTHER_EXTENSION_ID
        );

        bytes32 instructionId = keccak256("instruction-foreign");
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(foreignTee, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        vm.expectRevert("teeId not in our extension");
        resolver.submitVerdict(foreignTee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);
    }

    /// status != 1 means the TEE handler never actually produced a ruling.
    function test_RevertWhen_TeeReportedFailureStatus() public {
        bytes32 instructionId = keccak256("instruction-failed");
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(tee, instructionId, SUBMISSION_TAG, 0, data);

        vm.expectRevert("TEE result was not a success");
        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, 0, data, sig);
    }

    // --- fuzz ----------------------------------------------------------

    /// No private key other than the TEE's own can produce an accepted verdict.
    function testFuzz_OnlyTheRegisteredTeeKeyCanRule(uint256 wrongKey) public {
        wrongKey = bound(wrongKey, 1, type(uint128).max);
        vm.assume(vm.addr(wrongKey) != tee.addr);

        Vm.Wallet memory forger = vm.createWallet(wrongKey);
        bytes32 instructionId = keccak256(abi.encodePacked("fuzz", wrongKey));
        bytes memory data = _verdictData(0, true, 1);
        bytes memory sig = _sign(forger, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data);

        vm.expectRevert("signature does not match registered TEE");
        resolver.submitVerdict(tee.addr, instructionId, SUBMISSION_TAG, STATUS_SUCCESS, data, sig);

        assertEq(escrow.heldBalance(), ONE_LOT, "no forged key may ever move funds");
    }
}
