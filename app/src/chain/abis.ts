// Minimal human-readable ABI fragments — field order/types copied verbatim
// from the working Node reference scripts (scripts/phase2/*.mjs,
// scripts/phase3/*.mjs) and the deployed-address ABI dumps in
// state.phase2.json / state.phase3.json, plus the live FlareTeeManager facet
// ABIs pulled from the fce-extension-scaffold Go module cache
// (go-flare-common's machinemanager.abi / verification.abi).

export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export const ASSET_MANAGER_ABI = [
  'function fAsset() view returns (address)',
  'function lotSize() view returns (uint256)',
];

export const CONTRACT_REGISTRY_ABI = ['function getContractAddressByName(string) view returns (address)'];

// WardenEscrow.sol — shared by both Phase 2 and Phase 3 deployments.
export const WARDEN_ESCROW_ABI = [
  'function getEscrow(uint256) view returns (tuple(bytes32 conditionId, address buyer, address beneficiary, string beneficiaryXrplAddress, uint256 amount, uint8 status, uint64 fundedAt))',
  'function nextEscrowId() view returns (uint256)',
  'function heldBalance() view returns (uint256)',
  'function resolver() view returns (address)',
  'function fund(bytes32 conditionId, string beneficiaryXrplAddress, uint256 amount) returns (uint256 escrowId)',
  'event EscrowFunded(uint256 indexed escrowId, bytes32 indexed conditionId, address indexed buyer, string beneficiaryXrplAddress, uint256 amount)',
  'event EscrowReleased(uint256 indexed escrowId, string beneficiaryXrplAddress, uint256 redeemedAmountUBA)',
  'event EscrowResolved(uint256 indexed escrowId, bool outcome)',
];

export const WARDEN_DISPUTE_RESOLVER_ABI = [
  'function expectedExtensionId() view returns (uint256)',
  'function consumedInstructionIds(bytes32) view returns (bool)',
  'function submitVerdict(address teeId, bytes32 instructionId, string submissionTag, uint8 status, bytes data, bytes signature) returns (uint256)',
  'event VerdictSubmitted(uint256 indexed escrowId, bool outcome, address indexed teeId, bytes32 instructionId)',
];

export const WARDEN_WEATHER_RESOLVER_ABI = [
  'function conditions(uint256) view returns (int256 thresholdTemperatureCx100, bool triggerIfAbove, bool set)',
];

// IMachineManager facet of the FlareTeeManager diamond.
export const MACHINE_MANAGER_ABI = [
  'function getTeeMachine(address) view returns (tuple(address teeId, address teeProxyId, string url))',
  'function getTeeMachineStatus(address) view returns (uint8)',
  'function getPublicKey(address) view returns (tuple(bytes32 x, bytes32 y))',
  'function getExtensionId(address) view returns (uint256)',
  'function getRandomTeeIds(uint256 extensionId, uint256 count) view returns (address[])',
];

export const INSTRUCTION_SENDER_ABI = ['function sendRuleOnEvidence(bytes) payable'];

// Verification facet of the FlareTeeManager diamond — TeeInstructionsSent is
// emitted here (not by the InstructionSender itself) whenever any
// InstructionSender routes an instruction through sendInstructions().
export const TEE_VERIFICATION_ABI = [
  'event TeeInstructionsSent(uint256 indexed extensionId, bytes32 indexed instructionId, uint32 indexed rewardEpochId, tuple(address teeId, address teeProxyId, string url)[] teeMachines, bytes32 opType, bytes32 opCommand, bytes message, address[] cosigners, uint64 cosignersThreshold, address claimBackAddress, uint256 fee)',
];

// TeeStatus enum ordinal -> label. Only ordinal 2 = PRODUCTION is confirmed
// (TASK2.md: "getTeeMachineStatus(teeId) returns 2" for the live production
// machine) — other ordinals are shown as a raw number rather than guessed at.
export function teeStatusLabel(status: number): string {
  if (status === 2) return 'PRODUCTION';
  if (status === 0) return 'UNREGISTERED';
  return `STATUS ${status}`;
}
