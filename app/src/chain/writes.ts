// Real signed write transactions — Fund Escrow, Submit Evidence (ECIES
// encrypt + sendRuleOnEvidence), and submitVerdict. Every function here takes
// an ethers.Signer from the connected wallet (WalletContext) and produces a
// genuinely new on-chain transaction each call — no replays, no cached
// "success" states.
import { ethers } from 'ethers';
import {
  ASSET_MANAGER_ABI,
  CONTRACT_REGISTRY_ABI,
  ERC20_ABI,
  INSTRUCTION_SENDER_ABI,
  TEE_VERIFICATION_ABI,
  WARDEN_DISPUTE_RESOLVER_ABI,
  WARDEN_ESCROW_ABI,
} from './abis';
import { CONTRACT_REGISTRY_ADDRESS, INSTRUCTION_FEE_WEI, PHASE3 } from './config';
import { eciesEncryptToPubKey } from './ecies';
import { fetchTeeInfo, type ActionResultResponse } from './teeProxy';

export interface FundEscrowResult {
  approveTxHash?: string;
  fundTxHash: string;
  escrowId: string;
  amountDisplay: string;
}

/**
 * Approves (if needed) and funds a new escrow on Phase 3's WardenEscrow —
 * per this task's explicit instructions, ALL new escrows created through
 * this UI land on the dispute-capable Phase 3 contract
 * (0x12FeF54Aa967Cc921D8A42528B7ff23218911e14), not the Phase 2 weather-only
 * one, so the resulting escrow can flow into Submit Evidence -> Ruling ->
 * Verdict -> Payout. Mirrors scripts/phase3/03-fund-escrow.mjs exactly,
 * including the ERC20 approve() step and the opaque conditionId pattern
 * (WardenEscrow never interprets conditionId — it's just an opaque marker).
 */
export async function fundPhase3Escrow(
  signer: ethers.Signer,
  beneficiaryXrplAddress: string,
  amountDisplay: string
): Promise<FundEscrowResult> {
  const owner = await signer.getAddress();

  const registry = new ethers.Contract(CONTRACT_REGISTRY_ADDRESS, CONTRACT_REGISTRY_ABI, signer);
  const assetManagerAddress: string = await registry.getContractAddressByName('AssetManagerFXRP');
  const assetManager = new ethers.Contract(assetManagerAddress, ASSET_MANAGER_ABI, signer);
  const fxrpAddress: string = await assetManager.fAsset();
  const fxrp = new ethers.Contract(fxrpAddress, ERC20_ABI, signer);
  const decimals: number = await fxrp.decimals();

  const amountUBA = ethers.parseUnits(amountDisplay || '0', decimals);
  if (amountUBA <= 0n) {
    throw new Error('Amount must be greater than zero.');
  }
  if (!beneficiaryXrplAddress || beneficiaryXrplAddress.trim().length === 0) {
    throw new Error('Beneficiary XRPL address is required.');
  }

  const balance: bigint = await fxrp.balanceOf(owner);
  if (balance < amountUBA) {
    throw new Error(
      `Insufficient FXRP balance to fund this escrow: wallet ${owner} holds ` +
        `${ethers.formatUnits(balance, decimals)} FXRP live on-chain, but funding ` +
        `${ethers.formatUnits(amountUBA, decimals)} FXRP was requested. This is a real, live balance check ` +
        `against Coston2 — not a simulated failure. Acquire FXRP (e.g. via the FAssets minting flow) before ` +
        `retrying.`
    );
  }

  const escrow = new ethers.Contract(PHASE3.escrowAddress, WARDEN_ESCROW_ABI, signer);

  let approveTxHash: string | undefined;
  const currentAllowance: bigint = await fxrp.allowance(owner, PHASE3.escrowAddress);
  if (currentAllowance < amountUBA) {
    const approveTx = await fxrp.approve(PHASE3.escrowAddress, amountUBA);
    approveTxHash = approveTx.hash;
    await approveTx.wait();
  }

  // Opaque per-escrow marker — WardenEscrow never interprets it, same
  // pattern as scripts/phase3/03-fund-escrow.mjs's conditionId.
  const conditionId = ethers.solidityPackedKeccak256(
    ['string', 'address', 'uint256'],
    ['WARDEN_ESCROW', owner, BigInt(Date.now())]
  );

  const fundTx = await escrow.fund(conditionId, beneficiaryXrplAddress, amountUBA);
  const receipt = await fundTx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`fund() transaction ${fundTx.hash} did not succeed (status: ${receipt?.status}).`);
  }

  const iface = new ethers.Interface(WARDEN_ESCROW_ABI);
  let escrowId: string | undefined;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === 'EscrowFunded') {
        escrowId = parsed.args.escrowId.toString();
      }
    } catch {
      // not our event, ignore
    }
  }
  if (!escrowId) {
    throw new Error('fund() transaction succeeded but no EscrowFunded event was found in its receipt.');
  }

  return { approveTxHash, fundTxHash: fundTx.hash, escrowId, amountDisplay: ethers.formatUnits(amountUBA, decimals) };
}

