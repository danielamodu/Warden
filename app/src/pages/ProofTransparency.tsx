import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Code2, ExternalLink, LockKeyhole, ServerCog } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { escrowService } from '../services';
import { useDispute } from '../hooks/useDispute';
import { useEscrowData } from '../hooks/useEscrowData';
import { copyToClipboard, truncateMiddle } from '../utils/format';
import { readLiveTeeMachine, type LiveTeeMachine } from '../chain/reads';
import { teeStatusLabel } from '../chain/abis';
import type { ContractInfo } from '../types';

function CopyAddress({ address }: { address: string }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); copyToClipboard(address); }} className="rounded-lg border border-white/10 p-2 text-zinc-500 hover:border-white/30 hover:text-white" title="Copy address">
      <span className="sr-only">Copy</span>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
    </button>
  );
}

/** Direct port of the Manus redesign's Proof.tsx — same layout, colors, and
 * card system — with every hardcoded array swapped for this app's real
 * IEscrowService/useDispute/useEscrowData calls. */
export default function ProofTransparency() {
  const [contracts, setContracts] = useState<ContractInfo[]>([]);
  const [active, setActive] = useState(0);
  const { dispute } = useDispute('phase3');
  const { escrow: phase2Escrow } = useEscrowData('phase2');

  // The enclave running right now, not whichever one ruled a past dispute —
  // Confidential Space keys are memory-only, so a relaunch mints a fresh
  // teeId and the old one goes dead (see PHASE3.md). Fetched independently of
  // `dispute` so this panel reflects live health even before any dispute has
  // ever run in this session.
  const [liveTee, setLiveTee] = useState<LiveTeeMachine | null>(null);
  const [liveTeeError, setLiveTeeError] = useState(false);

  useEffect(() => {
    escrowService.listContracts().then(setContracts);
  }, []);

  useEffect(() => {
    let cancelled = false;
    readLiveTeeMachine()
      .then((m) => {
        if (!cancelled) setLiveTee(m);
      })
      .catch(() => {
        if (!cancelled) setLiveTeeError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = contracts[active];

  return (
    <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar activeItem="docs" />

      <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1440px]">
          <div className="grid gap-12 border-b border-white/10 pb-14 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
              <div className="label text-[#b4f56b]">TRANSPARENCY PORTAL</div>
              <h1 className="display mt-5 max-w-4xl text-6xl leading-[.88] text-white lg:text-[7.4rem]">Verifiable<br /><span className="text-zinc-500">by code.</span></h1>
            </div>
            <div>
              <p className="max-w-md text-base leading-relaxed text-zinc-400">
                Inspect every smart contract, verification round, and payout rule directly. Trust is proven on-chain, never assumed.
              </p>
              <div className="mt-7 flex items-center gap-3 text-xs text-[#b4f56b]"><span className="h-px w-10 bg-[#b4f56b]" /> Coston2 testnet / Chain 114</div>
            </div>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
            <div className="rounded-2xl border border-[#72d7ff]/30 bg-[#72d7ff]/[.05] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#72d7ff]/10 text-[#72d7ff]"><ServerCog size={17} /></span>
                  <div><div className="text-sm text-white">Weather data feed</div><div className="label mt-1">LIVE / OPEN-METEO</div></div>
                </div>
                <span className="rounded-full border border-[#72d7ff]/30 bg-[#72d7ff]/10 px-2 py-1 text-[9px] text-[#72d7ff]">SYNCED</span>
              </div>
              <div className="mt-8 flex items-end justify-between">
                <div>
                  <div className="mono text-4xl tracking-[-.06em] text-white">#{phase2Escrow?.fdc?.votingRoundId ?? '…'}</div>
                  <div className="mt-2 text-xs text-zinc-500">verified weather check</div>
                </div>
                <div className="text-right">
                  <div className="mono text-2xl text-[#72d7ff]">{phase2Escrow?.condition.type === 'weather' ? `${phase2Escrow.condition.currentC ?? '…'}°C` : '…'}</div>
                  <div className="label mt-1">live reading</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-[#d5a5ff]/30 bg-[#d5a5ff]/[.05] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#d5a5ff]/10 text-[#d5a5ff]"><ServerCog size={17} /></span>
                  <div><div className="text-sm text-white">Secure enclave manager</div><div className="label mt-1">AUTOMATED</div></div>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[9px] ${
                    liveTeeError
                      ? 'border-red-400/30 bg-red-400/10 text-red-400'
                      : liveTee
                        ? 'border-[#b4f56b]/30 bg-[#b4f56b]/10 text-[#b4f56b]'
                        : 'border-white/15 bg-white/5 text-zinc-500'
                  }`}
                >
                  {liveTeeError ? 'UNREACHABLE' : liveTee ? teeStatusLabel(liveTee.status) : 'LOADING'}
                </span>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-[#0d1013]/60 p-3">
                  <div className="label">ENCLAVE ID</div>
                  <div className="mt-3 mono truncate text-sm text-zinc-300" title={liveTee?.teeId}>
                    {liveTee ? truncateMiddle(liveTee.teeId) : liveTeeError ? '—' : '…'}
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0d1013]/60 p-3">
                  <div className="label">EXTENSION</div>
                  <div className="mt-3 mono text-sm text-zinc-300">#{liveTee?.extensionId ?? '…'}</div>
                </div>
              </div>
              {/* This panel reads whichever enclave is answering /info right
                  now, live — not the id that ruled on a past dispute, which
                  goes stale the moment the TEE restarts and mints a fresh key
                  (see PHASE3.md). */}
              <div className="mt-2 text-[10px] text-zinc-600">Live enclave, checked on load — not a historical record.</div>
              <div className="mt-5 flex items-center gap-2 text-xs text-zinc-500"><LockKeyhole size={13} className="text-[#d5a5ff]" /> Evidence is fully encrypted before review.</div>
            </div>
          </div>

          <div className="mt-16">
            <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-6 md:flex-row md:items-end">
              <div><div className="label text-[#b4f56b]">CONTRACT REGISTRY</div><h2 className="display mt-3 text-4xl text-white lg:text-6xl">Source addresses.</h2></div>
              <a href="https://coston2-explorer.flare.network/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-[#72d7ff]">
                Open Coston2 explorer <ExternalLink size={13} />
              </a>
            </div>
            <div className="mt-8 grid gap-3 lg:grid-cols-2">
              {contracts.map((item, i) => (
                <div
                  key={item.address}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActive(i); }}
                  className={`cursor-pointer rounded-2xl border p-5 text-left transition-all ${active === i ? 'border-white/30 bg-white/[.06]' : 'border-white/10 bg-[#111518] hover:border-white/20'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b4f56b]/10 text-[#b4f56b]"><Code2 size={17} /></span>
                      <div><div className="text-sm text-white">{item.label}</div><div className="label mt-1">{item.description}</div></div>
                    </div>
                    <span className="flex items-center gap-1.5 text-[9px] text-[#b4f56b]"><span className="h-1.5 w-1.5 rounded-full bg-[#b4f56b]" />VERIFIED</span>
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-[#0d1013] p-3">
                    <span className="mono truncate text-[10px] text-zinc-400">{item.address}</span>
                    <CopyAddress address={item.address} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selected && (
            <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
              <div className="rounded-2xl border border-white/10 bg-[#111518] p-5">
                <div className="flex items-center justify-between"><div className="label">SELECTED CONTRACT</div><span className="h-2 w-2 rounded-full bg-[#b4f56b]" /></div>
                <h3 className="display mt-5 text-3xl text-white">{selected.label}</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-500">{selected.description}</p>
                <div className="mt-8 space-y-4">
                  <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs"><span className="text-zinc-600">network</span><span className="mono text-zinc-300">Coston2 / 114</span></div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-4 text-xs"><span className="text-zinc-600">address</span><span className="mono max-w-[210px] truncate text-zinc-300">{selected.address}</span></div>
                </div>
                <a href={selected.explorerUrl} target="_blank" rel="noreferrer" className="mt-8 flex items-center justify-between rounded-xl bg-white/[.06] px-4 py-3 text-sm text-zinc-200 transition-colors hover:bg-white/10">
                  <span>View on explorer</span><ExternalLink size={15} />
                </a>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#111518] p-5">
                <div className="label mb-6">LIVE DISPUTE RECORD (PHASE 3)</div>
                <div className="space-y-4 font-mono text-xs">
                  <div className="flex justify-between border-b border-white/8 pb-3"><span className="text-zinc-600">case ref</span><span className="text-zinc-300">{dispute?.caseRef ?? '…'}</span></div>
                  <div className="flex justify-between border-b border-white/8 pb-3"><span className="text-zinc-600">instruction sender</span><span className="truncate text-zinc-300" title={dispute?.instructionSenderAddress}>{dispute ? truncateMiddle(dispute.instructionSenderAddress) : '…'}</span></div>
                  <div className="flex justify-between border-b border-white/8 pb-3"><span className="text-zinc-600">instruction tx</span><span className="truncate text-[#8af5d1]" title={dispute?.instructionTxHash}>{dispute ? truncateMiddle(dispute.instructionTxHash) : '…'}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-600">status</span><span className="text-[#b4f56b]">{dispute?.status ?? '…'}</span></div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-16 rounded-2xl border border-white/10 bg-[#101417] p-6 lg:p-8">
            <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
              <div>
                <div className="label text-[#b4f56b]">TRUST MODEL</div>
                <h2 className="display mt-4 text-4xl text-white lg:text-6xl">No middlemen.<br /><span className="text-zinc-500">Just code and math.</span></h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { n: '01', sub: 'Flare Data Connector', c: 'Flare Data Connector checks real-world facts.' },
                  { n: '02', sub: 'Secure TEE hardware', c: 'Secure hardware confirms dispute rulings.' },
                  { n: '03', sub: 'Automated Payout', c: 'Smart contracts release funds instantly.' },
                ].map((item) => (
                  <div key={item.n} className="rounded-xl border border-white/10 bg-[#151a1e] p-4">
                    <div className="mono text-xs text-[#b4f56b]">{item.n}</div>
                    <div className="mt-10 text-sm text-white">{item.sub}</div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-600">{item.c}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-16 flex flex-col items-center gap-6 rounded-2xl border border-white/10 bg-white/[.02] p-12 text-center">
            <p className="max-w-2xl text-lg text-zinc-400">
              Comprehensive transaction history and attestation proofs are generated for every escrow release.
              Protocol performance and TEE uptime can be audited by any party using the instruction sender extension.
            </p>
            <div className="flex gap-4">
              <Link to="/create" className="rounded-full bg-[#b4f56b] px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#0b0d10]">Create Escrow</Link>
              <Link to="/dashboard" className="rounded-full border border-white/15 px-6 py-3 text-xs uppercase tracking-[0.15em] text-zinc-300 hover:border-white/40 hover:text-white">Dashboard</Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
