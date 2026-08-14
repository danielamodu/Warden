// Real, confirmed on-chain artifacts from Warden's Phase 2 (happy path) and
// Phase 3 (dispute path) runs on Coston2 + XRPL testnet.
//
// Sourced from: Warden/PHASE2.md, Warden/PHASE3.md, Warden/state.phase2.json,
// Warden/state.phase3.json. Nothing here is invented â€” every address, tx hash,
// round number and amount below is copied verbatim from those real run records.
//
// This module is the single source of truth the RealEscrowService reads from.
// A future live-RPC implementation can replace RealEscrowService without
// touching IEscrowService or any component.

import type { ContractInfo, DisputeRecord, Escrow } from '../types';

export const EXPLORER = {
  coston2Tx: (hash: string) => `https://coston2-explorer.flare.network/tx/${hash}`,
  coston2Address: (addr: string) => `https://coston2-explorer.flare.network/address/${addr}`,
  xrplTx: (hash: string) => `https://testnet.xrpl.org/transactions/${hash}`,
};

// ---------------------------------------------------------------------------
// Phase 2 â€” happy path (weather-triggered auto-release)
// ---------------------------------------------------------------------------
export const phase2 = {
  escrowAddress: '0xBDDD1E23604cA932c823Ef3397D96697aBB1c53D',
  resolverAddress: '0x0a7b57FC9d907a55f72E7920E6645A6d40B972CF',
  fdcVerificationAddress: '0x906507E0B64bcD494Db73bd0459d1C667e14B933',
  setResolverTxHash: '0xe6bd4e62c1f6525df1fe801aa6b539de01f7b51e64fc51fd8620be5aced5a527',
  approveTxHash: '0x06db7fc9e62bb1e5017bd477af69e42fdeded5ae2f71568a48566423f4bf7cc7',
  fundTxHash: '0xb0209e2ce25f8cab417f0e0078e854ab7cc53a5dd4f05a7b093d8944850a6f1b',
  onChainEscrowId: '0',
  conditionId: '0x19cb272e97e060e54dd03f84a8a608498fcfac70e48ea6f125d7b9c26b898c8d',
  fundAmountFxrp: 10.0,
  beneficiaryXrplAddress: 'rQhiVPjkhTQE9FXriKJhX9LZL9Jy9b4xnP',
  location: 'Dubai',
  coordinates: { lat: 25.2048, lon: 55.2708 },
  currentTempC: 33.9,
  thresholdTempC: 29.9,
  triggerIfAbove: true,
  fdcRequestTxHash: '0xc52b4592853a42f0cb18c0bc48ed285f13d70c567c7d98bf3703d8e072059858',
  votingRoundId: 1421888,
  attestedTemperatureCx100: 3390,
  releaseTxHash: '0xb15a31cd33a27bae8e6c5f91758722610651a388666c75313031d956b0ae16ce',
  outcome: true,
  redeemedAmountUba: '10000000',
  payoutXrplTxHash: '0B903CE2F06F37947DC052333D1754CF08BC3CDCBB0AB36145CFF7E79C468B92',
  payoutAmountXrp: 9.95,
  payoutFromXrplAddress: 'rDYeqGVc8M3Se9wowvRDbURGYGZ5i5VF6r',
  balanceBeforeXrp: 105.0,
  balanceAfterXrp: 114.95,
};

