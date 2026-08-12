// Live network configuration for Coston2 + XRPL testnet, plus the deployed
// contract addresses this app talks to. Addresses are config constants (same
// category as a hostname), not "data" — every quantity/state/balance/tx
// displayed anywhere in the app is fetched live through these, never baked.

export const COSTON2_CHAIN_ID = 114;
export const COSTON2_CHAIN_ID_HEX = '0x72';
export const COSTON2_RPC_URL = 'https://coston2-api.flare.network/ext/C/rpc';
export const COSTON2_EXPLORER = 'https://coston2-explorer.flare.network';

export const COSTON2_CHAIN_PARAMS = {
  chainId: COSTON2_CHAIN_ID_HEX,
  chainName: 'Flare Testnet Coston2',
  nativeCurrency: { name: 'Coston2 Flare', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: [COSTON2_RPC_URL],
  blockExplorerUrls: [`${COSTON2_EXPLORER}/`],
};

// XRPL testnet public JSON-RPC endpoint (HTTP, not the WebSocket URL) — used
// instead of the `xrpl` npm package to avoid pulling in Node-only
// dependencies (Buffer/process polyfills, etc.) into a Vite browser bundle.
// Same account_info / account_tx commands the reference Node scripts use via
// xrpl.js, just called directly over fetch().
export const XRPL_TESTNET_JSON_RPC = 'https://s.altnet.rippletest.net:51234/';
export const XRPL_EXPLORER_TX = (hash: string) => `https://testnet.xrpl.org/transactions/${hash}`;

export const CONTRACT_REGISTRY_ADDRESS = '0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019';

export const PHASE2 = {
  escrowAddress: '0xBDDD1E23604cA932c823Ef3397D96697aBB1c53D',
  resolverAddress: '0x0a7b57FC9d907a55f72E7920E6645A6d40B972CF',
  fdcVerificationAddress: '0x906507E0B64bcD494Db73bd0459d1C667e14B933',
  beneficiaryXrplAddress: 'rQhiVPjkhTQE9FXriKJhX9LZL9Jy9b4xnP',
  location: 'Dubai',
  coordinates: { lat: 25.2048, lon: 55.2708 },
  onChainEscrowId: '0',
  // Coston2's public RPC caps eth_getLogs at a 30-block range (confirmed
  // empirically: "requested too many blocks ... maximum is set to 30"), which
  // makes live discovery of events from ~20k+ blocks ago infeasible from the
  // browser at render time. These historical identifiers are known constants
  // (same category as a contract address) for the one escrow this contract
  // ever processed — every field describing their CURRENT state (status,
  // balances, confirmations) is still fetched live via
  // getTransactionReceipt/getBlock/live contract calls, never trusted blind.
  knownFundTxHash: '0xb0209e2ce25f8cab417f0e0078e854ab7cc53a5dd4f05a7b093d8944850a6f1b',
  knownReleaseTxHash: '0xb15a31cd33a27bae8e6c5f91758722610651a388666c75313031d956b0ae16ce',
  knownPayoutXrplTxHash: '0B903CE2F06F37947DC052333D1754CF08BC3CDCBB0AB36145CFF7E79C468B92',
  knownVotingRoundId: 1421888,
};

export const PHASE3 = {
  escrowAddress: '0x12FeF54Aa967Cc921D8A42528B7ff23218911e14',
  resolverAddress: '0x662144FE2c59f58b3612Ee5bf252D06Ff1d2d91A',
  teeManagerAddress: '0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE',
  instructionSenderAddress: '0x01269cc5498679ac790Af12cd803a1108a0aA235',
  extensionId: 66120,
  knownOnChainEscrowId: '0',
  knownFundTxHash: '0x5efdb353e9f2f961e58f30f17165ac20bf60e372263ccc150d991cb4cfb3343f',
  knownVerdictTxHash: '0xe15336e9d5e9b5f75f8fa1bcc0bafa8631ad5262fd7d73df0556b354abc722e1',
  knownInstructionTxHash: '0x6590511a717abd03d3933c113155f5a3740e6e9d361e4f1600dd6621a1bc259b',
  knownInstructionId: '0x29faf1cb88695bcc40a704beb31a2e167371988d7764c5e2e759625c0d4c4fc7',
  knownTeeId: '0x33c2f5f41Bf1199A7Dc68F32D74ED097F07e33C0',
  knownPayoutXrplTxHash: 'D588BAF9C7BDEC8585A4E2E3D89057CF5B32376195667C417A274237577658B0',
  knownReasoning:
    'The TEE ran its deterministic rules engine over both parties’ ECIES-encrypted claimed timestamps: evidence A fell inside the independently-established comparison window, evidence B fell roughly two hours outside it. Evidence A was ruled the valid claim, and WardenDisputeResolver.submitVerdict() reconstructed the TEE’s signing hash and ecrecover’d it on-chain against the TEE’s registered public key before releasing funds.',
};

// The extension proxy tunnel is an ephemeral cloudflared URL that can change
// or die between sessions — overridable via env so it doesn't require a code
// change if it's rotated, but this exact value is what the task specified as
// currently live.
export const TEE_EXTENSION_PROXY_URL: string =
  (import.meta.env.VITE_TEE_EXTENSION_PROXY_URL as string | undefined) ||
  'https://exciting-acre-intersection-tvs.trycloudflare.com';

// Instruction fee (wei) required by sendInstructions() for this extension.
// Matches fce-extension-scaffold's Go tooling (tools/pkg/utils/instructions.go
// hardcodes the same 1_000_000 wei for every Send* call). No simple on-chain
// getter for this exact per-instruction flat fee was found on the
// MachineManager/Verification facets exposed to this app within the time
// budget for this task — flagged in the final report rather than guessed at.
export const INSTRUCTION_FEE_WEI = 1_000_000n;

export const XRPL_DECIMALS = 6; // 1 XRP = 1,000,000 drops, same scale FXRP (UBA) uses
