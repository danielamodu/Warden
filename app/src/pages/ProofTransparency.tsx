import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import WordReveal from '../components/WordReveal';
import { escrowService } from '../services';
import { useDispute } from '../hooks/useDispute';
import { useEscrowData } from '../hooks/useEscrowData';
import { copyToClipboard, truncateMiddle } from '../utils/format';
import type { ContractInfo } from '../types';
import styles from './ProofTransparency.module.css';

function CopyButton({ text }: { text: string }) {
  return (
    <button className={`${styles.copyBtn} text-[#1c1c1c] hover:text-[#3d7068]`} onClick={() => copyToClipboard(text)}>
      <iconify-icon icon="lucide:copy"></iconify-icon>
      <span className={`${styles.tooltip} uppercase`}>Copy Address</span>
    </button>
  );
}

export default function ProofTransparency() {
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const { dispute } = useDispute('phase3');
  const { escrow: phase2Escrow } = useEscrowData('phase2');

  useEffect(() => {
    escrowService.listContracts().then(setContracts);
  }, []);

  return (
    <div className="min-h-screen relative">
      <BackgroundGrid />
      <NavBar activeItem="docs" />

      <main className="pt-48 pb-32">
        <section className="max-w-7xl mx-auto px-6 mb-24 border-b border-[#e5e4de] pb-24">
          <div className="inline-flex items-center mb-8 px-4 py-1 border border-[#3d7068] rounded-full">
            <span className={`${styles.pulseBadge} font-mono text-[9px] tracking-[0.2em] uppercase text-[#3d7068]`}>Protocol Transparency</span>
          </div>
          <WordReveal as="h1" className="font-serif text-[6vw] leading-[1] uppercase font-light tracking-tighter mb-8">
            Verifiable by Design
          </WordReveal>
          <p className="max-w-2xl font-sans text-xl opacity-70 leading-relaxed">
            Complete transparency into every contract, TEE environment, and on-chain proof. Trust is verified, not assumed.
          </p>
        </section>

        <section className="max-w-7xl mx-auto grid md:grid-cols-3 divide-x divide-[#e5e4de] border-b border-[#e5e4de]">
          {/* SMART CONTRACTS */}
          <div className="p-8 space-y-12">
            <WordReveal as="div" className="font-serif text-2xl uppercase font-light mb-8">Smart Contracts</WordReveal>
            <div className="space-y-6">
              {contracts.map((c) => (
                <div key={c.address} className={`${styles.cardEditorial} border border-[#e5e4de] p-5`}>
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 block mb-2">{c.label}</span>
                  <p className="font-sans text-xs mb-4 opacity-70">{c.description}</p>
                  <div className={`${styles.addressBlock} p-3 rounded-[2px] flex items-center justify-between mb-4`}>
                    <code className="font-mono text-[11px] break-all select-all pr-4">{c.address}</code>
                    <CopyButton text={c.address} />
                  </div>
                  <a href={c.explorerUrl} target="_blank" rel="noreferrer" className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3d7068] flex items-center gap-2 hover:underline">
                    View on Explorer <iconify-icon icon="lucide:external-link"></iconify-icon>
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* FLARE TEE MANAGER */}
          <div className="p-8 space-y-12">
            <WordReveal as="div" className="font-serif text-2xl uppercase font-light mb-8">Flare TEE Manager</WordReveal>
            <div className={`${styles.cardEditorial} border border-[#e5e4de] p-6 h-full`}>
              <div className="flex items-center justify-between mb-10">
                <span className="bg-[#3d7068] text-white font-mono text-[9px] px-3 py-1 rounded-[2px] uppercase tracking-[0.2em]">{dispute?.teeStatus ?? 'Loading…'}</span>
                <iconify-icon icon="lucide:cpu" class="text-2xl text-[#3d7068]"></iconify-icon>
              </div>
              <div className="space-y-10">
                <div className="space-y-3">
                  <span className="font-mono text-[10px] uppercase opacity-40 tracking-[0.2em]">TEE Manager Address</span>
                  <div className={`${styles.addressBlock} p-3 rounded-[2px] flex items-center justify-between`}>
                    <code className="font-mono text-[11px] select-all">{dispute?.teeManagerAddress ?? '…'}</code>
                    {dispute && <CopyButton text={dispute.teeManagerAddress} />}
                  </div>
                </div>
                <div className="space-y-3">
                  <span className="font-mono text-[10px] uppercase opacity-40 tracking-[0.2em]">TEE ID (live)</span>
                  <div className={`${styles.addressBlock} p-3 rounded-[2px] flex items-center justify-between`}>
                    <code className="font-mono text-[11px] select-all">{dispute?.teeId ?? '…'}</code>
                    {dispute && <CopyButton text={dispute.teeId} />}
                  </div>
                </div>
                <div className="space-y-3">
                  <span className="font-mono text-[10px] uppercase opacity-40 tracking-[0.2em]">InstructionSender Extension</span>
                  <div className={`${styles.addressBlock} p-3 rounded-[2px] flex items-center justify-between`}>
                    <code className="font-mono text-[11px] select-all">{dispute?.instructionSenderAddress ?? '…'}</code>
                    {dispute && <CopyButton text={dispute.instructionSenderAddress} />}
                  </div>
                  <span className="font-mono text-[9px] uppercase opacity-30">Extension ID: {dispute?.extensionId ?? '…'}</span>
                </div>
                <div className="space-y-3">
                  <span className="font-mono text-[10px] uppercase opacity-40 tracking-[0.2em]">RULE_ON_EVIDENCE Instruction Tx</span>
                  <div className={`${styles.addressBlock} p-3 rounded-[2px] flex items-center justify-between border-l-2 border-[#3d7068]`}>
                    <code className="font-mono text-[11px] break-all select-all pr-4">{dispute?.instructionTxHash ?? '…'}</code>
                    {dispute && <CopyButton text={dispute.instructionTxHash} />}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[9px] text-[#3d7068] uppercase tracking-[0.2em]">
                    <iconify-icon icon="lucide:check-circle"></iconify-icon> Verified Instruction
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ON-CHAIN VERIFICATION */}
          <div className="p-8 space-y-12">
            <WordReveal as="div" className="font-serif text-2xl uppercase font-light mb-8">On-Chain Verification</WordReveal>
            <div className="space-y-6">
              <div className={`${styles.cardEditorial} border border-[#e5e4de] p-6 flex flex-col items-center text-center group`}>
                <div className="w-14 h-14 border border-[#e5e4de] flex items-center justify-center mb-6 opacity-40 group-hover:opacity-100 group-hover:border-[#3d7068] transition-all">
                  <iconify-icon icon="lucide:database" class="text-2xl"></iconify-icon>
                </div>
                <h4 className="font-mono text-xs uppercase mb-3 tracking-[0.1em]">Coston2 Explorer</h4>
                <a href="https://coston2-explorer.flare.network/" target="_blank" rel="noreferrer" className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3d7068] flex items-center gap-2 hover:underline">
                  View All Transactions <iconify-icon icon="lucide:external-link"></iconify-icon>
                </a>
              </div>
              <div className={`${styles.cardEditorial} border border-[#e5e4de] p-6 flex flex-col items-center text-center group`}>
                <div className="w-14 h-14 border border-[#e5e4de] flex items-center justify-center mb-6 opacity-40 group-hover:opacity-100 group-hover:border-[#3d7068] transition-all">
                  <iconify-icon icon="lucide:check-circle" class="text-2xl"></iconify-icon>
                </div>
                <h4 className="font-mono text-xs uppercase mb-1 tracking-[0.1em]">Live Voting Rounds</h4>
                <span className="font-mono text-[9px] opacity-40 uppercase block mb-3">
                  Phase 2 FDC Round: {phase2Escrow?.fdc?.votingRoundId ?? '…'}
                </span>
                <p className="font-sans text-[11px] opacity-60 mb-4 px-4">Round with the exact-value Web2Json weather attestation match.</p>
                {phase2Escrow?.txs.fundTxHash && (
                  <a
                    href={`https://coston2-explorer.flare.network/tx/${phase2Escrow.txs.fundTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3d7068] flex items-center gap-2 hover:underline"
                  >
                    View Fund Tx <iconify-icon icon="lucide:external-link"></iconify-icon>
                  </a>
                )}
              </div>
              <div className={`${styles.cardEditorial} border border-[#e5e4de] p-6 flex flex-col items-center text-center group`}>
                <div className="w-14 h-14 border border-[#e5e4de] flex items-center justify-center mb-6 opacity-40 group-hover:opacity-100 group-hover:border-[#3d7068] transition-all">
                  <iconify-icon icon="lucide:link-2" class="text-2xl"></iconify-icon>
                </div>
                <h4 className="font-mono text-xs uppercase mb-3 tracking-[0.1em]">Cross-Chain Proofs</h4>
                <p className="font-sans text-[11px] opacity-60 mb-4 px-4">Trustless bridging via FAssets redemption flows.</p>
                {phase2Escrow?.txs.payoutXrplTxHash && (
                  <a
                    href={`https://testnet.xrpl.org/transactions/${phase2Escrow.txs.payoutXrplTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3d7068] flex items-center gap-2 hover:underline"
                  >
                    Verification Details <iconify-icon icon="lucide:external-link"></iconify-icon>
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto py-24 px-6 text-center border-b border-[#e5e4de]">
          <WordReveal as="h2" className="font-serif text-4xl uppercase font-light tracking-tight mb-8">Technical Audit Logs</WordReveal>
          <div className="max-w-4xl mx-auto p-12 border border-[#e5e4de] bg-white/30">
            <div className="flex flex-col items-center gap-6">
              <iconify-icon icon="lucide:file-text" class="text-5xl opacity-20"></iconify-icon>
              <p className="font-sans text-lg opacity-60">
                Comprehensive transaction history and attestation proofs are generated for every escrow release. Protocol performance and TEE uptime can be audited by any party using the instruction sender extension.
              </p>
              <div className="flex gap-6">
                <Link to="/create" className="font-mono text-[10px] tracking-[0.3em] uppercase bg-[#3d7068] text-white px-8 py-3 hover:opacity-90 editorial-transition">Create Escrow</Link>
                <Link to="/dashboard" className="font-mono text-[10px] tracking-[0.3em] uppercase border border-[#1c1c1c] px-8 py-3 hover:bg-[#1c1c1c] hover:text-white editorial-transition">Dashboard</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
