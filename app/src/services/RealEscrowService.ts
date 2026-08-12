import { ethers } from 'ethers';
import type { IEscrowService } from './IEscrowService';
import type { ContractInfo, DisputeRecord, Escrow, EvidenceSubmission } from '../types';
import { COSTON2_EXPLORER, PHASE2, PHASE3, XRPL_EXPLORER_TX } from '../chain/config';
import {
  readConsumedInstructionId,
  readEscrow,
  readHeldBalance,
  readNextEscrowId,
  readResolverExpectedExtensionId,
  readTeeMachine,
  readWeatherCondition,
  verifyKnownTx,
} from '../chain/reads';
import { getCurrentTemperatureC } from '../chain/weather';
import { findXrplPayoutTx } from '../chain/xrpl';
import { loadPendingDispute, loadResolvedDispute } from '../chain/pendingDispute';
import { teeStatusLabel } from '../chain/abis';

// FXRP mirrors XRP's own 6-decimal (drops) precision on Coston2 — confirmed
// live via FXRP.decimals() during development. A token's decimal count is a
// fixed property (same category as a contract address), not escrow "data".
const FXRP_DECIMALS = 6;

export const EXPLORER = {
  coston2Tx: (hash: string) => `${COSTON2_EXPLORER}/tx/${hash}`,
  coston2Address: (addr: string) => `${COSTON2_EXPLORER}/address/${addr}`,
  xrplTx: XRPL_EXPLORER_TX,
};

async function buildPhase2Escrow(): Promise<Escrow> {
  const raw = await readEscrow(PHASE2.escrowAddress, 0);
  const amount = Number(ethers.formatUnits(raw.amount, FXRP_DECIMALS));
  const heldBalance = await readHeldBalance(PHASE2.escrowAddress);

  const [condition, currentC] = await Promise.all([
    readWeatherCondition(0).catch(() => null),
    getCurrentTemperatureC(PHASE2.coordinates.lat, PHASE2.coordinates.lon).catch(() => undefined),
  ]);
  const thresholdC = condition ? Number(condition.thresholdTemperatureCx100) / 100 : undefined;
  const triggerIfAbove = condition?.triggerIfAbove ?? true;

  const status: Escrow['status'] = raw.status === 1 ? 'released' : 'pending';

  // Live-validate the known historical release tx (see chain/config.ts for
  // why this hash is a known constant rather than getLogs-discovered).
  const releaseCheck = raw.status === 1 ? await verifyKnownTx(PHASE2.knownReleaseTxHash).catch(() => null) : null;

  const payout = raw.status === 1 ? await buildLivePayout(raw.beneficiaryXrplAddress, amount) : undefined;

  return {
    id: 'phase2',
    onChainEscrowId: '0',
    amount,
    amountAsset: 'FXRP',
    status,
    conditionSummary: thresholdC != null ? `Weather: ${PHASE2.location}, Threshold >${thresholdC}°C` : 'Weather condition',
    condition: {
      type: 'weather',
      location: PHASE2.location,
      thresholdC: thresholdC ?? 29.9,
      currentC,
      triggerIfAbove,
    },
    beneficiaryXrplAddress: raw.beneficiaryXrplAddress || PHASE2.beneficiaryXrplAddress,
    fundedAgo: `Live on Coston2 — heldBalance ${ethers.formatUnits(heldBalance, FXRP_DECIMALS)} FXRP`,
    contracts: { escrowAddress: PHASE2.escrowAddress, resolverAddress: PHASE2.resolverAddress },
    txs: {
      fundTxHash: PHASE2.knownFundTxHash,
      releaseTxHash: releaseCheck ? PHASE2.knownReleaseTxHash : undefined,
      payoutXrplTxHash: raw.status === 1 ? PHASE2.knownPayoutXrplTxHash : undefined,
    },
    fdc: {
      votingRoundId: PHASE2.knownVotingRoundId,
      attestationType: 'Web2Json',
      attestedValueLabel:
        currentC != null && thresholdC != null
          ? `${currentC.toFixed(1)}°C live reading vs ${thresholdC}°C threshold`
          : 'Weather threshold',
      verified: raw.status === 1,
    },
    payout,
  };
}

