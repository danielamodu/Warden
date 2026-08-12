import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import WordReveal from '../components/WordReveal';
import { useEscrowData } from '../hooks/useEscrowData';
import { copyToClipboard } from '../utils/format';
import { EXPLORER } from '../services/RealEscrowService';
import { findXrplPayoutTx, getXrplBalanceXrp } from '../chain/xrpl';
import styles from './PayoutSuccess.module.css';

interface LivePayout {
  amount: number;
  hash: string;
  balanceBefore: number;
  balanceAfter: number;
}

const XRPL_POLL_INTERVAL_MS = 5000;
const XRPL_POLL_MAX_ATTEMPTS = 40; // ~200s, mirrors 06-monitor-xrpl-payout.mjs's window

export default function PayoutSuccess() {
  const { id = 'phase2' } = useParams<{ id: string }>();
  const { escrow, loading } = useEscrowData(id);

  const [livePayout, setLivePayout] = useState<LivePayout | null>(null);
  const [xrplNote, setXrplNote] = useState<string | null>(null);
  const [xrplPolling, setXrplPolling] = useState(false);

  // Live-poll XRPL testnet for the actual delivered payment, same pattern
  // (and same meta.delivered_amount gotcha) as
  // scripts/phase3/06-monitor-xrpl-payout.mjs — resolves immediately for
  // already-settled historical escrows (the payment is already the most
  // recent one), and genuinely polls for a freshly-resolved dispute.
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
    <div className="min-h-screen relative">
      <BackgroundGrid />
      <NavBar activeItem="payout" />

      <main className="pt-32 pb-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col items-center mb-10">
            <div className={`${styles.successBadge} w-20 h-20 bg-[#3d7068] rounded-full flex items-center justify-center mb-8`}>
              <iconify-icon icon="lucide:check-circle" class="text-4xl text-white"></iconify-icon>
            </div>
            <WordReveal as="h1" className="font-serif text-5xl md:text-6xl uppercase font-light tracking-tighter text-center">
              Escrow Released Successfully
            </WordReveal>
          </div>

          {loading || !escrow ? (
            <div className="text-center font-mono text-xs opacity-40 uppercase tracking-widest py-12">Loading payout…</div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-px bg-[#e5e4de] border border-[#e5e4de] mb-px">
                <div className={`${styles.cardEditorial} bg-[#f7f6f2] p-10`}>
                  <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 mb-4">Amount Received</div>
                  <div className="font-mono text-2xl text-[#3d7068] mb-2">{displayAmount} {displayAsset}</div>
                  <div className="inline-block bg-[#3d7068]/10 text-[#3d7068] font-mono text-[10px] tracking-[0.2em] uppercase px-3 py-1 rounded-[2px]">
                    {livePayout ? 'Success (live XRPL)' : xrplPolling ? 'Polling XRPL…' : xrplNote ? 'Pending' : 'Success'}
                  </div>
                </div>
                <div className={`${styles.cardEditorial} bg-[#f7f6f2] p-10`}>
                  <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 mb-4">Wallet Balance Update</div>
                  <div className="flex items-center gap-6 font-mono">
                    <div className="text-lg opacity-60">{livePayout ? livePayout.balanceBefore.toFixed(2) : '…'} XRP</div>
                    <iconify-icon icon="lucide:arrow-right" class="text-xl opacity-20"></iconify-icon>
                    <div className="text-lg text-[#3d7068]">{livePayout ? livePayout.balanceAfter.toFixed(2) : '…'} XRP</div>
                  </div>
                  {xrplNote && <p className="mt-4 font-mono text-[9px] opacity-50 uppercase tracking-wide">{xrplNote}</p>}
                </div>
              </div>

              <div className={`${styles.cardEditorial} border border-[#e5e4de] p-10`}>
                <h2 className="font-serif text-2xl uppercase font-light mb-8">Transaction Details</h2>
                <div className="space-y-0">
                  {resolverTx && (
                    <div className="py-6 border-b border-[#e5e4de] flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40">
                        {escrow.txs.releaseTxHash ? 'Resolver Transaction' : 'Verdict Transaction'}
                      </div>
                      <div className="flex items-center gap-3 bg-white/50 px-3 py-2 border border-[#e5e4de] rounded-[2px]">
                        <span className="font-mono text-xs truncate max-w-[300px] md:max-w-none">{resolverTx}</span>
                        <button
                          className={`${styles.copyTrigger} relative flex items-center text-gray-400 hover:text-[#3d7068]`}
                          onClick={() => copyToClipboard(resolverTx)}
                        >
                          <iconify-icon icon="lucide:copy" class="text-sm"></iconify-icon>
                          <span className={styles.tooltip}>Copied!</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {payoutTx && (
                    <div className="py-6 border-b border-[#e5e4de] flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40">XRPL Payout Transaction</div>
                      <div className="flex items-center gap-3 bg-white/50 px-3 py-2 border border-[#e5e4de] rounded-[2px]">
                        <span className="font-mono text-xs truncate max-w-[300px] md:max-w-none">{payoutTx}</span>
                        <button
                          className={`${styles.copyTrigger} relative flex items-center text-gray-400 hover:text-[#3d7068]`}
                          onClick={() => copyToClipboard(payoutTx)}
                        >
                          <iconify-icon icon="lucide:copy" class="text-sm"></iconify-icon>
                          <span className={styles.tooltip}>Copied!</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {escrow.fdc && (
                    <div className="py-6 border-b border-[#e5e4de] flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40">FDC Verification Round</div>
                      <div className="font-mono text-sm">{escrow.fdc.votingRoundId}</div>
                    </div>
                  )}
                  <div className="py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40">Beneficiary XRPL Address</div>
                    <div className="font-mono text-xs opacity-80">{escrow.beneficiaryXrplAddress}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row justify-center gap-4 mt-10">
                {resolverTx && (
                  <a
                    href={EXPLORER.coston2Tx(resolverTx)}
                    target="_blank"
                    rel="noreferrer"
                    className="cta-button px-8 py-4 text-white font-mono text-[10px] tracking-[0.25em] uppercase rounded-[2px] text-center"
                  >
                    View Transaction
                  </a>
                )}
                <Link
                  to="/create"
                  className="editorial-transition px-8 py-4 border border-[#e5e4de] hover:border-[#3d7068] hover:bg-white/50 text-[#1c1c1c] font-mono text-[10px] tracking-[0.25em] uppercase rounded-[2px] text-center"
                >
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
