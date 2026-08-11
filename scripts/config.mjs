import "dotenv/config";

export const env = process.env;

// Well-known Flare contract registry address — identical on every Flare-family
// network (mainnet, Songbird, Coston, Coston2). Everything else is resolved
// through it at runtime rather than hardcoded, per Flare's own guidance.
export const CONTRACT_REGISTRY_ADDRESS = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";

export const CONTRACT_REGISTRY_ABI = [
  "function getContractAddressByName(string calldata _name) external view returns (address)",
];

export const FDC_HUB_ABI = [
  "function requestAttestation(bytes calldata _data) external payable",
  "event AttestationRequest(bytes data, uint256 fee)",
];

export const FDC_REQUEST_FEE_CONFIGURATIONS_ABI = [
  "function getRequestFee(bytes calldata _data) external view returns (uint256)",
];

export const FDC_VERIFICATION_ABI = [
  "function fdcProtocolId() external view returns (uint8)",
  "function relay() external view returns (address)",
  "function verifyPayment(tuple(bytes32[] merkleProof, tuple(bytes32 attestationType, bytes32 sourceId, uint64 votingRound, uint64 lowestUsedTimestamp, tuple(bytes32 transactionId, uint256 inUtxo, uint256 utxo) requestBody, tuple(uint64 blockNumber, uint64 blockTimestamp, bytes32 sourceAddressHash, bytes32 sourceAddressesRoot, bytes32 receivingAddressHash, bytes32 intendedReceivingAddressHash, int256 spentAmount, int256 intendedSpentAmount, int256 receivedAmount, int256 intendedReceivedAmount, bytes32 standardPaymentReference, bool oneToOne, uint8 status) responseBody) data) _proof) external view returns (bool)",
];

export const RELAY_ABI = [
  "function isFinalized(uint256 _protocolId, uint256 _votingRoundId) external view returns (bool)",
];

// IPayment.Response ABI tuple type, used to decode the DA Layer's raw proof response.
// Field order/types verified verbatim against flare-solidity-periphery-package-mirror/coston2/IPayment.sol.
export const PAYMENT_RESPONSE_TUPLE = `tuple(
  bytes32 attestationType,
  bytes32 sourceId,
  uint64 votingRound,
  uint64 lowestUsedTimestamp,
  tuple(bytes32 transactionId, uint256 inUtxo, uint256 utxo) requestBody,
  tuple(
    uint64 blockNumber,
    uint64 blockTimestamp,
    bytes32 sourceAddressHash,
    bytes32 sourceAddressesRoot,
    bytes32 receivingAddressHash,
    bytes32 intendedReceivingAddressHash,
    int256 spentAmount,
    int256 intendedSpentAmount,
    int256 receivedAmount,
    int256 intendedReceivedAmount,
    bytes32 standardPaymentReference,
    bool oneToOne,
    uint8 status
  ) responseBody
)`;

// Documented constants for computing the FDC voting round ID from a block timestamp.
// Source: https://dev.flare.network/fdc/guides/fdc-by-hand (worked Coston2 example).
export const FIRST_VOTING_ROUND_START_TS = 1658430000;
export const VOTING_EPOCH_DURATION_SECONDS = 90;

export const ATTESTATION_TYPE = "Payment";
export const SOURCE_ID = "testXRP";
export const VERIFIER_URL_TYPE = "xrp";

export function toUtf8HexString(data) {
  let result = "";
  for (let i = 0; i < data.length; i++) {
    result += data.charCodeAt(i).toString(16);
  }
  return "0x" + result.padEnd(64, "0");
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const STATE_PATH = new URL("../state.json", import.meta.url);

export async function loadState() {
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(STATE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function saveState(patch) {
  const fs = await import("node:fs/promises");
  const current = await loadState();
  const next = { ...current, ...patch };
  await fs.writeFile(STATE_PATH, JSON.stringify(next, null, 2));
  return next;
}
