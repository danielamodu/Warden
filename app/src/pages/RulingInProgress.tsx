import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import WordReveal from '../components/WordReveal';
import { useDispute } from '../hooks/useDispute';
import { useEscrowData } from '../hooks/useEscrowData';
import { useWallet } from '../hooks/useWallet';
import { EXPLORER } from '../services/RealEscrowService';
import { copyToClipboard, truncateMiddle } from '../utils/format';
import { fetchActionResult } from '../chain/teeProxy';
import { pollForVerdict, submitVerdictOnChain, type TeeVerdict } from '../chain/writes';
import { loadPendingDispute, loadResolvedDispute, saveResolvedDispute } from '../chain/pendingDispute';
import styles from './RulingInProgress.module.css';

const POLL_INTERVAL_MS = 6000;

const PHASES = [
  { id: 1, title: 'Evidence Received', badge: 'Complete', status: 'Verified', detail: 'All cryptographic proofs and encrypted evidence items have been successfully received and validated by the network.' },
  { id: 2, title: 'TEE Analysis', badge: 'Active', status: 'Processing', detail: 'The FlareTeeManager is currently executing the dispute resolution logic within a secure, hardware-isolated environment to ensure integrity and privacy.' },
  { id: 3, title: 'Verdict Generation', badge: 'Pending', status: 'Queued', detail: 'Once analysis is complete, a cryptographically signed verdict will be generated inside the TEE.' },
];

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
  const [seconds, setSeconds] = useState(() =>
    pending ? Math.max(0, Math.floor(Date.now() / 1000) - pending.submittedAtUnix) : 0
  );
  const [pollStatus, setPollStatus] = useState<'idle' | 'polling' | 'ready' | 'submitting' | 'submitted' | 'error'>(
    alreadyResolved ? 'submitted' : pending ? 'polling' : 'idle'
  );
  const [pollError, setPollError] = useState<string | null>(null);
  const [verdictTxHash, setVerdictTxHash] = useState<string | null>(alreadyResolved?.verdictTxHash ?? null);
  const submittingRef = useRef(false);

  // Real wall-clock elapsed time since evidence was actually submitted (or
  // since this page loaded, if visited directly) — a genuine live timer,
  // not a pre-seeded fake "already 4m23s in" starting point.
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Live-poll the TEE extension proxy for the real signed verdict, then
  // submit it on-chain the moment it's ready — "poll for the verdict, then
  // submit it on-chain" as one continuous flow, per this task's spec.
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

  // Verdict just landed on-chain in this session — move on to the Verdict
  // page automatically rather than requiring a manual click on the sidebar
  // link. Deliberately does NOT fire for a historical dispute that was
  // already resolved before this page load (see freshlySubmitted).
  useEffect(() => {
    if (!freshlySubmitted) return;
    const t = setTimeout(() => navigate(`/escrow/${id}/dispute/verdict`), 1500);
    return () => clearTimeout(t);
  }, [freshlySubmitted, id, navigate]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="min-h-screen relative">
      <BackgroundGrid />
      <NavBar activeItem="docs" />

      <main className="pt-48 pb-32 max-w-7xl mx-auto px-6">
        <header className="mb-16">
          <nav className="flex gap-2 font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 mb-6">
            <Link to="/dashboard">Escrow</Link>
            <span>/</span>
            <Link to={`/escrow/${id}`}>Detail</Link>
            <span>/</span>
            <Link to={`/escrow/${id}/dispute/submit`}>Dispute</Link>
            <span>/</span>
            <span className="opacity-100">Ruling in Progress</span>
          </nav>
          <WordReveal as="h1" className="font-serif text-[5vw] leading-[1] uppercase font-light tracking-tighter mb-4">
            Dispute Resolution in Progress
          </WordReveal>
          <div className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60 flex items-center gap-2">
            Case Ref: {dispute?.caseRef ?? '…'}
            {dispute && (
              <button onClick={() => copyToClipboard(dispute.caseRef)} className="hover:text-[#3d7068] transition-colors">
                <iconify-icon icon="lucide:copy"></iconify-icon>
              </button>
            )}
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            <section className={`${styles.cardEditorial} border border-[#e5e4de] bg-[#f7f6f2]/50 p-12 text-center relative overflow-hidden group`}>
              <div className="relative z-10">
                <div className="mb-8 flex justify-center">
                  <div className="relative w-24 h-24">
                    <div className={`absolute inset-0 border-2 border-t-[#3d7068] border-r-transparent border-b-transparent border-l-transparent rounded-full ${styles.spinSlow}`}></div>
                    <div className={`absolute inset-4 border border-[#3d7068]/20 rounded-full ${styles.loaderPulse}`}></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <iconify-icon icon="lucide:cpu" class="text-4xl text-[#3d7068]"></iconify-icon>
                    </div>
                  </div>
                </div>
                <h2 className="font-mono text-sm tracking-[0.3em] uppercase mb-2">
                  {pollStatus === 'submitted'
                    ? 'VERDICT SUBMITTED ON-CHAIN'
                    : pollStatus === 'submitting'
                      ? 'SUBMITTING VERDICT…'
                      : pollStatus === 'ready'
                        ? 'VERDICT READY'
                        : pollStatus === 'error'
                          ? 'ATTENTION NEEDED'
                          : 'TEE PROCESSING'}
                </h2>
                <p className="font-sans text-lg opacity-70">
                  {pollStatus === 'submitted' && verdictTxHash
                    ? `submitVerdict() confirmed: ${verdictTxHash.slice(0, 14)}…`
                    : pollStatus === 'error' && pollError
                      ? pollError
                      : pending
                        ? `Live-polling the TEE extension proxy every ${POLL_INTERVAL_MS / 1000}s for instruction ${pending.instructionId.slice(0, 12)}…`
                        : 'Your dispute is being evaluated by FlareTeeManager'}
                </p>
              </div>
            </section>

            <section className={`${styles.cardEditorial} border border-[#e5e4de] p-10`}>
              <div className="grid md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <h3 className="font-serif text-xl uppercase mb-6">TEE Details</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-[#e5e4de]">
                      <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-60">Manager Address</span>
                      <span className="font-mono text-[10px] truncate max-w-[160px]" title={dispute?.teeManagerAddress}>
                        {dispute ? truncateMiddle(dispute.teeManagerAddress) : '…'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[#e5e4de]">
                      <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-60">Status</span>
                      <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-2 py-0.5 border-2 border-[#3d7068] text-[#3d7068]">{dispute?.teeStatus ?? '…'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-60">teeId</span>
                      <span className="font-mono text-[10px] truncate max-w-[160px]" title={dispute?.teeId}>
                        {dispute ? truncateMiddle(dispute.teeId) : '…'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="space-y-6 md:border-l border-[#e5e4de] md:pl-10">
                  <h3 className="font-serif text-xl uppercase mb-6">Transaction Details</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-[#e5e4de]">
                      <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-60">Instruction Tx</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] truncate max-w-[110px]" title={dispute?.instructionTxHash}>
                          {dispute ? truncateMiddle(dispute.instructionTxHash) : '…'}
                        </span>
                        {dispute && (
                          <button onClick={() => copyToClipboard(dispute.instructionTxHash)} className="hover:text-[#3d7068] transition-colors">
                            <iconify-icon icon="lucide:copy"></iconify-icon>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-[#e5e4de]">
                      <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-60">Extension ID</span>
                      <span className="font-sans text-[10px] opacity-70">{dispute?.extensionId ?? '…'}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="font-mono text-[10px] tracking-[0.1em] uppercase opacity-60">Explorer</span>
                      {dispute && (
                        <a
                          href={EXPLORER.coston2Tx(dispute.instructionTxHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10px] tracking-[0.1em] uppercase text-[#3d7068] hover:underline flex items-center gap-1"
                        >
                          Coston2 <iconify-icon icon="lucide:external-link"></iconify-icon>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-8">
              <WordReveal as="h2" className="font-serif text-3xl uppercase">Resolution Phases</WordReveal>

              <div className="hidden md:flex items-center gap-4 mb-12">
                <div className="flex flex-col items-center gap-4 flex-1">
                  <div className="w-full h-[60px] border border-[#3d7068] flex items-center justify-center bg-[#3d7068]/5">
                    <iconify-icon icon="lucide:check-circle" class="text-2xl text-[#3d7068]"></iconify-icon>
                  </div>
                  <span className="font-mono text-[10px] tracking-widest uppercase opacity-60">Evidence Received</span>
                </div>
                <div className={styles.timelineLine}><div className={`${styles.timelineLineFill} w-full`}></div></div>
                <div className="flex flex-col items-center gap-4 flex-1">
                  <div className="w-full h-[60px] border border-[#3d7068] flex items-center justify-center bg-white">
                    <iconify-icon icon="lucide:loader" class="text-2xl text-[#3d7068] animate-spin"></iconify-icon>
                  </div>
                  <span className="font-mono text-[10px] tracking-widest uppercase">TEE Analysis</span>
                </div>
                <div className={styles.timelineLine}><div className={`${styles.timelineLineFill} w-0`}></div></div>
                <div className="flex flex-col items-center gap-4 flex-1">
                  <div className="w-full h-[60px] border border-[#e5e4de] flex items-center justify-center opacity-40">
                    <iconify-icon icon="lucide:file-text" class="text-2xl"></iconify-icon>
                  </div>
                  <span className="font-mono text-[10px] tracking-widest uppercase opacity-40">Verdict Generation</span>
                </div>
                <div className={styles.timelineLine}><div className={`${styles.timelineLineFill} w-0`}></div></div>
                <div className="flex flex-col items-center gap-4 flex-1">
                  <div className="w-full h-[60px] border border-[#e5e4de] flex items-center justify-center opacity-40">
                    <iconify-icon icon="lucide:hash" class="text-2xl"></iconify-icon>
                  </div>
                  <span className="font-mono text-[10px] tracking-widest uppercase opacity-40">Finalization</span>
                </div>
              </div>

              <div className="space-y-4">
                {PHASES.map((phase) => {
                  const isOpen = activePhase === phase.id;
                  return (
                    <div
                      key={phase.id}
                      onClick={() => setActivePhase(isOpen ? 0 : phase.id)}
                      className={`${styles.cardEditorial} border border-[#e5e4de] transition-all cursor-pointer ${
                        phase.id === 1 ? 'opacity-70' : phase.id === 3 ? 'opacity-40' : ''
                      } ${phase.id === 2 ? 'border-l-2 border-l-[#3d7068]' : ''}`}
                    >
                      <div className="flex justify-between items-center p-6">
                        <div className="flex items-center gap-4">
                          <span className="font-mono text-[10px] opacity-40">{String(phase.id).padStart(2, '0')}</span>
                          <h4 className="font-mono uppercase text-sm">{phase.title}</h4>
                          <span
                            className="font-mono text-[10px] uppercase px-2 py-0.5 border"
                            style={{
                              borderColor: phase.badge === 'Pending' ? 'var(--border-color)' : 'var(--accent-color)',
                              color: phase.badge === 'Pending' ? undefined : 'var(--accent-color)',
                              opacity: phase.badge === 'Pending' ? 0.4 : 1,
                              backgroundColor: phase.badge === 'Active' ? 'rgba(61,112,104,0.05)' : undefined,
                            }}
                          >
                            {phase.badge}
                          </span>
                        </div>
                        <iconify-icon icon="lucide:chevron-down" class={`editorial-transition ${isOpen ? 'rotate-180' : ''}`}></iconify-icon>
                      </div>
                      <div className={`${styles.phaseContent} ${isOpen ? styles.phaseContentActive : ''} px-6 pb-6`}>
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex justify-between"><span className="font-mono text-[10px] uppercase opacity-60">Status</span><span className="font-mono text-[10px]">{phase.status}</span></div>
                            {phase.id === 2 && (
                              <div className="flex justify-between"><span className="font-mono text-[10px] uppercase opacity-60">Processing Time</span><span className="font-mono text-[10px]">{mins}m {secs}s</span></div>
                            )}
                          </div>
                          <p className="font-sans text-xs opacity-70">{phase.detail}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="space-y-8">
            <section className={`${styles.cardEditorial} border border-[#e5e4de] p-10`}>
              <h3 className="font-serif text-2xl uppercase mb-8">Case Summary</h3>
              <div className="space-y-6">
                <div className="flex flex-col gap-1 border-b border-[#e5e4de] pb-4">
                  <span className="font-mono text-[10px] uppercase opacity-60">Escrow Amount</span>
                  <span className="font-serif text-2xl">{escrow ? `${escrow.amount} ${escrow.amountAsset}` : '…'}</span>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase opacity-60">Escrow Contract</span>
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span title={escrow?.contracts.escrowAddress}>{escrow ? truncateMiddle(escrow.contracts.escrowAddress) : '…'}</span>
                      {escrow && (
                        <button onClick={() => copyToClipboard(escrow.contracts.escrowAddress)} className="opacity-40 hover:opacity-100">
                          <iconify-icon icon="lucide:copy"></iconify-icon>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-[10px] uppercase opacity-60">Dispute Resolver</span>
                    <div className="flex items-center justify-between font-mono text-[10px]">
                      <span title={escrow?.contracts.resolverAddress}>{escrow ? truncateMiddle(escrow.contracts.resolverAddress) : '…'}</span>
                      {escrow && (
                        <button onClick={() => copyToClipboard(escrow.contracts.resolverAddress)} className="opacity-40 hover:opacity-100">
                          <iconify-icon icon="lucide:copy"></iconify-icon>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <Link to="/proof" className={`${styles.cardEditorial} flex items-center justify-between p-6 border border-[#e5e4de] group`}>
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase">Transparency Panel</span>
                <iconify-icon icon="lucide:chevron-right" class="group-hover:translate-x-1 transition-transform"></iconify-icon>
              </Link>
              <Link to={`/escrow/${id}/dispute/verdict`} className={`${styles.cardEditorial} flex items-center justify-between p-6 border border-[#e5e4de] group`}>
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase">View Verdict</span>
                <iconify-icon icon="lucide:help-circle"></iconify-icon>
              </Link>
            </section>
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
