import type { DisputeRecord, Escrow, EvidenceSubmission, ContractInfo } from '../types';

export interface IEscrowService {
  getEscrow(id: string): Promise<Escrow>;
  listEscrows(): Promise<Escrow[]>;
  /** Phase 2 happy-path: FDC-verified condition -> generic release entry point */
  resolveAndRelease(id: string): Promise<{ txHash: string; amount: number }>;
  /** Phase 3 dispute-path: ECIES-encrypted evidence submitted to the live TEE */
  submitEvidence(id: string, evidence: EvidenceSubmission): Promise<void>;
  /** Phase 3 dispute-path: TEE verdict + on-chain signature verification record */
  getDispute(id: string): Promise<DisputeRecord>;
  /** Contracts + TEE artifacts shown on the Proof & Transparency panel */
  listContracts(): Promise<ContractInfo[]>;
}