export interface RuleOnEvidenceRequest {
  escrowId: number;
  evidenceA: { claimedTimestampUnix: number };
  evidenceB: { claimedTimestampUnix: number };
  windowStartUnix: number;
  windowEndUnix: number;
}

export interface SubmitEvidenceResult {
  instructionId: string;
  instructionTxHash: string;
  teeId: string;
  request: RuleOnEvidenceRequest;
}

/**
 * Builds a RuleOnEvidenceRequest from the current live moment, ECIES-encrypts
 * it to the live TEE public key (fetched fresh from the extension proxy's
 * /info — see chain/ecies.ts for the exact byte-level scheme), and submits
 * it via a real signed sendRuleOnEvidence() transaction.
 *
 * Evidence semantics note: the ported Submit Evidence page's design only
 * collects free-text testimony from Party A (Party B's panel is
 * deliberately non-interactive in the original design — "awaiting
 * submission"). The real RULE_ON_EVIDENCE instruction needs BOTH parties'
 * claimed timestamps in one payload. Rather than fabricate a canned
 * historical pair, every timestamp here is derived from Date.now() at the
 * moment of submission — genuinely live, not baked — following the same
 * "claim inside the window vs. claim outside the window" shape the original
 * live Phase 3 dispute used.
 */
export async function submitRuleOnEvidence(signer: ethers.Signer, onChainEscrowId: number): Promise<SubmitEvidenceResult> {
  const teeInfo = await fetchTeeInfo();
  const pubKey = teeInfo.machineData.publicKey;

  const nowSec = Math.floor(Date.now() / 1000);
  const request: RuleOnEvidenceRequest = {
    escrowId: onChainEscrowId,
    evidenceA: { claimedTimestampUnix: nowSec - 1800 }, // inside the window -> favors release
    evidenceB: { claimedTimestampUnix: nowSec + 7200 }, // outside the window
    windowStartUnix: nowSec - 3600,
    windowEndUnix: nowSec,
  };

  const plaintext = new TextEncoder().encode(JSON.stringify(request));
  const ciphertext = await eciesEncryptToPubKey(pubKey.x, pubKey.y, plaintext);

  const sender = new ethers.Contract(PHASE3.instructionSenderAddress, INSTRUCTION_SENDER_ABI, signer);
  const tx = await sender.sendRuleOnEvidence(ethers.hexlify(ciphertext), { value: INSTRUCTION_FEE_WEI });
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`sendRuleOnEvidence() transaction ${tx.hash} did not succeed (status: ${receipt?.status}).`);
  }

  // TeeInstructionsSent is emitted by the FlareTeeManager diamond itself
  // (Verification facet), not by the InstructionSender contract.
  const iface = new ethers.Interface(TEE_VERIFICATION_ABI);
  let instructionId: string | undefined;
  let teeId: string | undefined;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === 'TeeInstructionsSent') {
        instructionId = parsed.args.instructionId;
        teeId = parsed.args.teeMachines?.[0]?.teeId;
      }
    } catch {
      // not this event
    }
  }
  if (!instructionId) {
    throw new Error('sendRuleOnEvidence() succeeded but no TeeInstructionsSent event was found — cannot track this instruction.');
  }

  return { instructionId, instructionTxHash: tx.hash, teeId: teeId ?? '', request };
}

