import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import WordReveal from '../components/WordReveal';
import { useDispute } from '../hooks/useDispute';
import { useEscrowData } from '../hooks/useEscrowData';
import { copyToClipboard, truncateMiddle } from '../utils/format';
import { EXPLORER } from '../services/RealEscrowService';
import styles from './DisputeVerdict.module.css';

export default function DisputeVerdict() {
  const { id = 'phase3' } = useParams<{ id: string }>();
  const { dispute } = useDispute(id);
  const { escrow } = useEscrowData(id);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!dispute) return;
    await copyToClipboard(dispute.verdictTxHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loserAmount = 0;

  return (
    <div className="min-h-screen relative">
      <BackgroundGrid />
      <NavBar activeItem="dashboard" />

      <main className="pt-48 pb-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12">
            <nav className="flex mb-6">
              <ol className="flex items-center space-x-2 font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">
                <li><Link to="/dashboard" className="hover:opacity-100">Escrow Dashboard</Link></li>
                <li><span className="mx-2">/</span></li>
                <li><Link to={`/escrow/${id}/dispute/submit`} className="hover:opacity-100">Dispute</Link></li>
                <li><span className="mx-2">/</span></li>
                <li className="opacity-100 text-[#3d7068]">Verdict</li>
              </ol>
            </nav>

            <WordReveal as="h1" className="font-serif text-4xl md:text-5xl uppercase font-light tracking-tight mb-2">
              Dispute Resolution Complete
            </WordReveal>
            <div className="font-mono text-[10px] tracking-[0.2em] opacity-50 uppercase">
              Escrow: {escrow ? truncateMiddle(escrow.contracts.escrowAddress) : '…'}
            </div>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="mb-4">
              <span className="inline-block px-4 py-2 bg-[#3d7068] text-white font-mono text-[10px] tracking-[0.2em] uppercase rounded-[2px]">Final Verdict</span>
            </div>

            <div className={`${styles.cardEditorial} p-10 md:p-16 rounded-[2px]`}>
              <div className="mb-8 border-b border-[#e5e4de] pb-8">
                <h2 className="font-serif text-3xl md:text-4xl uppercase font-light tracking-tight">
                  Judgment for Party {dispute?.winningParty ?? '…'}
                </h2>
              </div>

              <div className="mb-10">
                <h3 className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 mb-4">Decision Reasoning</h3>
                <p className="font-sans italic text-lg leading-relaxed opacity-75">
                  "{dispute?.reasoning ?? 'Loading…'}"
                </p>
              </div>

              <div className="mb-10">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">Verified On-Chain</h3>
                  <iconify-icon icon="lucide:check-circle" class="text-[#3d7068] text-sm"></iconify-icon>
                </div>
                <div className="border border-[#e5e4de] bg-[#f7f6f2]/50 p-6 rounded-[2px] relative">
                  <div className="mb-4">
                    <span className="block font-mono text-[9px] uppercase opacity-60 mb-1">submitVerdict() Transaction:</span>
                    <div className="flex items-center justify-between group">
                      <code className="font-mono text-[10px] break-all opacity-80 cursor-text select-all">{dispute?.verdictTxHash ?? '…'}</code>
                      <button onClick={handleCopy} className="ml-4 opacity-40 hover:opacity-100 transition-opacity">
                        <iconify-icon icon="lucide:copy" class="text-sm"></iconify-icon>
                      </button>
                      <span className={`${styles.copyFeedback} ${copied ? styles.copyFeedbackActive : ''}`}>Copied!</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {dispute && (
                      <a
                        href={EXPLORER.coston2Tx(dispute.verdictTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[10px] tracking-[0.2em] uppercase flex items-center gap-2 border-b border-[#1c1c1c] pb-0.5 hover:opacity-70 transition-opacity"
                      >
                        View on Chain <iconify-icon icon="lucide:external-link"></iconify-icon>
                      </a>
                    )}
                    <span className="font-sans text-xs opacity-50">
                      TEE signature ecrecover-verified on-chain against the registered teeId
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-12">
                <h3 className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 mb-4">Payout Distribution</h3>
                <div className="space-y-0">
                  <div className="flex justify-between items-center py-4 border-b border-[#e5e4de]">
                    <span className="font-sans text-sm">Party {dispute?.winningParty ?? 'A'} (Beneficiary)</span>
                    <span className="font-mono text-[10px] opacity-70 uppercase">{dispute?.payout.amount ?? '…'} {dispute?.payout.asset} (Released)</span>
                  </div>
                  <div className="flex justify-between items-center py-4 border-b border-[#e5e4de]">
                    <span className="font-sans text-sm">Party {dispute?.winningParty === 'A' ? 'B' : 'A'} (Depositor)</span>
                    <span className="font-mono text-[10px] opacity-70 uppercase">{loserAmount} {dispute?.payout.asset} — outcome is binary, no split</span>
                  </div>
                  <div className="flex justify-between items-center py-6 border-t-[2px] border-[#1c1c1c]">
                    <span className="font-sans font-medium text-base">Total Payout</span>
                    <span className="font-mono text-base font-bold">{dispute?.payout.amount ?? '…'} {dispute?.payout.asset}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                <Link to={`/escrow/${id}/payout`} className="cta-button w-full md:w-auto px-12 py-5 text-white font-mono text-[10px] tracking-[0.25em] uppercase rounded-[2px] text-center">
                  Finalize Payout
                </Link>
                <Link to={`/escrow/${id}/dispute/submit`} className="w-full md:w-auto px-12 py-5 border border-[#e5e4de] font-mono text-[10px] tracking-[0.2em] uppercase rounded-[2px] hover:bg-white transition-colors text-center">
                  View Full Evidence
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
