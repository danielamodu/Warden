import type { IEscrowService } from './IEscrowService';
import type { DisputeRecord, Escrow, EvidenceSubmission, ContractInfo } from '../types';
import { contracts as realContracts } from './realData';

// Illustrative mock data matching the Superdesign dashboard draft's sample
// rows. Used only when VITE_USE_MOCK_DATA=true, kept fully implemented for
// future UI iteration without needing real on-chain data.
const mockEscrows: Escrow[] = [
  {
    id: 'mock-1',
    onChainEscrowId: '1',
    amount: 10,
    amountAsset: 'XRP',
    status: 'pending',
    conditionSummary: 'Weather: Dubai, Threshold >29.9°C',
    condition: { type: 'weather', location: 'Dubai', thresholdC: 29.9, currentC: 27.1, triggerIfAbove: true },
    beneficiaryXrplAddress: 'rN7n7otQDd6FczFgLdlqtyMVrfNrVXXXXX',
    fundedAgo: '2 hours ago',
    contracts: { escrowAddress: '0x0000000000000000000000000000000000mock1', resolverAddress: '0x0000000000000000000000000000000000mres' },
    txs: {},
  },
  {
    id: 'mock-2',
    onChainEscrowId: '2',
    amount: 25.5,
    amountAsset: 'FXRP',
    status: 'released',
    conditionSummary: 'Delivery Confirmation, Signed',
    condition: { type: 'delivery', summary: 'Delivery Confirmation, Signed' },
    beneficiaryXrplAddress: 'rMockBeneficiary2XXXXXXXXXXXXXXXXX',
    fundedAgo: '4 hours ago',
    contracts: { escrowAddress: '0x0000000000000000000000000000000000mock2', resolverAddress: '0x0000000000000000000000000000000000mres' },
    txs: {},
  },
  {
    id: 'mock-3',
    onChainEscrowId: '3',
    amount: 100,
    amountAsset: 'XRP',
    status: 'pending',
    conditionSummary: 'API Oracle: BTC/USD above $45k',
    condition: { type: 'oracle', summary: 'API Oracle: BTC/USD above $45k' },
    beneficiaryXrplAddress: 'rMockBeneficiary3XXXXXXXXXXXXXXXXX',
    fundedAgo: '1 day ago',
    contracts: { escrowAddress: '0x0000000000000000000000000000000000mock3', resolverAddress: '0x0000000000000000000000000000000000mres' },
    txs: {},
  },
  {
    id: 'mock-4',
    onChainEscrowId: '4',
    amount: 50,
    amountAsset: 'FXRP',
    status: 'disputed',
    conditionSummary: 'IP Licensing: Royalty Split 60/40',
    condition: { type: 'dispute', summary: 'IP Licensing: Royalty Split 60/40' },
    beneficiaryXrplAddress: 'rMockBeneficiary4XXXXXXXXXXXXXXXXX',
    fundedAgo: '3 days ago',
    contracts: { escrowAddress: '0x0000000000000000000000000000000000mock4', resolverAddress: '0x0000000000000000000000000000000000mres' },
    txs: {},
    disputeId: 'mock-4',
  },
  {
    id: 'mock-5',
    onChainEscrowId: '5',
    amount: 15,
    amountAsset: 'XRP',
    status: 'released',
    conditionSummary: 'Port of Entry Timestamp, Shanghai',
    condition: { type: 'delivery', summary: 'Port of Entry Timestamp, Shanghai' },
    beneficiaryXrplAddress: 'rMockBeneficiary5XXXXXXXXXXXXXXXXX',
    fundedAgo: '5 days ago',
    contracts: { escrowAddress: '0x0000000000000000000000000000000000mock5', resolverAddress: '0x0000000000000000000000000000000000mres' },
    txs: {},
  },
  {
    id: 'mock-6',
    onChainEscrowId: '6',
    amount: 200,
    amountAsset: 'XRP',
    status: 'pending',
    conditionSummary: 'Weather: Phoenix, Rainfall <0.5in/day',
    condition: { type: 'weather', location: 'Phoenix', thresholdC: 0.5, triggerIfAbove: false },
    beneficiaryXrplAddress: 'rMockBeneficiary6XXXXXXXXXXXXXXXXX',
    fundedAgo: '1 week ago',
    contracts: { escrowAddress: '0x0000000000000000000000000000000000mock6', resolverAddress: '0x0000000000000000000000000000000000mres' },
    txs: {},
  },
];

const mockDispute: DisputeRecord = {
  escrowId: 'mock-4',
  caseRef: 'MOCK-CASE-0004',
  teeId: '0x0000000000000000000000000000000000mtee',
  teeManagerAddress: '0x0000000000000000000000000000000000mmgr',
  instructionSenderAddress: '0x0000000000000000000000000000000000mins',
  extensionId: 1,
  instructionId: '0xmockinstructionid',
  instructionTxHash: '0xmockinstructiontx',
  verdictTxHash: '0xmockverdicttx',
  outcome: true,
  rulingNumber: 1,
  status: 'ruling',
  reasoning: 'Mock reasoning: illustrative data for UI iteration, not a real ruling.',
  winningParty: 'A',
  payout: { amount: 30, asset: 'FXRP', beneficiaryXrplAddress: 'rMockBeneficiary4XXXXXXXXXXXXXXXXX' },
};

function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class MockEscrowService implements IEscrowService {
  async getEscrow(id: string): Promise<Escrow> {
    const escrow = mockEscrows.find((e) => e.id === id);
    if (!escrow) throw new Error(`Unknown mock escrow id: ${id}`);
    return delay(escrow);
  }

  async listEscrows(): Promise<Escrow[]> {
    return delay(mockEscrows);
  }

  async resolveAndRelease(id: string): Promise<{ txHash: string; amount: number }> {
    const escrow = mockEscrows.find((e) => e.id === id);
    return delay({ txHash: '0xmockreleasetx', amount: escrow?.amount ?? 0 });
  }

  async submitEvidence(_id: string, _evidence: EvidenceSubmission): Promise<void> {
    return delay(undefined, 400);
  }

  async getDispute(id: string): Promise<DisputeRecord> {
    if (id !== mockDispute.escrowId) throw new Error(`No mock dispute for escrow id: ${id}`);
    return delay(mockDispute);
  }

  async listContracts(): Promise<ContractInfo[]> {
    // Reuse real contract metadata shape for structural consistency in mock mode.
    return delay(realContracts);
  }
}