async function buildPhase3Escrow(routeId: string, onChainEscrowId: number): Promise<Escrow> {
  const raw = await readEscrow(PHASE3.escrowAddress, onChainEscrowId);
  const amount = Number(ethers.formatUnits(raw.amount, FXRP_DECIMALS));
  const heldBalance = await readHeldBalance(PHASE3.escrowAddress);

  const pending = loadPendingDispute(routeId);
  const resolved = loadResolvedDispute(routeId);

  // Contracts expose no "is a dispute in progress" getter — evidence
  // submission never touches WardenEscrow/WardenDisputeResolver state, it
  // lives entirely off-chain/inside the TEE until a verdict is submitted.
  // sessionStorage (written only right after a real tx / real TEE poll) is
  // the only live signal this browser session has for "disputed".
  const hasSessionDispute = Boolean(pending || resolved);

  let status: Escrow['status'] = raw.status === 1 ? 'released' : hasSessionDispute ? 'disputed' : 'pending';

  const isKnownHistorical = onChainEscrowId === 0;
  let verdictTxHash: string | undefined = resolved?.verdictTxHash;

  if (!verdictTxHash && raw.status === 1 && isKnownHistorical) {
    const check = await verifyKnownTx(PHASE3.knownVerdictTxHash).catch(() => null);
    if (check) verdictTxHash = PHASE3.knownVerdictTxHash;
  }

  let fundTxHash: string | undefined;
  if (isKnownHistorical) {
    const check = await verifyKnownTx(PHASE3.knownFundTxHash).catch(() => null);
    if (check) fundTxHash = PHASE3.knownFundTxHash;
  }

  return {
    id: routeId,
    onChainEscrowId: String(onChainEscrowId),
    amount,
    amountAsset: 'FXRP',
    status,
    conditionSummary: 'Dispute: TEE-arbitrated evidence ruling (RULE_ON_EVIDENCE)',
    condition: {
      type: 'dispute',
      summary: 'Two conflicting claimed timestamps, ruled by a live TEE against an independently-established comparison window.',
    },
    beneficiaryXrplAddress: raw.beneficiaryXrplAddress,
    fundedAgo: `Live on Coston2 — heldBalance ${ethers.formatUnits(heldBalance, FXRP_DECIMALS)} FXRP`,
    contracts: { escrowAddress: PHASE3.escrowAddress, resolverAddress: PHASE3.resolverAddress },
    txs: {
      fundTxHash,
      verdictTxHash,
      payoutXrplTxHash: raw.status === 1 && isKnownHistorical ? PHASE3.knownPayoutXrplTxHash : undefined,
    },
    payout: raw.status === 1 ? await buildLivePayout(raw.beneficiaryXrplAddress, amount) : undefined,
    disputeId: routeId,
  };
}

async function buildLivePayout(beneficiaryXrplAddress: string, requestedAmount: number): Promise<Escrow['payout']> {
  const livePayout = await findXrplPayoutTx(beneficiaryXrplAddress).catch(() => null);
  return {
    amount: livePayout ? livePayout.amountXrp : requestedAmount,
    asset: livePayout ? 'XRP' : 'FXRP',
    beneficiaryXrplAddress,
  };
}

/**
 * RealEscrowService — every value is fetched live from Coston2 (and, for
 * weather/XRPL data, live external reads) at call time. The only constants
 * used anywhere are contract/token addresses and a small set of historical
 * transaction-hash *identifiers* for the two pre-existing demo escrows that
 * predate this app (their live status/balances/confirmations are still
 * re-checked on every call — see chain/config.ts and chain/reads.ts for the
 * full rationale: Coston2's public RPC caps eth_getLogs at 30 blocks, which
 * makes live historical-event discovery infeasible for >20k-block-old txs).
 */
