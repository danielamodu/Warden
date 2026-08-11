// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Minimal, self-contained interfaces — same discipline as
// WardenWeatherResolver.sol and WardenPaymentAttestor.sol: no external
// dependency to install/compile.

interface IMachineManager {
    /// @notice The TEE machine's registered secp256k1 public key, as
    /// (X, Y) — field order/types match
    /// go-flare-common/pkg/contracts/tee/machinemanager (getPublicKey,
    /// selector 0x857cdbb8) on the live FlareTeeManager diamond.
    function getPublicKey(address _teeId) external view returns (bytes32 x, bytes32 y);

    /// @notice Which extension a given teeId is registered under.
    function getExtensionId(address _teeId) external view returns (uint256);
}

interface IWardenEscrow {
    function resolveAndRelease(uint256 escrowId, bool outcome) external returns (uint256);
}

/// @title WardenDisputeResolver — Phase 3's dispute-arbitration path.
/// @notice Everything dispute-specific lives here, deliberately kept out of
/// WardenEscrow: verifying that a verdict really came from Warden's own live
/// TEE extension, and decoding what it ruled. All this contract does with
/// WardenEscrow is call its one generic entry point,
/// resolveAndRelease(escrowId, outcome) — same as WardenWeatherResolver does
/// for the happy path. The escrow contract itself needed zero changes.
///
/// Trust model: this contract does NOT trust whoever calls submitVerdict().
/// It reconstructs the exact hash tee-node signs internally
/// (ActionResult.Hash(), wrapped in signing.Payload{TEE_ACTION_RESULT,
/// chainId, ...}, EIP-191-prefixed — see tee-node's internal/router/utils.go
/// and go-flare-common/pkg/signing/hash.go) and ecrecover's the caller-
/// supplied signature against it, then checks the recovered address against
/// the TEE's own on-chain-registered public key. A caller can submit any
/// verdict bytes they like; only ones that recover to the real, registered
/// TEE's address are ever accepted.
contract WardenDisputeResolver {
    // keccak256 of this string is never taken directly — mustStringBytes32
    // in go-flare-common right-pads the UTF-8 bytes to 32, which is exactly
    // what a bytes32 string literal does in Solidity too.
    bytes32 public constant TEE_ACTION_RESULT_PREFIX = bytes32("TEE_ACTION_RESULT");

    IWardenEscrow public immutable escrow;
    IMachineManager public immutable machineManager;

    /// @notice The extension ID a submitted teeId must belong to. Sanity
    /// check, not a trust boundary by itself — the signature check is what
    /// actually proves authenticity — but it stops an otherwise-valid
    /// signature from some *other* live extension's TEE from being replayed
    /// here.
    uint256 public immutable expectedExtensionId;

    /// @notice instructionId -> consumed, so the exact same signed verdict
    /// can't be replayed to resolve a different call (or drain gas by
    /// resubmission) — WardenEscrow's own "already resolved" check covers
    /// double-spending the same escrowId, this covers the instructionId
    /// itself.
    mapping(bytes32 => bool) public consumedInstructionIds;

    event VerdictSubmitted(uint256 indexed escrowId, bool outcome, address indexed teeId, bytes32 instructionId);

    constructor(address _escrow, address _machineManager, uint256 _expectedExtensionId) {
        require(_escrow != address(0), "escrow = 0");
        require(_machineManager != address(0), "machineManager = 0");
        escrow = IWardenEscrow(_escrow);
        machineManager = IMachineManager(_machineManager);
        expectedExtensionId = _expectedExtensionId;
    }

    /// @notice Submits a TEE-signed RULE_ON_EVIDENCE verdict and, once its
    /// signature verifies against the real registered TEE, releases (or
    /// doesn't) the escrow it names. Anyone can call this — the signature
    /// check is the access control, not msg.sender.
    /// @param teeId The TEE machine address that (claims to have) produced
    ///        this ActionResult — the id field the extension proxy's /info
    ///        and /action/result responses key on.
    /// @param instructionId ActionResult.id — echoed from the original
    ///        instruction, used here purely for replay protection.
    /// @param submissionTag ActionResult.submissionTag ("submit", "end", or
    ///        "threshold" — whatever tee-node's ActionResponse reported).
    /// @param status ActionResult.status. Must be 1 (handler succeeded) —
    ///        anything else means the TEE never actually ruled.
    /// @param data ActionResult.data — abi.encode(uint256 escrowId, bool
    ///        outcome, uint64 rulingNumber), exactly what
    ///        processRuleOnEvidence in the Go extension produces.
    /// @param signature ActionResponse.signature — the TEE's own signature
    ///        over the result, fetched off-chain from the extension proxy's
    ///        /action/result/<instructionId>.
    function submitVerdict(
        address teeId,
        bytes32 instructionId,
        string calldata submissionTag,
        uint8 status,
        bytes calldata data,
        bytes calldata signature
    ) external returns (uint256 redeemedAmountUBA) {
        require(status == 1, "TEE result was not a success");
        require(!consumedInstructionIds[instructionId], "verdict already submitted");
        require(machineManager.getExtensionId(teeId) == expectedExtensionId, "teeId not in our extension");

        // 1. ActionResult.Hash() = keccak256(keccak256(data) || id ||
        //    keccak256(submissionTag) || status) — tee-node/pkg/types/actions.go.
        bytes32 dataHash = keccak256(data);
        bytes32 tagHash = keccak256(bytes(submissionTag));
        bytes32 actionResultHash = keccak256(abi.encodePacked(dataHash, instructionId, tagHash, status));

        // 2. signing.Payload{TEE_ACTION_RESULT, chainId, actionResultHash}.Hash()
        //    = keccak256(abi.encode(prefix, chainId, dataHash)) —
        //    go-flare-common/pkg/signing/hash.go. chainId is uint256 there
        //    (big.Int), matching Solidity's native uint256.
        bytes32 payloadHash = keccak256(abi.encode(TEE_ACTION_RESULT_PREFIX, block.chainid, actionResultHash));

        // 3. tee-node signs accounts.TextHash(payloadHash), i.e. the standard
        //    EIP-191 "\x19Ethereum Signed Message:\n32" prefix —
        //    tee-node/pkg/utils/crypto.go.
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payloadHash));

        address recovered = _recoverSigner(ethSignedHash, signature);

        // 4. Compare against the TEE's own registered public key, derived
        //    into an address the same way any secp256k1 pubkey is: keccak256
        //    of the 64-byte uncompressed X||Y, low 20 bytes.
        (bytes32 x, bytes32 y) = machineManager.getPublicKey(teeId);
        address teeAddress = address(uint160(uint256(keccak256(abi.encodePacked(x, y)))));
        require(recovered == teeAddress, "signature does not match registered TEE");

        consumedInstructionIds[instructionId] = true;

        (uint256 escrowId, bool outcome, ) = abi.decode(data, (uint256, bool, uint64));

        emit VerdictSubmitted(escrowId, outcome, teeId, instructionId);

        redeemedAmountUBA = escrow.resolveAndRelease(escrowId, outcome);
    }

    function _recoverSigner(bytes32 hash, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "bad signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        // forge-lint: disable-next-line(asm-keccak256)
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        // tee-node/pkg/utils/crypto.go signs with go-ethereum's crypto.Sign,
        // whose recovery id is 0/1, not Ethereum's conventional 27/28.
        if (v < 27) {
            v += 27;
        }
        return ecrecover(hash, v, r, s);
    }
}
