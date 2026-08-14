// Live read-only contract calls — every function here is a fresh eth_call
// against Coston2 at invocation time, no caching beyond what the caller does
// per-render/per-poll.
import { ethers } from 'ethers';
import { MACHINE_MANAGER_ABI, WARDEN_DISPUTE_RESOLVER_ABI, WARDEN_ESCROW_ABI, WARDEN_WEATHER_RESOLVER_ABI } from './abis';
import { PHASE2, PHASE3 } from './config';
import { getReadProvider } from './provider';
import { fetchTeeInfo } from './teeProxy';

export interface RawEscrow {
  conditionId: string;
  buyer: string;
  beneficiary: string;
  beneficiaryXrplAddress: string;
  amount: bigint;
  status: number; // 0 = Unresolved, 1 = Resolved
  fundedAt: bigint;
}

function escrowContract(address: string) {
  return new ethers.Contract(address, WARDEN_ESCROW_ABI, getReadProvider());
}

export async function readEscrow(escrowAddress: string, onChainEscrowId: number): Promise<RawEscrow> {
  const contract = escrowContract(escrowAddress);
  const result = await contract.getEscrow(BigInt(onChainEscrowId));
  return {
    conditionId: result.conditionId,
    buyer: result.buyer,
    beneficiary: result.beneficiary,
    beneficiaryXrplAddress: result.beneficiaryXrplAddress,
    amount: result.amount,
    status: Number(result.status),
    fundedAt: result.fundedAt,
  };
}

export async function readNextEscrowId(escrowAddress: string): Promise<number> {
  const contract = escrowContract(escrowAddress);
  const next: bigint = await contract.nextEscrowId();
  return Number(next);
}

export async function readHeldBalance(escrowAddress: string): Promise<bigint> {
  const contract = escrowContract(escrowAddress);
  return contract.heldBalance();
}

export async function readWeatherCondition(
  escrowId: number
): Promise<{ thresholdTemperatureCx100: bigint; triggerIfAbove: boolean; set: boolean }> {
  const contract = new ethers.Contract(PHASE2.resolverAddress, WARDEN_WEATHER_RESOLVER_ABI, getReadProvider());
  const result = await contract.conditions(BigInt(escrowId));
  return {
    thresholdTemperatureCx100: result.thresholdTemperatureCx100,
    triggerIfAbove: result.triggerIfAbove,
    set: result.set,
  };
}

export async function readResolverExpectedExtensionId(): Promise<number> {
  const contract = new ethers.Contract(PHASE3.resolverAddress, WARDEN_DISPUTE_RESOLVER_ABI, getReadProvider());
  const id: bigint = await contract.expectedExtensionId();
  return Number(id);
}

export async function readConsumedInstructionId(instructionId: string): Promise<boolean> {
  const contract = new ethers.Contract(PHASE3.resolverAddress, WARDEN_DISPUTE_RESOLVER_ABI, getReadProvider());
  return contract.consumedInstructionIds(instructionId);
}

export interface LiveTeeMachine {
  teeId: string;
  teeProxyId: string;
  url: string;
  status: number;
  extensionId: number;
  publicKeyX: string;
  publicKeyY: string;
}

/**
 * The enclave that is live *right now*, rather than whichever one ruled some
 * past dispute. Confidential Space keys are memory-only, so every relaunch of
 * the TEE mints a fresh teeId and retires the previous one (see PHASE3.md) —
 * meaning a hardcoded id goes stale the first time the enclave restarts.
 *
 * Instead the id is derived from the public key the running enclave itself
 * serves on /info, using the same secp256k1 derivation WardenDisputeResolver
 * applies on-chain: address = last 20 bytes of keccak256(X || Y). Whatever
 * enclave is actually answering is therefore the one described here, and its
 * status is then read from FlareTeeManager.
 */
export async function readLiveTeeMachine(): Promise<LiveTeeMachine> {
  const info = await fetchTeeInfo();
  const { x, y } = info.teeInfo.publicKey;
  const teeId = ethers.getAddress(ethers.dataSlice(ethers.keccak256(ethers.concat([x, y])), 12));
  return readTeeMachine(teeId);
}

export async function readTeeMachine(teeId: string): Promise<LiveTeeMachine> {
  const contract = new ethers.Contract(PHASE3.teeManagerAddress, MACHINE_MANAGER_ABI, getReadProvider());
  const [machine, status, extensionId, pubKey] = await Promise.all([
    contract.getTeeMachine(teeId),
    contract.getTeeMachineStatus(teeId),
    contract.getExtensionId(teeId),
    contract.getPublicKey(teeId),
  ]);
  return {
    teeId: machine.teeId,
    teeProxyId: machine.teeProxyId,
    url: machine.url,
    status: Number(status),
    extensionId: Number(extensionId),
    publicKeyX: pubKey.x,
    publicKeyY: pubKey.y,
  };
}

/**
 * Live-validates a known historical transaction hash (see chain/config.ts
 * for why some historical identifiers are constants rather than
 * getLogs-discovered — Coston2's public RPC caps eth_getLogs at 30 blocks).
 * Returns null if the receipt can't be fetched (still surfaced as a real
 * live-check result, not assumed).
 */
export async function verifyKnownTx(
  hash: string
): Promise<{ status: number; blockNumber: number; timestamp: number } | null> {
  const provider = getReadProvider();
  const receipt = await provider.getTransactionReceipt(hash);
  if (!receipt) return null;
  const block = await provider.getBlock(receipt.blockNumber);
  return { status: receipt.status ?? 0, blockNumber: receipt.blockNumber, timestamp: block?.timestamp ?? 0 };
}
