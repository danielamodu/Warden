import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Copy, Cpu, ExternalLink } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useDispute } from '../hooks/useDispute';
import { useEscrowData } from '../hooks/useEscrowData';
import { useWallet } from '../hooks/useWallet';
import { EXPLORER } from '../services/RealEscrowService';
import { copyToClipboard, truncateMiddle } from '../utils/format';
import { fetchActionResult } from '../chain/teeProxy';
import { pollForVerdict, submitVerdictOnChain, type TeeVerdict } from '../chain/writes';
import { loadPendingDispute, loadResolvedDispute, saveResolvedDispute } from '../chain/pendingDispute';

const POLL_INTERVAL_MS = 6000;

const PHASES = [
  { id: 1, title: 'Evidence Received', badge: 'Complete', status: 'Verified', detail: 'All cryptographic proofs and encrypted evidence items have been successfully received and validated by the network.' },
  { id: 2, title: 'TEE Analysis', badge: 'Active', status: 'Processing', detail: 'The FlareTeeManager is currently executing the dispute resolution logic within a secure, hardware-isolated environment to ensure integrity and privacy.' },
  { id: 3, title: 'Verdict Generation', badge: 'Pending', status: 'Queued', detail: "Once analysis is complete, a cryptographically signed verdict will be generated inside the TEE." },
];

/**
 * No Manus design exists for this screen — extrapolated from Proof.tsx's
 * "AttestationPulse" live-processing visual (spinning indicator, mono
 * countdown) applied to this app's real TEE verdict polling loop.
 */
