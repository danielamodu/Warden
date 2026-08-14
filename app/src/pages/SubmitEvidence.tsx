import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Hourglass, Lock, Server, ShieldCheck, UploadCloud, X } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useEscrowData } from '../hooks/useEscrowData';
import { useWallet } from '../hooks/useWallet';
import { submitRuleOnEvidence } from '../chain/writes';
import { savePendingDispute } from '../chain/pendingDispute';
import { padEscrowId } from '../utils/format';

/**
 * No Manus design exists for this screen (evidence submission is a real,
 * multi-step encrypted write flow with no equivalent in the redesign) —
 * extrapolated from the dark/lime card system, borrowing the two-column
 * "party" split from the original app's own structure.
 */
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
      setTimeout(() => navigate(`/escrow/${id}/dispute/ruling`), 1500);
    } catch (err) {
      setSubmitError((err as Error).message || 'Failed to submit evidence.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar />

      <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-10 border-b border-white/10 pb-8">
            <div className="label text-[#b4f56b]">DISPUTE RESOLUTION — EVIDENCE PHASE</div>
            <h1 className="display mt-4 text-5xl leading-[.95] text-white lg:text-6xl">Submit your evidence.</h1>
            <div className="mono mt-4 text-xs text-zinc-500">
              Escrow ID: {escrow ? `${padEscrowId(escrow.onChainEscrowId)} · ${escrow.contracts.escrowAddress}` : '…'}
            </div>
          </div>

          <div className="mb-10 flex flex-col items-center gap-4 rounded-2xl border border-[#b4f56b]/20 bg-[#b4f56b]/[.04] p-6 md:flex-row">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#b4f56b]/20 text-[#b4f56b]"><Lock size={20} /></div>
            <div>
              <div className="label text-[#b4f56b]">END-TO-END ENCRYPTED</div>
              <p className="mt-1 text-sm text-zinc-400">Your evidence is ECIES-encrypted on-chain. Only authorized parties and TEE resolvers can access it during active arbitration.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-8">
              <div className="label mb-8">PARTY A — YOU (DEPOSITOR)</div>
              <div className="space-y-6">
                <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center transition-colors hover:border-white/30">
                  <UploadCloud className="mx-auto mb-4 text-zinc-600" size={32} />
                  <p className="text-sm text-zinc-400">Upload evidence or drag &amp; drop</p>
                  <div className="mt-3 label">MAX SIZE 25MB (ENCRYPTED)</div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[10px] uppercase text-zinc-600">or</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>

                <div>
                  <label className="label mb-3 block">WRITTEN TESTIMONY</label>
                  <textarea
                    rows={4}
                    value={testimony}
                    onChange={(e) => setTestimony(e.target.value)}
                    readOnly={submitted}
                    placeholder="Describe the dispute details in full…"
                    className={`w-full rounded-xl border border-white/15 bg-[#0d1013] p-4 text-sm text-zinc-200 outline-none transition-colors focus:border-[#b4f56b]/60 ${submitted ? 'opacity-40' : ''}`}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.02] p-4">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-zinc-500" />
                    <div>
                      <div className="text-xs text-zinc-300">Invoice-2024-0521.pdf</div>
                      <div className="mt-0.5 text-[10px] text-zinc-600">420 KB · preview ready</div>
                    </div>
                  </div>
                  <button className="text-zinc-600 hover:text-red-400"><X size={16} /></button>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitted || submitting}
                  className="w-full rounded-full bg-[#b4f56b] py-4 text-sm font-semibold text-[#0b0d10] transition-all disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitted ? 'Submitted' : submitting ? 'Submitting…' : 'Submit your evidence'}
                </button>
                {submitted && <p className="text-center text-xs uppercase tracking-wide text-[#b4f56b]">Your evidence received — awaiting other party</p>}
                {submitError && <p className="break-words text-center text-xs uppercase tracking-wide text-red-400">{submitError}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0e1114] p-8 opacity-60">
              <div className="label mb-8">PARTY B — COUNTERPARTY (RECEIVER)</div>
              <div className="flex h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 text-center">
                <Hourglass className="mb-4 text-zinc-700" size={28} />
                <div className="rounded-full border border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">Awaiting submission</div>
              </div>
              <p className="mt-6 text-center text-sm italic text-zinc-600">This party hasn't submitted their supporting documentation yet.</p>
            </div>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-8">
              <h2 className="display text-2xl text-white">How your data is protected.</h2>
              <div className="mt-8 space-y-6">
                {[
                  { icon: Lock, title: 'Client-side encryption', body: 'Evidence is encrypted in your browser using the TEE public key before it ever leaves your machine.' },
                  { icon: Server, title: 'On-chain storage', body: 'Your encrypted payload is stored on-chain with a cryptographic hash attestation for tamper-proof auditing.' },
                  { icon: ShieldCheck, title: 'TEE verification', body: 'Only verified TEE executors and authorized dispute parties can decrypt the data during the secure arbitration window.' },
                ].map((row) => (
                  <div key={row.title} className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-500"><row.icon size={16} /></div>
                    <div>
                      <div className="text-sm text-white">{row.title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{row.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#111518] p-8">
              <h2 className="display text-2xl text-white">What happens next.</h2>
              <div className="mt-8 space-y-8">
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#b4f56b] font-mono text-[10px] text-[#0b0d10]">01</div>
                  <div>
                    <div className="text-sm font-medium text-white">Awaiting evidence</div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">The dispute resolution protocol officially triggers once both parties have submitted their primary evidence or the 48h window expires.</p>
                  </div>
                </div>
                <button onClick={() => navigate(`/escrow/${id}/dispute/ruling`)} className="flex w-full gap-4 text-left">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 font-mono text-[10px] text-zinc-600">02</div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">TEE arbitration</div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600">Encrypted evidence is reviewed within a secure enclave to determine the validity of the claims against the original escrow conditions.</p>
                  </div>
                </button>
                <div className="flex gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 font-mono text-[10px] text-zinc-600">03</div>
                  <div>
                    <div className="text-sm font-medium text-zinc-500">Verdict &amp; payout</div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600">The final outcome is recorded on-chain, and assets are automatically distributed to the determined wallet addresses.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
