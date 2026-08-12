// Client-side handoff for the real dispute pipeline (Submit Evidence -> TEE
// polling -> submit verdict on-chain -> verdict display), which spans
// several distinct routed pages (full component remounts). sessionStorage is
// used purely as plumbing to carry live-obtained instruction/verdict data
// between those pages within one browser tab/session — nothing here is
// baked seed data, it's only ever written right after a real transaction or
// a real TEE poll result.
import type { RuleOnEvidenceRequest, TeeVerdict } from './writes';

export interface PendingDisputeState {
  escrowId: string; // app-level route id
  onChainEscrowId: number;
  instructionId: string;
  instructionTxHash: string;
  teeId: string;
  request: RuleOnEvidenceRequest;
  submittedAtUnix: number;
}

export interface ResolvedDisputeState {
  escrowId: string;
  teeId: string;
  instructionId: string;
  instructionTxHash: string;
  verdict: TeeVerdict;
  verdictTxHash?: string;
}

const pendingKey = (escrowId: string) => `warden.pendingDispute.${escrowId}`;
const resolvedKey = (escrowId: string) => `warden.resolvedDispute.${escrowId}`;

export function savePendingDispute(state: PendingDisputeState) {
  sessionStorage.setItem(pendingKey(state.escrowId), JSON.stringify(state));
}

export function loadPendingDispute(escrowId: string): PendingDisputeState | null {
  const raw = sessionStorage.getItem(pendingKey(escrowId));
  return raw ? (JSON.parse(raw) as PendingDisputeState) : null;
}

export function saveResolvedDispute(state: ResolvedDisputeState) {
  sessionStorage.setItem(resolvedKey(state.escrowId), JSON.stringify(state));
}

export function loadResolvedDispute(escrowId: string): ResolvedDisputeState | null {
  const raw = sessionStorage.getItem(resolvedKey(escrowId));
  return raw ? (JSON.parse(raw) as ResolvedDisputeState) : null;
}