// ---------------------------------------------------------------------------
// Phase 3 â€” dispute path (live TEE ruling + on-chain signature verification)
// ---------------------------------------------------------------------------
export const phase3 = {
  escrowAddress: '0x12FeF54Aa967Cc921D8A42528B7ff23218911e14',
  resolverAddress: '0x662144FE2c59f58b3612Ee5bf252D06Ff1d2d91A',
  teeManagerAddress: '0x1a9C4A0f9D76c0b1D91d22E24E573a9b377618aE',
  instructionSenderAddress: '0x01269cc5498679ac790Af12cd803a1108a0aA235',
  extensionId: 66120,
  setResolverTxHash: '0x542b6128177ff06dcff60bb17222713a09961224bcd48195bde59594b9d7cbec',
  approveTxHash: '0x470a3378e2b9c33ae330508c5ee104b39fe585febf5900d8c12c5e5fdc348a9b',
  fundTxHash: '0x5efdb353e9f2f961e58f30f17165ac20bf60e372263ccc150d991cb4cfb3343f',
  onChainEscrowId: '0',
  fundAmountFxrp: 10.0,
  beneficiaryXrplAddress: 'rQhiVPjkhTQE9FXriKJhX9LZL9Jy9b4xnP',
  teeId: '0x33c2f5f41Bf1199A7Dc68F32D74ED097F07e33C0',
  teeStatus: 'PRODUCTION',
  instructionId: '0x29faf1cb88695bcc40a704beb31a2e167371988d7764c5e2e759625c0d4c4fc7',
  instructionTxHash: '0x6590511a717abd03d3933c113155f5a3740e6e9d361e4f1600dd6621a1bc259b',
  verdictTxHash: '0xe15336e9d5e9b5f75f8fa1bcc0bafa8631ad5262fd7d73df0556b354abc722e1',
  outcome: true,
  rulingNumber: 1,
  reasoning:
    'The TEE ran its deterministic rules engine over both partiesâ€™ ECIES-encrypted claimed timestamps: evidence A fell inside the independently-established comparison window, evidence B fell roughly two hours outside it. Evidence A was ruled the valid claim, and WardenDisputeResolver.submitVerdict() reconstructed the TEEâ€™s signing hash and ecrecoverâ€™d it on-chain against the TEEâ€™s registered public key before releasing funds.',
  payoutXrplTxHash: 'D588BAF9C7BDEC8585A4E2E3D89057CF5B32376195667C417A274237577658B0',
  payoutAmountXrp: 9.95,
  balanceBeforeXrp: 105.0,
  balanceAfterXrp: 114.95,
};

// ---------------------------------------------------------------------------
// Escrow shapes consumed by the ported pages
// ---------------------------------------------------------------------------

export const phase2Escrow: Escrow = {
  id: 'phase2',
  onChainEscrowId: phase2.onChainEscrowId,
  amount: phase2.fundAmountFxrp,
  amountAsset: 'FXRP',
    buyer: '0xE761cca6da44511372DCC23d94d7294e2A81579D',
  status: 'released',
  conditionSummary: `Weather: ${phase2.location}, Threshold >${phase2.thresholdTempC}Â°C`,
  condition: {
    type: 'weather',
    location: phase2.location,
    thresholdC: phase2.thresholdTempC,
    currentC: phase2.currentTempC,
    triggerIfAbove: phase2.triggerIfAbove,
  },
  beneficiaryXrplAddress: phase2.beneficiaryXrplAddress,
  fundedAgo: 'Confirmed on Coston2 + XRPL testnet',
  contracts: {
    escrowAddress: phase2.escrowAddress,
    resolverAddress: phase2.resolverAddress,
  },
  txs: {
    approveTxHash: phase2.approveTxHash,
    fundTxHash: phase2.fundTxHash,
    releaseTxHash: phase2.releaseTxHash,
    payoutXrplTxHash: phase2.payoutXrplTxHash,
  },
  fdc: {
    votingRoundId: phase2.votingRoundId,
    attestationType: 'Web2Json',
    attestedValueLabel: `${(phase2.attestedTemperatureCx100 / 100).toFixed(2)}Â°C (attested cx100=${phase2.attestedTemperatureCx100})`,
    verified: true,
  },
  payout: {
    amount: phase2.payoutAmountXrp,
    asset: 'XRP',
    beneficiaryXrplAddress: phase2.beneficiaryXrplAddress,
    balanceBeforeXrp: phase2.balanceBeforeXrp,
    balanceAfterXrp: phase2.balanceAfterXrp,
  },
};

