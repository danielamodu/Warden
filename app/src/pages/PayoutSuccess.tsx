import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Copy } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useEscrowData } from '../hooks/useEscrowData';
import { copyToClipboard } from '../utils/format';
import { EXPLORER } from '../services/RealEscrowService';
import { findXrplPayoutTx, getXrplBalanceXrp } from '../chain/xrpl';

interface LivePayout {
  amount: number;
  hash: string;
  balanceBefore: number;
  balanceAfter: number;
}

const XRPL_POLL_INTERVAL_MS = 5000;
const XRPL_POLL_MAX_ATTEMPTS = 40; // ~200s, mirrors 06-monitor-xrpl-payout.mjs's window

/**
 * No Manus design exists for this screen — extrapolated from the dark/lime
 * system's success-state treatment (lime badge + rounded transaction rows).
 */
export default function PayoutSuccess() {
  const { id = 'phase2' } = useParams<{ id: string }>();
  const { escrow, loading } = useEscrowData(id);

  const [livePayout, setLivePayout] = useState<LivePayout | null>(null);
  const [xrplNote, setXrplNote] = useState<string | null>(null);
  const [xrplPolling, setXrplPolling] = useState(false);

  useEffect(() => {
    if (!escrow || escrow.status !== 'released' || !escrow.beneficiaryXrplAddress) return;
    let cancelled = false;

    async function run() {
      setXrplPolling(true);
      setXrplNote(null);
      try {
        const startBalance = await getXrplBalanceXrp(escrow!.beneficiaryXrplAddress);
        let found = await findXrplPayoutTx(escrow!.beneficiaryXrplAddress);
        let attempts = 0;
        while (!found && !cancelled && attempts < XRPL_POLL_MAX_ATTEMPTS) {
          await new Promise((resolve) => setTimeout(resolve, XRPL_POLL_INTERVAL_MS));
          found = await findXrplPayoutTx(escrow!.beneficiaryXrplAddress);
          attempts++;
        }
        if (cancelled) return;
        if (found) {
          const endBalance = await getXrplBalanceXrp(escrow!.beneficiaryXrplAddress);
          setLivePayout({ amount: found.amountXrp, hash: found.hash, balanceBefore: startBalance, balanceAfter: endBalance });
        } else {
          setXrplNote('No incoming XRPL payment observed yet after live polling — the redemption may still be settling.');
        }
      } catch (err) {
        setXrplNote((err as Error).message || 'Live XRPL polling failed.');
      } finally {
        if (!cancelled) setXrplPolling(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [escrow?.beneficiaryXrplAddress, escrow?.status]);

  const resolverTx = escrow?.txs.releaseTxHash ?? escrow?.txs.verdictTxHash;
  const payoutTx = livePayout?.hash ?? escrow?.txs.payoutXrplTxHash;
  const displayAmount = livePayout ? livePayout.amount : escrow?.payout?.amount;
  const displayAsset = livePayout ? 'XRP' : escrow?.payout?.asset;

  return (
    <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar activeItem="payout" />

      <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#b4f56b]">
              <CheckCircle2 size={40} className="text-[#0b0d10]" />
            </div>
            <h1 className="display text-5xl leading-[.95] text-white lg:text-6xl">Escrow released successfully.</h1>
          </div>

          {loading || !escrow ? (
            <div className="py-16 text-center font-mono text-xs uppercase tracking-widest text-zinc-500">Loading payout…</div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-[#111518] p-8">
                  <div className="label mb-4">AMOUNT RECEIVED</div>
                  <div className="mono text-2xl text-[#b4f56b]">{displayAmount} {displayAsset}</div>
                  <div className="mt-4 inline-block rounded-full bg-[#b4f56b]/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#b4f56b]">
                    {livePayout ? 'Success (live XRPL)' : xrplPolling ? 'Polling XRPL…' : xrplNote ? 'Pending' : 'Success'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#111518] p-8">
                  <div className="label mb-4">WALLET BALANCE UPDATE</div>
                  <div className="mono flex items-center gap-4 text-lg">
                    <span className="text-zinc-500">{livePayout ? livePayout.balanceBefore.toFixed(2) : '…'} XRP</span>
                    <ArrowRight size={18} className="text-zinc-700" />
                    <span className="text-[#b4f56b]">{livePayout ? livePayout.balanceAfter.toFixed(2) : '…'} XRP</span>
                  </div>
                  {xrplNote && <p className="mt-4 text-[10px] uppercase tracking-wide text-zinc-600">{xrplNote}</p>}
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-[#111518] p-8">
                <h2 className="display mb-6 text-2xl text-white">Transaction Details</h2>
                <div>
                  {resolverTx && (
                    <div className="flex flex-col justify-between gap-3 border-b border-white/8 py-5 md:flex-row md:items-center">
                      <div className="label">{escrow.txs.releaseTxHash ? 'RESOLVER TRANSACTION' : 'VERDICT TRANSACTION'}</div>
                      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.02] px-3 py-2">
                        <span className="mono max-w-[300px] truncate text-xs text-zinc-300 md:max-w-none">{resolverTx}</span>
                        <button className="text-zinc-500 hover:text-[#b4f56b]" onClick={() => copyToClipboard(resolverTx)}><Copy size={13} /></button>
                      </div>
                    </div>
                  )}
                  {payoutTx && (
                    <div className="flex flex-col justify-between gap-3 border-b border-white/8 py-5 md:flex-row md:items-center">
                      <div className="label">XRPL PAYOUT TRANSACTION</div>
                      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[.02] px-3 py-2">
                        <span className="mono max-w-[300px] truncate text-xs text-zinc-300 md:max-w-none">{payoutTx}</span>
                        <button className="text-zinc-500 hover:text-[#b4f56b]" onClick={() => copyToClipboard(payoutTx)}><Copy size={13} /></button>
                      </div>
                    </div>
                  )}
                  {escrow.fdc && (
                    <div className="flex flex-col justify-between gap-3 border-b border-white/8 py-5 md:flex-row md:items-center">
                      <div className="label">FDC VERIFICATION ROUND</div>
                      <div className="mono text-sm text-zinc-300">{escrow.fdc.votingRoundId}</div>
                    </div>
                  )}
                  <div className="flex flex-col justify-between gap-3 py-5 md:flex-row md:items-center">
                    <div className="label">BENEFICIARY XRPL ADDRESS</div>
                    <div className="mono text-xs text-zinc-400">{escrow.beneficiaryXrplAddress}</div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex flex-col justify-center gap-4 md:flex-row">
                {resolverTx && (
                  <a href={EXPLORER.coston2Tx(resolverTx)} target="_blank" rel="noreferrer" className="rounded-full bg-[#b4f56b] px-8 py-4 text-center text-sm font-semibold text-[#0b0d10]">
                    View Transaction
                  </a>
                )}
                <Link to="/create" className="rounded-full border border-white/15 px-8 py-4 text-center text-sm text-zinc-300 transition-colors hover:border-white/40 hover:text-white">
                  Create New Escrow
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
