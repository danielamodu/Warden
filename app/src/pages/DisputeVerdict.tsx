import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useDispute } from '../hooks/useDispute';
import { useEscrowData } from '../hooks/useEscrowData';
import { copyToClipboard, truncateMiddle } from '../utils/format';
import { EXPLORER } from '../services/RealEscrowService';

/**
 * No Manus design exists for this screen — extrapolated from the dark/lime
 * card system (Proof.tsx's registry cards, the "verified" pill treatment).
 */
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
    <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar activeItem="dashboard" />

      <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10">
            <nav className="mb-5 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
              <Link to="/dashboard" className="hover:text-zinc-300">Escrow Dashboard</Link><span>/</span>
              <Link to={`/escrow/${id}/dispute/submit`} className="hover:text-zinc-300">Dispute</Link><span>/</span>
              <span className="text-[#b4f56b]">Verdict</span>
            </nav>
            <h1 className="display text-4xl leading-[.95] text-white lg:text-5xl">Dispute resolution complete.</h1>
            <div className="mono mt-3 text-xs text-zinc-500">Escrow: {escrow ? truncateMiddle(escrow.contracts.escrowAddress) : '…'}</div>
          </div>

          <div className="mx-auto max-w-4xl">
            <span className="mb-4 inline-block rounded-full bg-[#b4f56b] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#0b0d10]">Final Verdict</span>

            <div className="rounded-[24px] border border-white/10 bg-[#111518] p-10 md:p-14">
              <div className="mb-8 border-b border-white/10 pb-8">
                <h2 className="display text-3xl text-white md:text-4xl">Judgment for Party {dispute?.winningParty ?? '…'}</h2>
              </div>

              <div className="mb-10">
                <h3 className="label mb-4">DECISION REASONING</h3>
                <p className="text-lg italic leading-relaxed text-zinc-300">"{dispute?.reasoning ?? 'Loading…'}"</p>
              </div>

              <div className="mb-10">
                <div className="mb-4 flex items-center gap-2">
                  <h3 className="label">VERIFIED ON-CHAIN</h3>
                  <CheckCircle2 size={14} className="text-[#b4f56b]" />
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0d1013] p-6">
                  <div className="mb-4">
                    <span className="label mb-1 block">SUBMITVERDICT() TRANSACTION:</span>
                    <div className="flex items-center justify-between gap-4">
                      <code className="mono select-all break-all text-xs text-zinc-300">{dispute?.verdictTxHash ?? '…'}</code>
                      <button onClick={handleCopy} className="shrink-0 text-zinc-600 hover:text-white"><Copy size={14} /></button>
                      {copied && <span className="shrink-0 text-[10px] text-[#b4f56b]">Copied!</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    {dispute && (
                      <a href={EXPLORER.coston2Tx(dispute.verdictTxHash)} target="_blank" rel="noreferrer" className="flex items-center gap-2 border-b border-white/30 pb-0.5 text-xs uppercase tracking-[0.2em] text-white hover:opacity-70">
                        View on chain <ExternalLink size={13} />
                      </a>
                    )}
                    <span className="text-xs text-zinc-600">TEE signature ecrecover-verified on-chain against the registered teeId</span>
                  </div>
                </div>
              </div>

              <div className="mb-10">
                <h3 className="label mb-4">PAYOUT DISTRIBUTION</h3>
                <div>
                  <div className="flex items-center justify-between border-b border-white/8 py-4 text-sm">
                    <span className="text-zinc-300">Party {dispute?.winningParty ?? 'A'} (Beneficiary)</span>
                    <span className="mono text-xs uppercase text-[#b4f56b]">{dispute?.payout.amount ?? '…'} {dispute?.payout.asset} (Released)</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/8 py-4 text-sm">
                    <span className="text-zinc-300">Party {dispute?.winningParty === 'A' ? 'B' : 'A'} (Depositor)</span>
                    <span className="mono text-xs uppercase text-zinc-600">{loserAmount} {dispute?.payout.asset} — outcome is binary, no split</span>
                  </div>
                  <div className="flex items-center justify-between border-t-2 border-white/20 py-6">
                    <span className="font-medium text-white">Total Payout</span>
                    <span className="mono text-base font-bold text-white">{dispute?.payout.amount ?? '…'} {dispute?.payout.asset}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
                <Link to={`/escrow/${id}/payout`} className="w-full rounded-full bg-[#b4f56b] px-10 py-4 text-center text-sm font-semibold text-[#0b0d10] md:w-auto">
                  Finalize Payout
                </Link>
                <Link to={`/escrow/${id}/dispute/submit`} className="w-full rounded-full border border-white/15 px-10 py-4 text-center text-sm text-zinc-300 transition-colors hover:border-white/40 hover:text-white md:w-auto">
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