export default function RulingInProgress() {
  const { id = 'phase3' } = useParams<{ id: string }>();
  const { dispute } = useDispute(id);
  const { escrow } = useEscrowData(id);
  const { status: walletStatus, getSigner } = useWallet();
  const navigate = useNavigate();
  const [activePhase, setActivePhase] = useState(2);
  const [freshlySubmitted, setFreshlySubmitted] = useState(false);

  const pending = loadPendingDispute(id);
  const alreadyResolved = loadResolvedDispute(id);
  const [seconds, setSeconds] = useState(() => (pending ? Math.max(0, Math.floor(Date.now() / 1000) - pending.submittedAtUnix) : 0));
  const [pollStatus, setPollStatus] = useState<'idle' | 'polling' | 'ready' | 'submitting' | 'submitted' | 'error'>(
    alreadyResolved ? 'submitted' : pending ? 'polling' : 'idle'
  );
  const [pollError, setPollError] = useState<string | null>(null);
  const [verdictTxHash, setVerdictTxHash] = useState<string | null>(alreadyResolved?.verdictTxHash ?? null);
  const submittingRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!pending || alreadyResolved) return;
    let cancelled = false;

    async function tick() {
      if (submittingRef.current || cancelled) return;
      try {
        const verdict: TeeVerdict | null = await pollForVerdict(() => fetchActionResult(pending!.instructionId));
        if (cancelled) return;
        if (!verdict) {
          setPollStatus('polling');
          return;
        }
        setPollStatus('ready');
        if (walletStatus !== 'connected') {
          setPollError('Verdict is ready — connect your wallet to submit it on-chain (submitVerdict is a real signed transaction).');
          return;
        }
        submittingRef.current = true;
        setPollStatus('submitting');
        const signer = await getSigner();
        const result = await submitVerdictOnChain(signer, pending!.teeId, verdict);
        saveResolvedDispute({
          escrowId: id,
          teeId: pending!.teeId,
          instructionId: pending!.instructionId,
          instructionTxHash: pending!.instructionTxHash,
          verdict,
          verdictTxHash: result.verdictTxHash,
        });
        if (!cancelled) {
          setVerdictTxHash(result.verdictTxHash);
          setPollStatus('submitted');
          setFreshlySubmitted(true);
        }
      } catch (err) {
        if (!cancelled) {
          setPollError((err as Error).message || 'Polling/submitting the verdict failed.');
          setPollStatus('error');
        }
      } finally {
        submittingRef.current = false;
      }
    }

    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, walletStatus]);

  useEffect(() => {
    if (!freshlySubmitted) return;
    const t = setTimeout(() => navigate(`/escrow/${id}/dispute/verdict`), 1500);
    return () => clearTimeout(t);
  }, [freshlySubmitted, id, navigate]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar activeItem="docs" />

      <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1440px]">
          <header className="mb-10">
            <nav className="mb-5 flex gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
              <Link to="/dashboard" className="hover:text-zinc-300">Escrow</Link><span>/</span>
              <Link to={`/escrow/${id}`} className="hover:text-zinc-300">Detail</Link><span>/</span>
              <Link to={`/escrow/${id}/dispute/submit`} className="hover:text-zinc-300">Dispute</Link><span>/</span>
              <span className="text-zinc-300">Ruling in progress</span>
            </nav>
            <h1 className="display text-5xl leading-[.95] text-white lg:text-6xl">Dispute resolution in progress.</h1>
            <div className="mono mt-4 flex items-center gap-2 text-xs text-zinc-500">
              Case ref: {dispute?.caseRef ?? '…'}
              {dispute && (
                <button onClick={() => copyToClipboard(dispute.caseRef)} className="hover:text-[#b4f56b]"><Copy size={12} /></button>
              )}
            </div>
          </header>

          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="rounded-2xl border border-[#b4f56b]/20 bg-[#b4f56b]/[.03] p-12 text-center">
                <div className="mb-6 flex justify-center">
                  <div className="relative h-20 w-20">
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-[#b4f56b] border-r-transparent border-b-transparent border-l-transparent" />
                    <div className="absolute inset-4 animate-pulse rounded-full border border-[#b4f56b]/30" />
                    <div className="absolute inset-0 flex items-center justify-center"><Cpu size={30} className="text-[#b4f56b]" /></div>
                  </div>
                </div>
                <h2 className="mono text-sm uppercase tracking-[0.25em] text-white">
                  {pollStatus === 'submitted'
                    ? 'Verdict submitted on-chain'
                    : pollStatus === 'submitting'
                      ? 'Submitting verdict…'
                      : pollStatus === 'ready'
                        ? 'Verdict ready'
                        : pollStatus === 'error'
                          ? 'Attention needed'
                          : 'TEE processing'}
                </h2>
                <p className="mt-4 text-sm text-zinc-400">
                  {pollStatus === 'submitted' && verdictTxHash
                    ? `submitVerdict() confirmed: ${verdictTxHash.slice(0, 14)}…`
                    : pollStatus === 'error' && pollError
                      ? pollError
                      : pending
                        ? `Live-polling the TEE extension proxy every ${POLL_INTERVAL_MS / 1000}s for instruction ${pending.instructionId.slice(0, 12)}…`
                        : 'Your dispute is being evaluated by FlareTeeManager.'}
                </p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-[#111518] p-8">
                <div className="grid gap-8 md:grid-cols-2">
                  <div>
                    <h3 className="display mb-5 text-xl text-white">TEE Details</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-white/8 py-2 text-xs">
                        <span className="label">MANAGER ADDRESS</span>
                        <span className="mono truncate text-zinc-300" title={dispute?.teeManagerAddress}>{dispute ? truncateMiddle(dispute.teeManagerAddress) : '…'}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/8 py-2 text-xs">
                        <span className="label">STATUS</span>
                        <span className="rounded-full border border-[#b4f56b]/40 px-2 py-0.5 text-[10px] uppercase text-[#b4f56b]">{dispute?.teeStatus ?? '…'}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 text-xs">
                        <span className="label">TEE ID</span>
                        <span className="mono truncate text-zinc-300" title={dispute?.teeId}>{dispute ? truncateMiddle(dispute.teeId) : '…'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="md:border-l md:border-white/10 md:pl-8">
                    <h3 className="display mb-5 text-xl text-white">Transaction Details</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-white/8 py-2 text-xs">
                        <span className="label">INSTRUCTION TX</span>
                        <div className="flex items-center gap-2">
                          <span className="mono truncate text-zinc-300" title={dispute?.instructionTxHash}>{dispute ? truncateMiddle(dispute.instructionTxHash) : '…'}</span>
                          {dispute && <button onClick={() => copyToClipboard(dispute.instructionTxHash)} className="text-zinc-600 hover:text-[#b4f56b]"><Copy size={12} /></button>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/8 py-2 text-xs">
                        <span className="label">EXTENSION ID</span>
                        <span className="text-zinc-400">{dispute?.extensionId ?? '…'}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 text-xs">
                        <span className="label">EXPLORER</span>
                        {dispute && (
                          <a href={EXPLORER.coston2Tx(dispute.instructionTxHash)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#b4f56b] hover:underline">
                            Coston2 <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="display text-2xl text-white">Resolution phases</h2>
                {PHASES.map((phase) => {
                  const isOpen = activePhase === phase.id;
                  return (
                    <div
                      key={phase.id}
                      onClick={() => setActivePhase(isOpen ? 0 : phase.id)}
                      className={`cursor-pointer rounded-2xl border border-white/10 bg-[#111518] transition-all ${phase.id === 1 ? 'opacity-70' : phase.id === 3 ? 'opacity-40' : ''} ${phase.id === 2 ? 'border-l-2 border-l-[#b4f56b]' : ''}`}
                    >
                      <div className="flex items-center justify-between p-5">
                        <div className="flex items-center gap-4">
                          <span className="mono text-[10px] text-zinc-600">{String(phase.id).padStart(2, '0')}</span>
                          <h4 className="text-sm uppercase text-zinc-200">{phase.title}</h4>
                          <span
                            className="rounded-full border px-2 py-0.5 text-[10px] uppercase"
                            style={{
                              borderColor: phase.badge === 'Pending' ? 'rgba(255,255,255,.15)' : '#b4f56b',
                              color: phase.badge === 'Pending' ? '#71717a' : '#b4f56b',
                              backgroundColor: phase.badge === 'Active' ? 'rgba(180,245,107,.08)' : undefined,
                            }}
                          >
                            {phase.badge}
                          </span>
                        </div>
                        <ChevronDown size={16} className={`text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                      {isOpen && (
                        <div className="grid gap-4 px-5 pb-5 md:grid-cols-2">
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between"><span className="text-zinc-600">Status</span><span className="text-zinc-300">{phase.status}</span></div>
                            {phase.id === 2 && <div className="flex justify-between"><span className="text-zinc-600">Processing time</span><span className="text-zinc-300">{mins}m {secs}s</span></div>}
                          </div>
                          <p className="text-xs text-zinc-500">{phase.detail}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-2xl border border-white/10 bg-[#111518] p-8">
                <h3 className="display mb-6 text-xl text-white">Case Summary</h3>
                <div className="space-y-5">
                  <div className="border-b border-white/8 pb-4">
                    <div className="label mb-1">ESCROW AMOUNT</div>
                    <div className="display text-2xl text-white">{escrow ? `${escrow.amount} ${escrow.amountAsset}` : '…'}</div>
                  </div>
                  <div>
                    <div className="label mb-2">ESCROW CONTRACT</div>
                    <div className="mono flex items-center justify-between text-xs">
                      <span title={escrow?.contracts.escrowAddress}>{escrow ? truncateMiddle(escrow.contracts.escrowAddress) : '…'}</span>
                      {escrow && <button onClick={() => copyToClipboard(escrow.contracts.escrowAddress)} className="text-zinc-600 hover:text-white"><Copy size={12} /></button>}
                    </div>
                  </div>
                  <div>
                    <div className="label mb-2">DISPUTE RESOLVER</div>
                    <div className="mono flex items-center justify-between text-xs">
                      <span title={escrow?.contracts.resolverAddress}>{escrow ? truncateMiddle(escrow.contracts.resolverAddress) : '…'}</span>
                      {escrow && <button onClick={() => copyToClipboard(escrow.contracts.resolverAddress)} className="text-zinc-600 hover:text-white"><Copy size={12} /></button>}
                    </div>
                  </div>
                </div>
              </section>
              <Link to="/proof" className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#111518] p-5 text-sm text-zinc-200 transition-colors hover:border-white/25">
                Transparency panel <ChevronRight size={15} className="text-zinc-600" />
              </Link>
              <Link to={`/escrow/${id}/dispute/verdict`} className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#111518] p-5 text-sm text-zinc-200 transition-colors hover:border-white/25">
                View verdict <ChevronRight size={15} className="text-zinc-600" />
              </Link>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
