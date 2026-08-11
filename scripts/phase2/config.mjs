// Shared constants for Phase 2 (Happy Path) scripts.
//
// Reuses pure constants/ABIs/helpers from ../config.mjs (Task 1) and
// ../escrow/config.mjs (Phase 1) by import only. State is kept in its own
// state.phase2.json so this work never collides with the other two
// workstreams' state files.
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

// Web2Json attestation type. Distinct verifier path from Task 1/Phase 1's
// XRP-sourced attestations — Web2Json has its own dedicated verifier
// deployment rather than being nested under a per-chain source. Confirmed
// empirically + against flare-foundation/flare-foundry-starter's
// script/fdcExample/Web2Json.s.sol (the rendered docs don't spell this path
// out explicitly, so this one's worth trusting the raw source over prose).
export const WEB2JSON_ATTESTATION_TYPE = "Web2Json";
export const WEB2JSON_SOURCE_ID = "PublicWeb2";
export const WEB2JSON_VERIFIER_PATH = "/verifier/web2/Web2Json/prepareRequest";

// IWeb2Json.Response ABI tuple, used to decode the DA Layer's raw
// response_hex. Field order/types verified verbatim against
// flare-solidity-periphery-package-mirror/coston2/IWeb2Json.sol.
export const WEB2JSON_RESPONSE_TUPLE = `tuple(
  bytes32 attestationType,
  bytes32 sourceId,
  uint64 votingRound,
  uint64 lowestUsedTimestamp,
  tuple(
    string url,
    string httpMethod,
    string headers,
    string queryParams,
    string body,
    string postProcessJq,
    string abiSignature
  ) requestBody,
  tuple(bytes abiEncodedData) responseBody
)`;

export const FDC_VERIFICATION_WEB2JSON_ABI = [
  "function verifyWeb2Json(tuple(bytes32[] merkleProof, tuple(bytes32 attestationType, bytes32 sourceId, uint64 votingRound, uint64 lowestUsedTimestamp, tuple(string url, string httpMethod, string headers, string queryParams, string body, string postProcessJq, string abiSignature) requestBody, tuple(bytes abiEncodedData) responseBody) data) _proof) external view returns (bool)",
];

// Weather condition for this demo: current temperature at a location,
// queried live via Open-Meteo (free, no API key, no signup — see PHASE2.md
// for why this beat every flight-status API researched). Fixed-point x100
// (Celsius x100) since Solidity has no floats, matching the pattern used by
// Flare's own official weather-insurance example (developer-hub
// docs/fdc/guides/foundry/06-weather-insurance.mdx), which scales by 1e6 for
// lat/lon and temperature — x100 is enough precision for a temperature
// threshold and keeps the numbers easy to eyeball while debugging.
export const WEATHER_LATITUDE = 25.2048;
export const WEATHER_LONGITUDE = 55.2708; // Dubai — reliably hot, good for a "heat wave" happy-path demo
export const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";

export function buildWeatherQueryParams() {
  return {
    latitude: String(WEATHER_LATITUDE),
    longitude: String(WEATHER_LONGITUDE),
    current: "temperature_2m",
  };
}

// No floor/round/trunc builtin is in the FDC's allowed jq subset (confirmed
// empirically — both "round" and "floor" were rejected as INVALID JQ FILTER
// despite Flare's own official weather-insurance guide using "floor", which
// suggests that guide is stale against the current allow-list). Sidesteps
// the whole issue with string concatenation instead of arithmetic: Open-Meteo's
// current.temperature_2m always has exactly one decimal digit, so
// "33.9" -> split(".") -> ["33","9"] -> "339" + "0" -> 3390, entirely via
// tostring/split/tonumber, all explicitly on the allowed builtins list.
export const WEATHER_POST_PROCESS_JQ = '(.current.temperature_2m | tostring | split(".") | .[0] + .[1] + "0" | tonumber)';
export const WEATHER_ABI_SIGNATURE = "int256";

// AssetManager ABI subset needed to resolve fAsset() for the escrow
// constructor arg — same pattern as Phase 1's escrow/config.mjs.
export const ASSET_MANAGER_ABI = [
  "function fAsset() external view returns (address)",
  "function lotSize() external view returns (uint256)",
];

export const PHASE2_STATE_PATH = new URL("../../state.phase2.json", import.meta.url);

export async function loadPhase2State() {
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(PHASE2_STATE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function savePhase2State(patch) {
  const fs = await import("node:fs/promises");
  const current = await loadPhase2State();
  const next = { ...current, ...patch };
  await fs.writeFile(PHASE2_STATE_PATH, JSON.stringify(next, null, 2));
  return next;
}
