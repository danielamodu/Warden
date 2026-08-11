// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// TODO: Replace local interfaces with imports from flare-smart-contracts-v2 once published as a package.
import { ITeeExtensionRegistry } from "./interfaces/ITeeExtensionRegistry.sol";
import { ITeeMachineRegistry } from "./interfaces/ITeeMachineRegistry.sol";

/// @title HelloWorldInstructionSender
/// @author Flare Foundation
/// @notice Hello World example — on-chain entry point for sending instructions to the TEE.
///
/// DO NOT MODIFY: constructor, setExtensionId(), _getExtensionId()
contract HelloWorldInstructionSender {
    /// @notice Operation type for greeting actions (SAY_HELLO, SAY_GOODBYE).
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_TYPE_GREETING = bytes32("GREETING");

    /// @notice Command for the SAY_HELLO action.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_SAY_HELLO = bytes32("SAY_HELLO");

    /// @notice Command for the SAY_GOODBYE action.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_SAY_GOODBYE = bytes32("SAY_GOODBYE");

    /// @notice Operation type for the threshold-check action (CHECK_GREATER_THAN_10).
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_TYPE_THRESHOLD = bytes32("THRESHOLD");

    /// @notice Command for the CHECK_GREATER_THAN_10 action.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_CHECK_GREATER_THAN_10 = bytes32("CHECK_GREATER_THAN_10");

    /// @notice Operation type for the dispute-arbitration action (RULE_ON_EVIDENCE).
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_TYPE_DISPUTE = bytes32("DISPUTE");

    /// @notice Command for the RULE_ON_EVIDENCE action.
    // forge-lint: disable-next-line(unsafe-typecast)
    bytes32 public constant OP_COMMAND_RULE_ON_EVIDENCE = bytes32("RULE_ON_EVIDENCE");

    /// @notice Reference to the TEE extension registry contract.
    ITeeExtensionRegistry public immutable TEE_EXTENSION_REGISTRY;
    /// @notice Reference to the TEE machine registry contract.
    ITeeMachineRegistry public immutable TEE_MACHINE_REGISTRY;

    /// @notice First public extension ID. The registry reserves IDs below this
    /// for system/reserved extensions; public extensions are assigned from here up.
    uint256 private constant FIRST_PUBLIC_EXTENSION_ID = 0x10000; // 65536

    uint256 private _extensionId;

    /// @notice Payload for the SAY_GOODBYE instruction.
    struct SayGoodbyeMessage {
        string name;
        string reason;
    }

    /// @notice Initializes the contract with registry addresses.
    /// @param _teeExtensionRegistry Address of the TEE extension registry.
    /// @param _teeMachineRegistry Address of the TEE machine registry.
    constructor(
        ITeeExtensionRegistry _teeExtensionRegistry,
        ITeeMachineRegistry _teeMachineRegistry
    ) {
        require(address(_teeExtensionRegistry) != address(0), "TeeExtensionRegistry cannot be zero address");
        require(address(_teeMachineRegistry) != address(0), "TeeMachineRegistry cannot be zero address");
        require(address(_teeExtensionRegistry).code.length > 0, "TeeExtensionRegistry has no code");
        require(address(_teeMachineRegistry).code.length > 0, "TeeMachineRegistry has no code");
        TEE_EXTENSION_REGISTRY = _teeExtensionRegistry;
        TEE_MACHINE_REGISTRY = _teeMachineRegistry;
    }

    /// @notice Finds and sets this contract's extension id. Can only be set once.
    /// DO NOT MODIFY this function.
    function setExtensionId() external {
        require(_extensionId == 0, "Extension ID already set.");

        uint256 c = TEE_EXTENSION_REGISTRY.nextPublicExtensionId();
        for (uint256 i = FIRST_PUBLIC_EXTENSION_ID; i < c; ++i) {
            if (TEE_EXTENSION_REGISTRY.getTeeExtensionInstructionsSender(i) == address(this)) {
                _extensionId = i;
                return;
            }
        }
        revert("Extension ID not found.");
    }

    /// @notice Sends a SAY_HELLO instruction to the TEE.
    /// @param _message JSON-encoded payload (e.g. {"name": "Alice"}).
    function sendSayHello(bytes calldata _message) external payable {
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_GREETING,
            opCommand: OP_COMMAND_SAY_HELLO,
            message: _message,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });


        TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(
            teeIds,
            params
        );
    }

    /// @notice Sends a SAY_GOODBYE instruction to the TEE.
    /// @param _name The name of the person to say goodbye to.
    /// @param _reason The reason for saying goodbye.
    function sendSayGoodbye(string calldata _name, string calldata _reason) external payable {
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_GREETING,
            opCommand: OP_COMMAND_SAY_GOODBYE,
            message: abi.encode(SayGoodbyeMessage({name: _name, reason: _reason})),
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(
            teeIds,
            params
        );
    }

    /// @notice Sends a CHECK_GREATER_THAN_10 instruction to the TEE.
    /// @param _encryptedValue The input value, JSON-encoded as {"value": N} and
    ///        then ECIES-encrypted to the TEE's public key by the caller *before*
    ///        this call. Only ciphertext ever appears in this transaction's
    ///        calldata — the raw value is decrypted solely inside the enclave via
    ///        the TEE node's local /decrypt endpoint, and only the boolean
    ///        verdict is ever returned. This is what keeps the raw input off the
    ///        public chain: the plaintext exists only off-chain (in the caller's
    ///        memory before encryption) and inside the enclave (after decryption).
    function sendCheckGreaterThan10(bytes calldata _encryptedValue) external payable {
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_THRESHOLD,
            opCommand: OP_COMMAND_CHECK_GREATER_THAN_10,
            message: _encryptedValue,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(
            teeIds,
            params
        );
    }

    /// @notice Sends a RULE_ON_EVIDENCE instruction to the TEE.
    /// @param _encryptedEvidence A single JSON payload — {escrowId, evidenceA,
    ///        evidenceB, windowStartUnix, windowEndUnix} — ECIES-encrypted to
    ///        the TEE's public key by the caller *before* this call, exactly
    ///        like sendCheckGreaterThan10. Both parties' claimed timestamps
    ///        travel inside this single ciphertext; only the enclave ever
    ///        sees them in the clear. The verdict this produces is ABI-encoded
    ///        (not JSON, unlike the Hello World/threshold responses) so that
    ///        WardenDisputeResolver can decode it cheaply on-chain after
    ///        verifying the TEE's signature over it.
    function sendRuleOnEvidence(bytes calldata _encryptedEvidence) external payable {
        address[] memory teeIds = TEE_MACHINE_REGISTRY.getRandomTeeIds(_getExtensionId(), 1);
        address[] memory cosigners = new address[](0);

        ITeeExtensionRegistry.TeeInstructionParams memory params = ITeeExtensionRegistry.TeeInstructionParams({
            opType: OP_TYPE_DISPUTE,
            opCommand: OP_COMMAND_RULE_ON_EVIDENCE,
            message: _encryptedEvidence,
            cosigners: cosigners,
            cosignersThreshold: 0,
            claimBackAddress: msg.sender
        });

        TEE_EXTENSION_REGISTRY.sendInstructions{value: msg.value}(
            teeIds,
            params
        );
    }

    /// @notice Returns the cached extension ID, reverting if not yet set.
    /// @return The extension ID assigned to this contract.
    function _getExtensionId() internal view returns (uint256) {
        require(_extensionId != 0, "Extension ID is not set.");
        return _extensionId;
    }
}
