import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Circle, Copy, ExternalLink, ShieldCheck } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useEscrowData } from '../hooks/useEscrowData';
import { copyToClipboard, padEscrowId, truncateHash } from '../utils/format';
import { EXPLORER } from '../services/RealEscrowService';

/**
 * No Manus design exists for a dedicated escrow-detail page — the Manus
 * redesign folds this content into a Dashboard click-through modal instead.
 * A modal doesn't fit here: this page also anchors deep links from the
 * dispute flow (Submit Evidence / Ruling / Verdict all reference an escrow
 * id in the URL), so it stays a real route, extrapolated from the same
 * dark/lime card system Manus used for its vault modal and Proof cards.
 */
export default function EscrowDetail() {
  const { id } = useParams<{ id: string }>();
  const { escrow, loading, error } = useEscrowData(id);

  if (loading) {
    return (
      <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
        <BackgroundGrid />
        <NavBar />
        <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
          <div className="mx-auto max-w-[1440px] font-mono text-xs uppercase tracking-widest text-zinc-500">Loading escrow…</div>
        </main>
      </div>
    );
  }

  if (error || !escrow) {
    return (
      <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
        <BackgroundGrid />
        <NavBar />
        <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
          <div className="mx-auto max-w-[1440px]">
            <p className="font-mono text-xs uppercase tracking-widest text-red-400">Escrow not found: {id}</p>
            <Link to="/dashboard" className="mt-6 inline-block text-xs uppercase tracking-[0.2em] text-[#b4f56b] underline">Back to Dashboard</Link>
          </div>
        </main>
      </div>
    );
  }

  const weather = escrow.condition.type === 'weather' ? escrow.condition : null;
  const isWeather = weather !== null;
  const fillPct = weather?.currentC != null ? Math.min(100, (weather.currentC / 40) * 100) : 0;
  const markerPct = weather ? Math.min(100, (weather.thresholdC / 40) * 100) : 0;
  const conditionCurrentlyMet =
    weather?.currentC != null && (weather.triggerIfAbove ? weather.currentC > weather.thresholdC : weather.currentC < weather.thresholdC);

  return (
    <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar />

      <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-12 border-b border-white/10 pb-8">
            <div className="mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
              <Link to="/dashboard" className="hover:text-zinc-300">Dashboard</Link>
              <span>/</span>
              <span className="text-zinc-300">Escrow #{padEscrowId(escrow.onChainEscrowId)}</span>
            </div>
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="flex items-center gap-4">
                  <h1 className="display text-5xl leading-[.92] text-white lg:text-6xl">#{padEscrowId(escrow.onChainEscrowId)}</h1>
                  <span className="rounded-full border border-white/15 bg-white/[.05] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-zinc-300">{escrow.status}</span>
                </div>
                <p className="mt-3 text-sm text-zinc-500">{escrow.fundedAgo}</p>
              </div>
              <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-xs text-zinc-300 transition-colors hover:border-white/40 hover:text-white">
                Back to vaults
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* FUND DETAILS */}
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-6">
              <div className="label mb-6">FUND DETAILS</div>
              <div className="mono text-4xl text-[#b4f56b]">{escrow.amount} {escrow.amountAsset}</div>
              <div className="label mt-2">LOCKED IN ESCROW</div>
              <div className="my-6 h-px bg-white/10" />
              <div className="label mb-3">CONDITION TYPE</div>
              <div className="text-sm text-white">{isWeather ? 'Weather threshold' : 'TEE dispute resolution'}</div>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                {isWeather ? `${weather!.location}, ${weather!.thresholdC}°C minimum temperature` : escrow.conditionSummary}
              </p>
              <div className="my-6 h-px bg-white/10" />
              <div className="label mb-4">MONITORING STATUS</div>
              <div className="flex items-center gap-3 text-xs">
                <span className="rounded-full border border-white/15 px-2 py-1 uppercase tracking-[0.15em] text-zinc-300">{escrow.status === 'released' ? 'Resolved' : 'Active'}</span>
                <span className="text-zinc-500">{isWeather ? 'Open-Meteo live data' : 'FlareTeeManager'}</span>
              </div>
            </div>

            {/* LIVE DATA / RESOLUTION */}
            {isWeather ? (
              <div className="rounded-2xl border border-white/10 bg-[#111518] p-6">
                <div className="label mb-8">LIVE CONDITION READING</div>
                <div className="flex items-baseline gap-3">
                  <div className="mono text-6xl text-white">{weather!.currentC}°C</div>
                  <div className="mono text-sm text-zinc-600">/ {weather!.thresholdC}°C</div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  {conditionCurrentlyMet ? <CheckCircle2 size={16} className="text-[#b4f56b]" /> : <Circle size={16} className="text-zinc-600" />}
                  <span className={`text-[10px] uppercase tracking-[0.2em] ${conditionCurrentlyMet ? 'text-[#b4f56b]' : 'text-zinc-500'}`}>
                    {conditionCurrentlyMet ? 'Condition met' : 'Condition not currently met (live reading)'}
                  </span>
                </div>
                <div className="relative mt-6 h-1.5 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#72d7ff] via-[#b4f56b] to-[#ffe278]" style={{ width: `${fillPct}%` }} />
                  <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-[#0d1013]" style={{ left: `${markerPct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[9px] uppercase tracking-[0.15em] text-zinc-600">
                  <span>0°C</span><span>Threshold ({weather!.thresholdC})</span><span>40°C</span>
                </div>
                <div className="my-6 h-px bg-white/10" />
                <div className="label mb-2">FDC VERIFICATION</div>
                <div className="flex items-center justify-between">
                  <span className="mono text-xs text-zinc-400">Round #{escrow.fdc?.votingRoundId}</span>
                  <span className="text-[10px] font-bold text-[#b4f56b]">VERIFIED</span>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-[#111518] p-6">
                <div className="label mb-8">RESOLUTION METHOD</div>
                <div className="display text-3xl text-white">TEE Verdict</div>
                <p className="mt-2 text-sm text-zinc-500">{escrow.conditionSummary}</p>
                <div className="mt-6 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#b4f56b]" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#b4f56b]">Verdict delivered</span>
                </div>
                <div className="my-6 h-px bg-white/10" />
                <div className="flex items-center justify-between text-xs">
                  <span className="label">VERIFIED ON-CHAIN</span>
                  <span className="text-[10px] font-bold text-[#b4f56b]">SIGNATURE VERIFIED</span>
                </div>
                <Link to={`/escrow/${escrow.id}/dispute/verdict`} className="mt-8 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[#b4f56b] hover:underline">
                  View full verdict <ArrowRight size={13} />
                </Link>
              </div>
            )}

            {/* PAYOUT */}
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-6">
              <div className="label mb-6">PAYOUT STATUS</div>
              {escrow.payout ? (
                <>
                  <div className="mono text-4xl text-[#b4f56b]">{escrow.payout.amount} {escrow.payout.asset}</div>
                  <span className="mt-2 inline-block rounded-full border border-white/15 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-zinc-300">Delivered</span>
                  <div className="my-6 h-px bg-white/10" />
                  {escrow.payout.balanceBeforeXrp != null && escrow.payout.balanceAfterXrp != null && (
                    <>
                      <div className="label mb-4">ACCOUNT BALANCE CHANGE</div>
                      <div className="flex items-center justify-between mono text-xs">
                        <span className="text-zinc-500">{escrow.payout.balanceBeforeXrp.toFixed(2)}</span>
                        <ArrowRight size={13} className="text-zinc-700" />
                        <span className="font-bold text-white">{escrow.payout.balanceAfterXrp.toFixed(2)} XRP</span>
                      </div>
                      <div className="my-6 h-px bg-white/10" />
                    </>
                  )}
                  <div className="space-y-5">
                    {(escrow.txs.releaseTxHash || escrow.txs.verdictTxHash) && (
                      <div className="group cursor-pointer" onClick={() => copyToClipboard((escrow.txs.releaseTxHash || escrow.txs.verdictTxHash)!)}>
                        <div className="label mb-2 flex items-center justify-between">
                          {escrow.txs.releaseTxHash ? 'Resolver transaction' : 'Verdict transaction'}
                          <Copy size={11} className="opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="mono truncate text-[10px] text-zinc-400">{truncateHash(escrow.txs.releaseTxHash || escrow.txs.verdictTxHash || '')}</div>
                          <a href={EXPLORER.coston2Tx((escrow.txs.releaseTxHash || escrow.txs.verdictTxHash)!)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink size={11} className="text-zinc-600 hover:text-white" />
                          </a>
                        </div>
                      </div>
                    )}
                    {escrow.txs.payoutXrplTxHash && (
                      <div className="group cursor-pointer" onClick={() => copyToClipboard(escrow.txs.payoutXrplTxHash!)}>
                        <div className="label mb-2 flex items-center justify-between">
                          XRPL payout transaction
                          <Copy size={11} className="opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="mono truncate text-[10px] text-zinc-400">{truncateHash(escrow.txs.payoutXrplTxHash)}</div>
                          <a href={EXPLORER.xrplTx(escrow.txs.payoutXrplTxHash)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink size={11} className="text-zinc-600 hover:text-white" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="font-mono text-xs uppercase tracking-widest text-zinc-600">No payout recorded yet</div>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <a href={EXPLORER.coston2Address(escrow.contracts.escrowAddress)} target="_blank" rel="noreferrer" className="group flex items-center justify-between rounded-2xl border border-white/10 bg-[#111518] p-6 transition-colors hover:border-white/25">
              <div>
                <div className="label mb-2">VIEW DETAILS</div>
                <h4 className="display text-2xl text-white">Coston2 Explorer</h4>
              </div>
              <ExternalLink size={28} className="text-zinc-700 transition-colors group-hover:text-[#b4f56b]" />
            </a>
            <Link to="/proof" className="group flex items-center justify-between rounded-2xl border border-white/10 bg-[#111518] p-6 transition-colors hover:border-white/25">
              <div>
                <div className="label mb-2">VERIFICATION</div>
                <h4 className="display text-2xl text-white">{isWeather ? 'FDC Verification' : 'FlareTeeManager'}</h4>
              </div>
              <ShieldCheck size={28} className="text-zinc-700 transition-colors group-hover:text-[#b4f56b]" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
