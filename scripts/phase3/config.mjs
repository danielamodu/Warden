// Shared constants for Phase 3 (Dispute Path Integration) scripts.
//
// Reuses pure constants/ABIs/helpers from ../config.mjs (Task 1) and
// ../escrow/config.mjs (Phase 1's direct-minting flow) by import only.
// State is kept in its own state.phase3.json so this work never collides
// with the other phases' state files, and uses ESCROW_DEPLOYER_PRIVATE_KEY
// (same wallet Phase 1/2 used for escrow-side work) to avoid nonce races
// with the FCE-side wallet used by Task 2's Go tooling.
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
import {
  XRP_PAYMENT_ATTESTATION_TYPE,
  XRP_SOURCE_ID,
  VERIFIER_URL_TYPE,
  ASSET_MANAGER_ABI as DIRECT_MINTING_ASSET_MANAGER_ABI,
  FDC_VERIFICATION_XRP_ABI,
  XRP_PAYMENT_RESPONSE_TUPLE,
  buildDirectMintingMemo,
} from "../escrow/config.mjs";

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
  XRP_PAYMENT_ATTESTATION_TYPE,
  XRP_SOURCE_ID,
  VERIFIER_URL_TYPE,
  // Direct-minting-focused subset (executeDirectMinting, fee getters) —
  // what 01-mint-fxrp.mjs needs. Distinct from the redemption-focused
  // ASSET_MANAGER_ABI below (same pattern as Phase 2's config.mjs, which
  // also keeps its own separate minimal AssetManager ABI rather than
  // reusing escrow/config.mjs's minting-only one).
  DIRECT_MINTING_ASSET_MANAGER_ABI,
  FDC_VERIFICATION_XRP_ABI,
  XRP_PAYMENT_RESPONSE_TUPLE,
  buildDirectMintingMemo,
};

// Redemption-focused AssetManager ABI subset — what 02-deploy-contracts.mjs
// and 03-fund-escrow.mjs need (lotSize() for exact-lot funding amounts).
export const ASSET_MANAGER_ABI = [
  "function fAsset() external view returns (address)",
  "function lotSize() external view returns (uint256)",
];

// FlareTeeManager diamond — same live address Task 2's whole session ran
// against (redeployed 2026-07-22, confirmed live via cast throughout).
// Not resolvable via IFlareContractRegistry the way FDC contracts are (it's
// a separate protocol surface), so this is passed into
// WardenDisputeResolver's constructor rather than looked up on-chain.
export const FLARE_TEE_MANAGER_ADDRESS = "0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE";

// Task 2's live extension — WardenDisputeResolver checks any submitted
// teeId belongs to this extension before trusting its signature.
export const WARDEN_EXTENSION_ID = 66120n; // 0x10248

export const PHASE3_STATE_PATH = new URL("../../state.phase3.json", import.meta.url);

export async function loadPhase3State() {
  try {
    const fs = await import("node:fs/promises");
    const raw = await fs.readFile(PHASE3_STATE_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function savePhase3State(patch) {
  const fs = await import("node:fs/promises");
  const current = await loadPhase3State();
  const next = { ...current, ...patch };
  await fs.writeFile(PHASE3_STATE_PATH, JSON.stringify(next, null, 2));
  return next;
}