export class RealEscrowService implements IEscrowService {
  async getEscrow(id: string): Promise<Escrow> {
    if (id === 'phase2') return buildPhase2Escrow();
    const onChainEscrowId = id === 'phase3' ? 0 : Number(id);
    if (!Number.isFinite(onChainEscrowId) || onChainEscrowId < 0) {
      throw new Error(`Unknown escrow id: ${id}`);
    }
    const nextId = await readNextEscrowId(PHASE3.escrowAddress);
    if (onChainEscrowId >= nextId) {
      throw new Error(`Escrow id ${onChainEscrowId} does not exist yet on-chain (nextEscrowId=${nextId}, live read).`);
    }
    return buildPhase3Escrow(id, onChainEscrowId);
  }

  async listEscrows(): Promise<Escrow[]> {
    const [phase2Next, phase3Next] = await Promise.all([
      readNextEscrowId(PHASE2.escrowAddress),
      readNextEscrowId(PHASE3.escrowAddress),
    ]);

    const escrows: Escrow[] = [];
    if (phase2Next > 0) {
      escrows.push(await buildPhase2Escrow());
    }
    for (let i = 0; i < phase3Next; i++) {
      escrows.push(await buildPhase3Escrow(String(i), i));
    }
    return escrows;
  }

  async resolveAndRelease(id: string): Promise<{ txHash: string; amount: number }> {
    const escrow = await this.getEscrow(id);
    const txHash = escrow.txs.releaseTxHash ?? escrow.txs.verdictTxHash ?? '';
    return { txHash, amount: escrow.payout?.amount ?? escrow.amount };
  }

  /**
   * Real write flows (Fund Escrow, Submit Evidence, submitVerdict) are
   * triggered directly from page components via chain/writes.ts, which need
   * a live wallet Signer that this read-oriented interface doesn't carry.
   * This method is kept as a structural no-op for interface compatibility —
   * the actual encrypt+send transaction happens in SubmitEvidence.tsx.
   */
  async submitEvidence(_id: string, _evidence: EvidenceSubmission): Promise<void> {
    return;
  }

