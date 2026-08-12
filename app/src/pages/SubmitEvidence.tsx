import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useEscrowData } from '../hooks/useEscrowData';
import { useWallet } from '../hooks/useWallet';
import { submitRuleOnEvidence } from '../chain/writes';
import { savePendingDispute } from '../chain/pendingDispute';
import { padEscrowId } from '../utils/format';
import styles from './SubmitEvidence.module.css';

export default function SubmitEvidence() {
  const { id = 'phase3' } = useParams<{ id: string }>();
  const { escrow } = useEscrowData(id);
  const { status: walletStatus, getSigner } = useWallet();
  const navigate = useNavigate();
  const [testimony, setTestimony] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (walletStatus !== 'connected') {
      setSubmitError('Connect your wallet first (Connect Wallet page) — Submit Evidence needs a real signer.');
      return;
    }
    if (!escrow) {
      setSubmitError('Escrow data is still loading — try again in a moment.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const signer = await getSigner();
      const onChainEscrowId = Number(escrow.onChainEscrowId);
      const result = await submitRuleOnEvidence(signer, onChainEscrowId);
      savePendingDispute({
        escrowId: id,
        onChainEscrowId,
        instructionId: result.instructionId,
        instructionTxHash: result.instructionTxHash,
        teeId: result.teeId,
        request: result.request,
        submittedAtUnix: Math.floor(Date.now() / 1000),
      });
      setSubmitted(true);
      // Evidence is in — move on to the TEE arbitration step automatically
      // rather than leaving the user stranded on a "submitted" screen with
      // only a sidebar link as the way forward.
      setTimeout(() => navigate(`/escrow/${id}/dispute/ruling`), 1500);
    } catch (err) {
      setSubmitError((err as Error).message || 'Failed to submit evidence.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f6f2] relative selection:bg-[#3d7068] selection:text-white">
      <BackgroundGrid />
      <NavBar />

      <main className="max-w-7xl mx-auto px-6 pt-48 pb-32 relative z-10">
        <section className="mb-12 pb-12 border-b border-[#e5e4de]">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 mb-4">Dispute Resolution — Evidence Phase</div>
          <h1 className="font-serif text-[6vw] leading-none uppercase font-light tracking-tighter mb-4">Submit Your Evidence</h1>
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">
            Escrow ID: {escrow ? `${padEscrowId(escrow.onChainEscrowId)} · ${escrow.contracts.escrowAddress}` : `…`}
          </div>
        </section>

        <div className="mb-16 p-8 border border-[#e5e4de] bg-[#3d7068]/5 flex flex-col md:flex-row items-center gap-6">
          <div className="w-12 h-12 border border-[#3d7068]/20 flex items-center justify-center">
            <iconify-icon icon="lucide:lock" class="text-2xl text-[#3d7068]"></iconify-icon>
          </div>
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#3d7068] mb-1">End-to-End Encrypted</div>
            <p className="font-sans italic text-base opacity-70">Your evidence is encrypted on-chain. Only authorized parties and TEE resolvers can access during active arbitration.</p>
          </div>
        </div>

        <section className="grid md:grid-cols-2 gap-px bg-[#e5e4de] border border-[#e5e4de] mb-24">
          <div className="bg-[#f7f6f2] p-12">
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 mb-8">Party A — You (Depositor)</div>
            <div className="space-y-10">
              <div className={`${styles.dashedUpload} p-12 text-center cursor-pointer group hover:bg-white/50 editorial-transition`}>
                <iconify-icon icon="lucide:upload-cloud" class="text-4xl opacity-20 group-hover:opacity-40 mb-4"></iconify-icon>
                <p className="font-sans text-sm opacity-50">Upload evidence or drag &amp; drop</p>
                <div className="mt-4 font-mono text-[9px] tracking-[0.2em] uppercase opacity-30">Max size 25MB (Encrypted)</div>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-[#e5e4de]"></div>
                <span className="font-mono text-[10px] opacity-40 uppercase">or</span>
                <div className="h-px flex-1 bg-[#e5e4de]"></div>
              </div>

              <div className="space-y-4">
                <label className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 block">Written Testimony</label>
                <textarea
                  rows={4}
                  value={testimony}
                  onChange={(e) => setTestimony(e.target.value)}
                  readOnly={submitted}
                  placeholder="DESCRIBE THE DISPUTE DETAILS IN FULL..."
                  className={`w-full bg-transparent border-b border-[#e5e4de] font-sans italic py-4 text-base opacity-70 placeholder:font-mono placeholder:text-[10px] placeholder:opacity-30 ${submitted ? 'opacity-30' : ''}`}
                ></textarea>
              </div>

              <div className="p-6 border border-[#e5e4de] bg-white/30 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <iconify-icon icon="lucide:file-text" class="text-2xl opacity-40"></iconify-icon>
                  <div>
                    <div className="font-mono text-[10px] uppercase opacity-70">Invoice-2024-0521.pdf</div>
                    <div className="font-mono text-[9px] opacity-30">420 KB • PREVIEW READY</div>
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <iconify-icon icon="lucide:x" class="text-lg opacity-40 hover:text-red-800"></iconify-icon>
                </button>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={submitted || submitting}
                  className="cta-button w-full py-6 text-white font-mono text-[10px] tracking-[0.25em] uppercase"
                  style={{ opacity: submitted ? 0.5 : 1, cursor: submitted ? 'not-allowed' : 'pointer' }}
                >
                  {submitted ? '✓ Submitted' : submitting ? 'Submitting…' : 'Submit Your Evidence'}
                </button>
                {submitted && (
                  <p className="mt-6 text-center font-mono text-[10px] tracking-[0.2em] text-[#3d7068] uppercase opacity-80">
                    ✓ Your evidence received — awaiting other party
                  </p>
                )}
                {submitError && (
                  <p className="mt-6 text-center font-mono text-[10px] tracking-[0.2em] text-red-700 uppercase break-words">
                    {submitError}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#f7f6f2] p-12 opacity-50 select-none">
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 mb-8">Party B — Counterparty (Receiver)</div>
            <div className="space-y-10">
              <div className={`h-[240px] ${styles.dashedUpload} flex flex-col items-center justify-center p-12 text-center pointer-events-none`}>
                <iconify-icon icon="lucide:hourglass" class="text-4xl opacity-10 mb-6"></iconify-icon>
                <div className="px-4 py-2 border border-[#e5e4de] font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">Awaiting submission</div>
              </div>
              <div className="space-y-6">
                <div className="h-px w-full bg-[#e5e4de]"></div>
                <p className="font-sans italic text-base opacity-40 text-center">This party hasn't submitted their supporting documentation yet.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-24 grid md:grid-cols-2 gap-12">
          <div className="p-12 border border-[#e5e4de] bg-[#f7f6f2]/50">
            <h2 className="font-serif text-3xl uppercase font-light mb-12 leading-tight">How Your Data<br />is Protected</h2>
            <div className="space-y-12">
              {[
                { icon: 'lucide:lock', title: 'Client-Side Encryption', body: 'Evidence is encrypted in your browser using the counterparty and TEE public keys before it ever leaves your machine.' },
                { icon: 'lucide:server', title: 'On-Chain Storage', body: 'Your encrypted payload is stored on the XRPL ledger with a cryptographic hash attestation for tamper-proof auditing.' },
                { icon: 'lucide:shield-check', title: 'TEE Verification', body: 'Only verified TEE executors and authorized dispute parties can decrypt the data during the secure arbitration window.' },
              ].map((row) => (
                <div key={row.title} className="flex gap-6">
                  <div className="w-10 h-10 border border-[#e5e4de] flex-shrink-0 flex items-center justify-center">
                    <iconify-icon icon={row.icon} class="opacity-40"></iconify-icon>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] tracking-[0.2em] uppercase mb-2">{row.title}</div>
                    <p className="font-sans text-sm opacity-70 leading-relaxed">{row.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-12">
            <h2 className="font-serif text-3xl uppercase font-light mb-12 leading-tight">What Happens<br />Next</h2>
            <div className="relative">
              <div className={styles.roadmapLine}></div>
              <div className="space-y-20">
                <div className="relative pl-12">
                  <div className="absolute left-0 top-2 w-8 h-8 bg-[#3d7068] text-white flex items-center justify-center font-mono text-[10px] z-10">01</div>
                  <h3 className="font-serif text-2xl uppercase mb-3">Awaiting Evidence</h3>
                  <p className="font-sans text-base opacity-70 leading-relaxed">The dispute resolution protocol officially triggers once both parties have submitted their primary evidence or the 48h window expires.</p>
                </div>
                <button
                  onClick={() => navigate(`/escrow/${id}/dispute/ruling`)}
                  className="relative pl-12 text-left block w-full"
                >
                  <div className="absolute left-0 top-2 w-8 h-8 border border-[#e5e4de] bg-[#f7f6f2] flex items-center justify-center font-mono text-[10px] z-10 opacity-40">02</div>
                  <h3 className="font-serif text-2xl uppercase mb-3 opacity-40">TEE Arbitration</h3>
                  <p className="font-sans text-base opacity-40 leading-relaxed">Encrypted evidence is reviewed within a secure enclave to determine the validity of the claims against the original escrow conditions.</p>
                </button>
                <div className="relative pl-12">
                  <div className="absolute left-0 top-2 w-8 h-8 border border-[#e5e4de] bg-[#f7f6f2] flex items-center justify-center font-mono text-[10px] z-10 opacity-40">03</div>
                  <h3 className="font-serif text-2xl uppercase mb-3 opacity-40">Verdict &amp; Payout</h3>
                  <p className="font-sans text-base opacity-40 leading-relaxed">The final outcome is recorded on-chain, and assets are automatically distributed to the determined wallet addresses.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
