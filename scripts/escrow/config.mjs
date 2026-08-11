// Shared constants for Phase 1 (Escrow Core) scripts.
//
// Reuses pure constants/ABIs/helpers from ../config.mjs (the Task 1 FDC
// round-trip config) by import only — never writes to it. State is kept in
// its own state.escrow.json at the project root so this work never touches
// the shared state.json that scripts/01-06 (concurrent Task 1 work) read and
// write. Likewise this uses ESCROW_DEPLOYER_PRIVATE_KEY, never
// COSTON2_PRIVATE_KEY, to avoid nonce collisions with that concurrent work.
import {
  env,
  CONTRACT_REGISTRY_ADDRESS,
  CONTRACT_REGISTRY_ABI,
  FDC_HUB_ABI,
  FDC_REQUEST_FEE_CONFIGURATIONS_ABI,
  RELAY_ABI,
  FIRST_VOTING_ROUND_START_TS,
  VOTING_EPOCH_DURATION_SECONDS,
  toUtf8HexString,
  sleep,
} from "../config.mjs";

export {
  env,
  CONTRACT_REGISTRY_ADDRESS,
  CONTRACT_REGISTRY_ABI,
  FDC_HUB_ABI,
  FDC_REQUEST_FEE_CONFIGURATIONS_ABI,
  RELAY_ABI,
  FIRST_VOTING_ROUND_START_TS,
  VOTING_EPOCH_DURATION_SECONDS,
  toUtf8HexString,
  sleep,
};

// FDC attestation type used by FAssets direct minting. Deliberately distinct
// from the generic "Payment" type (id 0x01) used in Task 1 — direct minting
// requires the XRPL-specific "XRPPayment" type (id 0x08), which has a
// different response shape (includes sourceAddress, memo, destination tag).
// Verified against flare-solidity-periphery-package-mirror/coston2/IXRPPayment.sol
// and flare-viem-starter's src/utils/fdc.ts (prepareXrpPaymentRequest).
export const XRP_PAYMENT_ATTESTATION_TYPE = "XRPPayment";
export const XRP_SOURCE_ID = "testXRP";
export const VERIFIER_URL_TYPE = "xrp";

// AssetManager ABI subset needed for direct minting + escrow funding.
// Field order/types verified verbatim against IAssetManager.sol, IDirectMinting.sol,
// IDirectMintingSettings.sol in flare-solidity-periphery-package-mirror/coston2.
export const ASSET_MANAGER_ABI = [
  "function fAsset() external view returns (address)",
  "function directMintingPaymentAddress() external view returns (string memory)",
  "function getDirectMintingExecutorFeeUBA() external view returns (uint256)",
  "function getDirectMintingFeeBIPS() external view returns (uint256)",
  "function getDirectMintingMinimumFeeUBA() external view returns (uint256)",
  "function getDirectMintingHourlyLimitUBA() external view returns (uint256)",
  "function getDirectMintingDailyLimitUBA() external view returns (uint256)",
  "function getDirectMintingsUnblockUntilTimestamp() external view returns (uint256)",
  "function getDirectMintingLargeMintingThresholdUBA() external view returns (uint256)",
  "function getDirectMintingLargeMintingDelaySeconds() external view returns (uint256)",
  "function executeDirectMinting(tuple(bytes32[] merkleProof, tuple(bytes32 attestationType, bytes32 sourceId, uint64 votingRound, uint64 lowestUsedTimestamp, tuple(bytes32 transactionId, address proofOwner) requestBody, tuple(uint64 blockNumber, uint64 blockTimestamp, string sourceAddress, bytes32 sourceAddressHash, bytes32 receivingAddressHash, bytes32 intendedReceivingAddressHash, int256 spentAmount, int256 intendedSpentAmount, int256 receivedAmount, int256 intendedReceivedAmount, bool hasMemoData, bytes firstMemoData, bool hasDestinationTag, uint256 destinationTag, uint8 status) responseBody) data) _payment) external payable",
  "event DirectMintingExecuted(bytes32 transactionId, address targetAddress, address executor, uint256 mintedAmountUBA, uint256 mintingFeeUBA, uint256 executorFeeUBA)",
  "event DirectMintingDelayed(bytes32 transactionId, uint256 amount, uint256 executionAllowedAt)",
  "event LargeDirectMintingDelayed(bytes32 transactionId, uint256 amount, uint256 executionAllowedAt)",
];

export const FDC_VERIFICATION_XRP_ABI = [
  "function fdcProtocolId() external view returns (uint8)",
  "function verifyXRPPayment(tuple(bytes32[] merkleProof, tuple(bytes32 attestationType, bytes32 sourceId, uint64 votingRound, uint64 lowestUsedTimestamp, tuple(bytes32 transactionId, address proofOwner) requestBody, tuple(uint64 blockNumber, uint64 blockTimestamp, string sourceAddress, bytes32 sourceAddressHash, bytes32 receivingAddressHash, bytes32 intendedReceivingAddressHash, int256 spentAmount, int256 intendedSpentAmount, int256 receivedAmount, int256 intendedReceivedAmount, bool hasMemoData, bytes firstMemoData, bool hasDestinationTag, uint256 destinationTag, uint8 status) responseBody) data) _proof) external view returns (bool)",
];

// IXRPPayment.Response ABI tuple, used to decode the DA Layer's raw
// response_hex for the XRPPayment attestation type. Field order/types
// verified verbatim against IXRPPayment.sol.
export const XRP_PAYMENT_RESPONSE_TUPLE = `tuple(
  bytes32 attestationType,
  bytes32 sourceId,
  uint64 votingRound,
  uint64 lowestUsedTimestamp,
  tuple(bytes32 transactionId, address proofOwner) requestBody,
  tuple(
    uint64 blockNumber,
    uint64 blockTimestamp,
    string sourceAddress,
    bytes32 sourceAddressHash,
    bytes32 receivingAddressHash,
    bytes32 intendedReceivingAddressHash,
    int256 spentAmount,
    int256 intendedSpentAmount,
    int256 receivedAmount,
    int256 intendedReceivedAmount,
    bool hasMemoData,
    bytes firstMemoData,
    bool hasDestinationTag,
    uint256 destinationTag,
    uint8 status
  ) responseBody
)`;

// Direct-minting memo prefix ("DIRECT_MINTING") — 32-byte memo format:
// [8-byte prefix][4-byte zero padding][20-byte recipient address].
// Verified against developer-hub docs/fassets/02-minting.mdx.
export const DIRECT_MINTING_PREFIX = "4642505266410018";

export function buildDirectMintingMemo(recipientAddress) {
  return DIRECT_MINTING_PREFIX + "00000000" + recipientAddress.slice(2).toLowerCase();
}

// Escrow-specific state file, kept separate from the shared ../../state.json
// (owned by the concurrent Task 1 work) so the two never collide.
export const ESCROW_STATE_PATH = new URL("../../state.escrow.json", import.meta.url);

export async function loadEscrowState() {
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(ESCROW_STATE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveEscrowState(patch) {
  const fs = await import("node:fs/promises");
  const current = await loadEscrowState();
  const next = { ...current, ...patch };
  await fs.writeFile(ESCROW_STATE_PATH, JSON.stringify(next, null, 2));
  return next;
}