export const phase3Escrow: Escrow = {
  id: 'phase3',
  onChainEscrowId: phase3.onChainEscrowId,
  amount: phase3.fundAmountFxrp,
  amountAsset: 'FXRP',
    buyer: '0xE761cca6da44511372DCC23d94d7294e2A81579D',
  status: 'released',
  conditionSummary: 'Dispute: TEE-arbitrated evidence ruling (RULE_ON_EVIDENCE)',
  condition: {
    type: 'dispute',
    summary: 'Two conflicting claimed timestamps, ruled by a live TEE against an independently-established comparison window.',
  },
  beneficiaryXrplAddress: phase3.beneficiaryXrplAddress,
  fundedAgo: 'Resolved via live TEE verdict on Coston2',
  contracts: {
    escrowAddress: phase3.escrowAddress,
    resolverAddress: phase3.resolverAddress,
  },
  txs: {
    approveTxHash: phase3.approveTxHash,
    fundTxHash: phase3.fundTxHash,
    verdictTxHash: phase3.verdictTxHash,
    payoutXrplTxHash: phase3.payoutXrplTxHash,
  },
  payout: {
    amount: phase3.payoutAmountXrp,
    asset: 'XRP',
    beneficiaryXrplAddress: phase3.beneficiaryXrplAddress,
    balanceBeforeXrp: phase3.balanceBeforeXrp,
    balanceAfterXrp: phase3.balanceAfterXrp,
  },
  disputeId: 'phase3',
};

export const disputeRecord: DisputeRecord = {
  escrowId: 'phase3',
  caseRef: `ESCROW-${phase3.onChainEscrowId}-${phase3.instructionId.slice(2, 10).toUpperCase()}`,
  teeId: phase3.teeId,
  teeManagerAddress: phase3.teeManagerAddress,
  instructionSenderAddress: phase3.instructionSenderAddress,
  extensionId: phase3.extensionId,
  instructionId: phase3.instructionId,
  instructionTxHash: phase3.instructionTxHash,
  verdictTxHash: phase3.verdictTxHash,
  outcome: phase3.outcome,
  rulingNumber: phase3.rulingNumber,
  status: 'complete',
  reasoning: phase3.reasoning,
  winningParty: 'A',
  payout: {
    amount: phase3.payoutAmountXrp,
    asset: 'XRP',
    beneficiaryXrplAddress: phase3.beneficiaryXrplAddress,
  },
};

export const contracts: ContractInfo[] = [
  {
    label: 'WardenPaymentAttestor',
    description: 'Web2Json attestation verifier used to confirm the weather condition proof on-chain.',
    address: phase2.fdcVerificationAddress,
    explorerUrl: EXPLORER.coston2Address(phase2.fdcVerificationAddress),
  },
  {
    label: 'WardenEscrow â€” Phase 2 (Weather)',
    description: 'Core escrow vault used for the weather-triggered happy path.',
    address: phase2.escrowAddress,
    explorerUrl: EXPLORER.coston2Address(phase2.escrowAddress),
  },
  {
    label: 'WardenWeatherResolver',
    description: 'Automated payout logic for FDC-verified weather conditions.',
    address: phase2.resolverAddress,
    explorerUrl: EXPLORER.coston2Address(phase2.resolverAddress),
  },
  {
    label: 'WardenEscrow â€” Phase 3 (Dispute)',
    description: 'Core escrow vault used for the TEE-arbitrated dispute path.',
    address: phase3.escrowAddress,
    explorerUrl: EXPLORER.coston2Address(phase3.escrowAddress),
  },
  {
    label: 'WardenDisputeResolver',
    description: 'Reconstructs the TEEâ€™s signing hash and ecrecover-verifies verdicts on-chain before releasing funds.',
    address: phase3.resolverAddress,
    explorerUrl: EXPLORER.coston2Address(phase3.resolverAddress),
  },
];