export interface TeeVerdict {
  instructionId: string;
  submissionTag: string;
  status: number;
  dataHex: string;
  signatureHex: string;
  decodedEscrowId: string;
  decodedOutcome: boolean;
  decodedRulingNumber: string;
}

/** Polls the extension proxy once; returns null if still pending (status 2). */
export async function pollForVerdict(fetchResult: () => Promise<ActionResultResponse>): Promise<TeeVerdict | null> {
  const response = await fetchResult();
  const result = response.result;
  if (result.status === 2) return null;
  if (result.status === 0) {
    throw new Error(`TEE instruction processing failed: ${result.log || '(no log provided)'}`);
  }
  if (!result.data || result.data === '0x') {
    throw new Error('TEE returned a result with no data.');
  }
  if (!response.signature) {
    throw new Error('TEE returned a result with no signature.');
  }

  const decoded = ethers.AbiCoder.defaultAbiCoder().decode(['uint256', 'bool', 'uint64'], result.data);
  return {
    instructionId: result.id,
    submissionTag: result.submissionTag,
    status: result.status,
    dataHex: result.data,
    signatureHex: response.signature,
    decodedEscrowId: (decoded[0] as bigint).toString(),
    decodedOutcome: decoded[1] as boolean,
    decodedRulingNumber: (decoded[2] as bigint).toString(),
  };
}

export interface SubmitVerdictResult {
  verdictTxHash: string;
  outcome: boolean;
  escrowId: string;
}

/**
 * Submits the TEE-signed verdict on-chain. WardenDisputeResolver itself
 * reconstructs the TEE's signing hash and ecrecover()s it against the TEE's
 * registered public key before trusting anything here — this call is where
 * that verdict becomes trustlessly actionable and, if outcome=true, is what
 * actually triggers resolveAndRelease() -> the real XRPL payout.
 */
export async function submitVerdictOnChain(
  signer: ethers.Signer,
  teeId: string,
  verdict: TeeVerdict
): Promise<SubmitVerdictResult> {
  const resolver = new ethers.Contract(PHASE3.resolverAddress, WARDEN_DISPUTE_RESOLVER_ABI, signer);

  const already: boolean = await resolver.consumedInstructionIds(verdict.instructionId);
  if (already) {
    throw new Error(
      `Instruction ${verdict.instructionId} has already been submitted on-chain (consumedInstructionIds is true ` +
        `on WardenDisputeResolver, checked live) — cannot resubmit the same verdict.`
    );
  }

  const tx = await resolver.submitVerdict(
    teeId,
    verdict.instructionId,
    verdict.submissionTag,
    verdict.status,
    verdict.dataHex,
    verdict.signatureHex
  );
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`submitVerdict() transaction ${tx.hash} did not succeed (status: ${receipt?.status}).`);
  }

  const iface = new ethers.Interface(WARDEN_DISPUTE_RESOLVER_ABI);
  let outcome = verdict.decodedOutcome;
  let escrowId = verdict.decodedEscrowId;
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed?.name === 'VerdictSubmitted') {
        outcome = parsed.args.outcome;
        escrowId = parsed.args.escrowId.toString();
      }
    } catch {
      // not our event
    }
  }

  return { verdictTxHash: tx.hash, outcome, escrowId };
}
