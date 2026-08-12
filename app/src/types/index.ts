// Core domain types for the Warden escrow protocol UI.
// These are shaped to satisfy the ported Superdesign components first;
// the service layer adapts real/mock data into this shape.

export type EscrowStatus = 'pending' | 'released' | 'disputed';

export interface WeatherCondition {
  type: 'weather';
  location: string;
  thresholdC: number;
  currentC?: number;
  triggerIfAbove: boolean;
}

export interface GenericCondition {
  type: 'delivery' | 'market' | 'oracle' | 'dispute';
  summary: string;
}

export type EscrowCondition = WeatherCondition | GenericCondition;

export interface EscrowContracts {
  escrowAddress: string;
  resolverAddress: string;
}

export interface EscrowTxRecord {
  approveTxHash?: string;
  fundTxHash?: string;
  releaseTxHash?: string;
  verdictTxHash?: string;
  payoutXrplTxHash?: string;
}

export interface FdcAttestation {
  votingRoundId: number;
  attestationType: string;
  attestedValueLabel: string;
  verified: boolean;
}

export interface PayoutInfo {
  amount: number;
  asset: string;
  beneficiaryXrplAddress: string;
  balanceBeforeXrp?: number;
  balanceAfterXrp?: number;
}

export interface Escrow {
  /** App-level route id, e.g. "phase2" | "phase3" */
  id: string;
  /** The on-chain escrowId inside the relevant WardenEscrow contract */
  onChainEscrowId: string;
  amount: number;
  amountAsset: string;
  status: EscrowStatus;
  conditionSummary: string;
  condition: EscrowCondition;
  beneficiaryXrplAddress: string;
  fundedAgo?: string;
  contracts: EscrowContracts;
  txs: EscrowTxRecord;
  fdc?: FdcAttestation;
  payout?: PayoutInfo;
  /** Present only for escrows resolved via the dispute path */
  disputeId?: string;
}

export interface EvidenceSubmission {
  escrowId: string;
  testimony: string;
  fileName?: string;
}

export type DisputePhaseStatus = 'complete' | 'active' | 'pending';

export interface DisputeRecord {
  escrowId: string;
  caseRef: string;
  teeId: string;
  /** Live-read from MachineManager.getTeeMachineStatus(teeId), e.g. "PRODUCTION". */
  teeStatus?: string;
  teeManagerAddress: string;
  instructionSenderAddress: string;
  extensionId: number;
  instructionId: string;
  instructionTxHash: string;
  verdictTxHash: string;
  outcome: boolean;
  rulingNumber: number;
  status: 'ruling' | 'complete';
  reasoning: string;
  winningParty: 'A' | 'B';
  payout: PayoutInfo;
}

export interface ContractInfo {
  label: string;
  description: string;
  address: string;
  explorerUrl: string;
}
