import { Link, useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useEscrowData } from '../hooks/useEscrowData';
import { copyToClipboard, padEscrowId, truncateHash } from '../utils/format';
import { EXPLORER } from '../services/RealEscrowService';
import styles from './EscrowDetail.module.css';

export default function EscrowDetail() {
  const { id } = useParams<{ id: string }>();
  const { escrow, loading, error } = useEscrowData(id);

  if (loading) {
    return (
      <div className="min-h-screen relative">
        <BackgroundGrid />
        <NavBar />
        <main className="pt-48 pb-24 max-w-7xl mx-auto px-6 font-mono text-xs opacity-40 uppercase tracking-widest">Loading escrow…</main>
      </div>
    );
  }

  if (error || !escrow) {
    return (
      <div className="min-h-screen relative">
        <BackgroundGrid />
        <NavBar />
        <main className="pt-48 pb-24 max-w-7xl mx-auto px-6">
          <p className="font-mono text-xs uppercase tracking-widest text-red-700">Escrow not found: {id}</p>
          <Link to="/dashboard" className="font-mono text-[10px] tracking-[0.2em] uppercase underline mt-6 inline-block">Back to Dashboard</Link>
        </main>
      </div>
    );
  }

  const weather = escrow.condition.type === 'weather' ? escrow.condition : null;
  const isWeather = weather !== null;
  const fillPct = weather?.currentC != null ? Math.min(100, (weather.currentC / 40) * 100) : 0;
  const markerPct = weather ? Math.min(100, (weather.thresholdC / 40) * 100) : 0;
  const conditionCurrentlyMet =
    weather?.currentC != null &&
    (weather.triggerIfAbove ? weather.currentC > weather.thresholdC : weather.currentC < weather.thresholdC);

  return (
    <div className="min-h-screen relative">
      <BackgroundGrid />
      <NavBar />

      <main className="pt-40 pb-24 max-w-7xl mx-auto px-6">
        <div className="mb-16">
          <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] uppercase opacity-40 mb-8">
            <Link to="/dashboard" className="hover:opacity-100 transition-opacity">Dashboard</Link>
            <span>/</span>
            <span className="opacity-100">Escrow #{padEscrowId(escrow.onChainEscrowId)}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-6 mb-4">
                <h1 className="font-serif text-5xl md:text-7xl uppercase font-light tracking-tighter">{padEscrowId(escrow.onChainEscrowId)}</h1>
                <span className={styles.statusBadge}>{escrow.status.toUpperCase()}</span>
              </div>
              <p className="font-sans text-lg opacity-60">{escrow.fundedAgo}</p>
            </div>
            <div className="flex gap-4">
              <Link to="/dashboard" className="font-mono text-[10px] tracking-[0.3em] uppercase px-6 py-3 border border-[#1c1c1c] rounded-[2px] hover:bg-[#1c1c1c] hover:text-white transition-all duration-500">
                Back to List
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* LEFT: FUND DETAILS */}
          <div className="lg:col-span-4 space-y-10">
            <div className={`${styles.cardEditorial} p-8`}>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 block mb-6">Fund Details</span>
              <div className="font-serif text-4xl text-[#3d7068] mb-2">{escrow.amount} {escrow.amountAsset}</div>
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-40">Locked in Escrow</span>
              <div className="h-px bg-[#e5e4de] w-full my-8"></div>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 block mb-4">Condition Type</span>
              <div className="font-mono text-sm uppercase mb-2">{isWeather ? 'Weather Threshold' : 'TEE Dispute Resolution'}</div>
              <div className="font-sans text-sm opacity-70">
                {isWeather ? `${weather!.location}, ${weather!.thresholdC}°C minimum temperature` : escrow.conditionSummary}
              </div>
              <div className="h-px bg-[#e5e4de] w-full my-8"></div>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 block mb-6">Monitoring Status</span>
              <div className="flex items-center gap-3">
                <span className={styles.statusBadge}>{escrow.status === 'released' ? 'RESOLVED' : 'ACTIVE'}</span>
                <span className="font-mono text-[9px] tracking-[0.1em] opacity-50 uppercase">
                  {isWeather ? 'Open-Meteo Live Data' : 'FlareTeeManager'}
                </span>
              </div>
            </div>
          </div>

          {/* MIDDLE: LIVE DATA / RESOLUTION */}
          <div className="lg:col-span-4 space-y-10">
            {isWeather ? (
              <div className={`${styles.cardEditorial} p-10`}>
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 block mb-10">Live Condition Reading</span>
                <div className="flex items-baseline gap-4 mb-8">
                  <div className="font-serif text-7xl text-[#1c1c1c]">{weather!.currentC}°C</div>
                  <div className="font-mono text-sm opacity-30">/ {weather!.thresholdC}°C</div>
                </div>
                <div className="flex items-center gap-2 mb-10">
                  <iconify-icon
                    icon={conditionCurrentlyMet ? 'lucide:check-circle' : 'lucide:circle-dashed'}
                    class={conditionCurrentlyMet ? 'text-[#3d7068]' : 'opacity-40'}
                  ></iconify-icon>
                  <span
                    className="font-mono text-[10px] tracking-[0.2em] uppercase"
                    style={{ color: conditionCurrentlyMet ? '#3d7068' : undefined, opacity: conditionCurrentlyMet ? 1 : 0.5 }}
                  >
                    {conditionCurrentlyMet ? 'Condition Met ✓' : 'Condition Not Currently Met (live reading)'}
                  </span>
                </div>
                <div className={`${styles.gaugeBg} mb-4`}>
                  <div className={styles.gaugeFill} style={{ width: `${fillPct}%` }}></div>
                  <div className={styles.gaugeMarker} style={{ left: `${markerPct}%` }}></div>
                </div>
                <div className="flex justify-between font-mono text-[8px] tracking-[0.2em] uppercase opacity-30">
                  <span>0°C</span>
                  <span>Threshold ({weather!.thresholdC})</span>
                  <span>40°C</span>
                </div>
                <div className="h-px bg-[#e5e4de] w-full my-10"></div>
                <div className="space-y-6">
                  <div>
                    <span className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-50 block mb-2">FDC Verification</span>
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs tabular-nums">Round #{escrow.fdc?.votingRoundId}</span>
                      <span className="font-mono text-[9px] text-[#3d7068] font-bold">VERIFIED ✓</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`${styles.cardEditorial} p-10`}>
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 block mb-10">Resolution Method</span>
                <div className="font-serif text-3xl text-[#1c1c1c] mb-2">TEE Verdict</div>
                <p className="font-sans text-sm opacity-70 mb-8">{escrow.conditionSummary}</p>
                <div className="flex items-center gap-2 mb-10">
                  <iconify-icon icon="lucide:check-circle" class="text-[#3d7068]"></iconify-icon>
                  <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3d7068]">Verdict Delivered ✓</span>
                </div>
                <div className="h-px bg-[#e5e4de] w-full my-8"></div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-50">Verified On-Chain</span>
                    <span className="font-mono text-[9px] text-[#3d7068] font-bold">SIGNATURE VERIFIED ✓</span>
                  </div>
                </div>
                <Link to={`/escrow/${escrow.id}/dispute/verdict`} className="inline-block mt-10 font-mono text-[10px] tracking-[0.2em] uppercase text-[#3d7068] hover:underline">
                  View Full Verdict →
                </Link>
              </div>
            )}
          </div>

          {/* RIGHT: PAYOUT */}
          <div className="lg:col-span-4 space-y-10">
            <div className={`${styles.cardEditorial} p-8`}>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 block mb-6">Payout Status</span>
              {escrow.payout ? (
                <>
                  <div className="font-serif text-4xl text-[#3d7068] mb-4">{escrow.payout.amount} {escrow.payout.asset}</div>
                  <span className={styles.statusBadge}>DELIVERED</span>
                  <div className="h-px bg-[#e5e4de] w-full my-8"></div>
                  {escrow.payout.balanceBeforeXrp != null && escrow.payout.balanceAfterXrp != null && (
                    <>
                      <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 block mb-6">Account Balance Change</span>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs opacity-50">{escrow.payout.balanceBeforeXrp.toFixed(2)}</span>
                        <iconify-icon icon="lucide:arrow-right" class="opacity-20"></iconify-icon>
                        <span className="font-mono text-xs font-bold">{escrow.payout.balanceAfterXrp.toFixed(2)} XRP</span>
                      </div>
                      <div className="h-px bg-[#e5e4de] w-full my-8"></div>
                    </>
                  )}
                  <div className="space-y-8">
                    {(escrow.txs.releaseTxHash || escrow.txs.verdictTxHash) && (
                      <div
                        className="group cursor-pointer"
                        onClick={() => copyToClipboard((escrow.txs.releaseTxHash || escrow.txs.verdictTxHash)!)}
                      >
                        <span className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-50 flex items-center justify-between mb-2">
                          {escrow.txs.releaseTxHash ? 'Resolver Transaction' : 'Verdict Transaction'}
                          <iconify-icon icon="lucide:copy" class="opacity-0 group-hover:opacity-100 transition-opacity"></iconify-icon>
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-[10px] truncate opacity-80 group-hover:opacity-100 transition-all">
                            {truncateHash(escrow.txs.releaseTxHash || escrow.txs.verdictTxHash || '')}
                          </div>
                          <a
                            href={EXPLORER.coston2Tx((escrow.txs.releaseTxHash || escrow.txs.verdictTxHash)!)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <iconify-icon icon="lucide:external-link" class="text-xs opacity-40 hover:opacity-100"></iconify-icon>
                          </a>
                        </div>
                      </div>
                    )}

                    {escrow.txs.payoutXrplTxHash && (
                      <div className="group cursor-pointer" onClick={() => copyToClipboard(escrow.txs.payoutXrplTxHash!)}>
                        <span className="font-mono text-[9px] tracking-[0.2em] uppercase opacity-50 flex items-center justify-between mb-2">
                          XRPL Payout Transaction
                          <iconify-icon icon="lucide:copy" class="opacity-0 group-hover:opacity-100 transition-opacity"></iconify-icon>
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-[10px] truncate opacity-80 group-hover:opacity-100 transition-all">
                            {truncateHash(escrow.txs.payoutXrplTxHash)}
                          </div>
                          <a
                            href={EXPLORER.xrplTx(escrow.txs.payoutXrplTxHash)}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <iconify-icon icon="lucide:external-link" class="text-xs opacity-40 hover:opacity-100"></iconify-icon>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="font-mono text-xs opacity-40 uppercase tracking-widest">No payout recorded yet</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-10 mt-10">
          <a
            href={EXPLORER.coston2Address(escrow.contracts.escrowAddress)}
            target="_blank"
            rel="noreferrer"
            className={`${styles.cardEditorial} p-10 flex items-center justify-between group`}
          >
            <div>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-50 block mb-2">View Details</span>
              <h4 className="font-serif text-2xl uppercase">Coston2 Explorer</h4>
            </div>
            <iconify-icon icon="lucide:external-link" class="text-3xl opacity-20 group-hover:opacity-100 group-hover:text-[#3d7068] transition-all"></iconify-icon>
          </a>
          <Link to="/proof" className={`${styles.cardEditorial} p-10 flex items-center justify-between group`}>
            <div>
              <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-50 block mb-2">Verification</span>
              <h4 className="font-serif text-2xl uppercase">{isWeather ? 'FDC Verification' : 'FlareTeeManager'}</h4>
            </div>
            <iconify-icon icon="lucide:shield-check" class="text-3xl opacity-20 group-hover:opacity-100 group-hover:text-[#3d7068] transition-all"></iconify-icon>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