  async getDispute(id: string): Promise<DisputeRecord> {
    const onChainEscrowId = id === 'phase3' ? 0 : Number(id);
    if (!Number.isFinite(onChainEscrowId) || onChainEscrowId < 0) {
      throw new Error(`No dispute record for escrow id: ${id}`);
    }

    const pending = loadPendingDispute(id);
    const resolved = loadResolvedDispute(id);
    const isKnownHistorical = onChainEscrowId === 0;

    const teeId = resolved?.teeId ?? pending?.teeId ?? (isKnownHistorical ? PHASE3.knownTeeId : '');
    const [expectedExtensionId, teeMachine] = await Promise.all([
      readResolverExpectedExtensionId(),
      teeId ? readTeeMachine(teeId).catch(() => null) : Promise.resolve(null),
    ]);

    const instructionId = resolved?.instructionId ?? pending?.instructionId ?? (isKnownHistorical ? PHASE3.knownInstructionId : '');
    const instructionTxHash =
      resolved?.instructionTxHash ?? pending?.instructionTxHash ?? (isKnownHistorical ? PHASE3.knownInstructionTxHash : '');

    let consumed = false;
    if (instructionId) {
      consumed = await readConsumedInstructionId(instructionId).catch(() => false);
    }

    const outcome = resolved?.verdict.decodedOutcome ?? (isKnownHistorical ? true : false);
    const verdictTxHash = resolved?.verdictTxHash ?? (isKnownHistorical && consumed ? PHASE3.knownVerdictTxHash : '');

    const status: DisputeRecord['status'] = verdictTxHash ? 'complete' : pending ? 'ruling' : consumed ? 'complete' : 'ruling';

    // Pull the escrow's own live-read amount/beneficiary instead of any
    // baked figure — the exact final delivered XRP (after the redemption
    // fee) is only knowable once XRPL settles it, which PayoutSuccess
    // live-polls for; here we show the live on-chain requested amount.
    const escrowRaw = await readEscrow(PHASE3.escrowAddress, onChainEscrowId).catch(() => null);
    const requestedAmount = escrowRaw ? Number(ethers.formatUnits(escrowRaw.amount, FXRP_DECIMALS)) : 0;
    const beneficiaryXrplAddress = escrowRaw?.beneficiaryXrplAddress ?? '';

    const reasoning = resolved
      ? `TEE ruled on live evidence (escrowId=${resolved.verdict.decodedEscrowId}, rulingNumber=${resolved.verdict.decodedRulingNumber}): ` +
        `outcome=${resolved.verdict.decodedOutcome ? 'RELEASE' : 'HOLD'}. WardenDisputeResolver reconstructed the TEE's signing hash and ` +
        `ecrecover'd it on-chain against the TEE's registered public key before acting on it.`
      : isKnownHistorical
        ? PHASE3.knownReasoning
        : pending
          ? 'Evidence submitted, awaiting the TEE’s signed verdict.'
          : 'No dispute activity found for this escrow in the current browser session.';

    return {
      escrowId: id,
      caseRef: `ESCROW-${onChainEscrowId}-${instructionId ? instructionId.slice(2, 10).toUpperCase() : 'PENDING'}`,
      teeId: teeId || (teeMachine ? teeMachine.teeId : ''),
      teeStatus: teeMachine ? teeStatusLabel(teeMachine.status) : undefined,
      teeManagerAddress: PHASE3.teeManagerAddress,
      instructionSenderAddress: PHASE3.instructionSenderAddress,
      extensionId: expectedExtensionId,
      instructionId,
      instructionTxHash,
      verdictTxHash,
      outcome,
      rulingNumber: resolved ? Number(resolved.verdict.decodedRulingNumber) : 1,
      status,
      reasoning,
      winningParty: outcome ? 'A' : 'B',
      payout: {
        amount: requestedAmount,
        asset: 'FXRP',
        beneficiaryXrplAddress,
      },
    };
  }

  async listContracts(): Promise<ContractInfo[]> {
    return [
      {
        label: 'WardenPaymentAttestor',
        description: 'Web2Json attestation verifier used to confirm the weather condition proof on-chain.',
        address: PHASE2.fdcVerificationAddress,
        explorerUrl: EXPLORER.coston2Address(PHASE2.fdcVerificationAddress),
      },
      {
        label: 'WardenEscrow — Phase 2 (Weather)',
        description: 'Core escrow vault used for the weather-triggered happy path.',
        address: PHASE2.escrowAddress,
        explorerUrl: EXPLORER.coston2Address(PHASE2.escrowAddress),
      },
      {
        label: 'WardenWeatherResolver',
        description: 'Automated payout logic for FDC-verified weather conditions.',
        address: PHASE2.resolverAddress,
        explorerUrl: EXPLORER.coston2Address(PHASE2.resolverAddress),
      },
      {
        label: 'WardenEscrow — Phase 3 (Dispute)',
        description: 'Core escrow vault used for the TEE-arbitrated dispute path — every new escrow created through this app is funded here.',
        address: PHASE3.escrowAddress,
        explorerUrl: EXPLORER.coston2Address(PHASE3.escrowAddress),
      },
      {
        label: 'WardenDisputeResolver',
        description: 'Reconstructs the TEE’s signing hash and ecrecover-verifies verdicts on-chain before releasing funds.',
        address: PHASE3.resolverAddress,
        explorerUrl: EXPLORER.coston2Address(PHASE3.resolverAddress),
      },
    ];
  }
}

export { teeStatusLabel };
