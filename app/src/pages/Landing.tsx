import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ExternalLink,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Waves,
  Zap,
} from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { PHASE2, XRPL_EXPLORER_TX, COSTON2_EXPLORER } from '../chain/config';
import { getCurrentTemperatureC } from '../chain/weather';
import { readWeatherCondition } from '../chain/reads';

const flow = [
  { number: '01', title: 'Lock XRP', copy: 'Bridge native XRP into secure FXRP on Flare to start your smart escrow.', icon: Waves, accent: '#72d7ff' },
  { number: '02', title: 'Set terms', copy: 'Define the exact payout condition and recipient address directly in the vault.', icon: LockKeyhole, accent: '#b4f56b' },
  { number: '03', title: 'Verify condition', copy: 'Flare Data Connector checks real-world data automatically without human bias.', icon: Zap, accent: '#b4f56b' },
  { number: '04', title: 'Secure ruling', copy: 'If a dispute occurs, a secure enclave reviews the evidence and signs a verdict.', icon: ShieldCheck, accent: '#d5a5ff' },
  { number: '05', title: 'Automatic release', copy: 'Funds release instantly to the correct recipient once terms are met.', icon: Check, accent: '#ffe278' },
];

// Only "Weather agreements" is real — WardenWeatherResolver + the live
// Open-Meteo/FDC path is the only condition type this codebase actually
// implements (see CreateEscrow's condition-type picker: weather is the only
// enabled option, delivery/market/oracle are disabled "Coming soon").
// "Trade finance" and "IP licensing" have no resolver, no tracking
// integration, and no royalty mechanism anywhere in this codebase — they're
// presented here as roadmap items, using the same "NEXT / 0x" framing and
// language as the roadmap section below (03 / More resolver types: "Support
// for logistics, freight, and digital commerce milestones") so this section
// doesn't contradict that one.
const useCases = {
  'Weather agreements': {
    status: 'live',
    kicker: 'WEATHER DEPOSIT',
    title: 'Turn weather thresholds into automated payouts.',
    copy: 'When temperature or rainfall crosses your agreed limit, Flare Data Connector verifies the data and triggers the release instantly.',
    metric: '29.9°C',
    metricLabel: 'verified temperature',
    chip: 'Open-Meteo API verified',
    visual: 'weather',
  },
  'Trade finance': {
    status: 'soon',
    kicker: 'ROADMAP · NEXT / 03',
    title: 'Release payment only when shipment milestones clear.',
    copy: 'Not built yet. Planned as a future resolver type — cargo and logistics milestones tracked toward automated release, the same "more resolver types" item on the roadmap below.',
    metric: 'Planned',
    metricLabel: 'more resolver types',
    chip: 'Not yet available — no live resolver',
    visual: 'trade',
  },
  'IP licensing': {
    status: 'soon',
    kicker: 'ROADMAP · FUTURE RESOLVER',
    title: 'Automate creator royalties based on verifiable usage.',
    copy: 'Not built yet. No royalty or usage-attestation mechanism exists in this protocol today — this is an illustration of a future resolver type, not a live feature.',
    metric: 'Planned',
    metricLabel: 'future resolver type',
    chip: 'Not yet available — no live resolver',
    visual: 'ip',
  },
} as const;

type UseCase = keyof typeof useCases;

function WeatherVisual() {
  return (
    <div className="min-h-[240px] rounded-2xl border border-white/10 bg-[#161b1d] p-5">
      <div className="flex items-center justify-between">
        <span className="label">LIVE WEATHER CHECK</span>
        <span className="mono text-[10px] text-[#b4f56b]">ATTESTED</span>
      </div>
      <div className="mt-8 rounded-xl border border-white/10 bg-[#0d1013] p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-300">Dubai temperature</span>
          <span className="mono text-sm text-[#b4f56b]">29.9°C</span>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-white/10">
          <div className="h-full w-[78%] rounded-full bg-[#b4f56b]" />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-zinc-500">
          <span>Target: &gt; 28°C</span>
          <span className="text-[#b4f56b]">Condition met</span>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs">
        <span className="text-zinc-500">Automatic payout</span>
        <span className="mono text-zinc-300">FXRP → Recipient</span>
      </div>
    </div>
  );
}

function TradeVisual() {
  return (
    <div className="relative min-h-[240px] overflow-hidden rounded-2xl border border-dashed border-white/15 bg-[#161b1d]/60 p-5 grayscale">
      <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/[.04] px-2.5 py-1 text-[9px] uppercase tracking-[.1em] text-zinc-400">Coming soon</div>
      <div className="flex items-center justify-between">
        <span className="label">SHIPMENT MILESTONE</span>
        <span className="mono text-[10px] text-zinc-500">MOCKUP</span>
      </div>
      <div className="mt-8 rounded-xl border border-white/10 bg-[#0d1013] p-4 opacity-60">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-400">Rotterdam → Jebel Ali</span>
          <span className="mono text-xs text-zinc-500">Not tracked</span>
        </div>
        <div className="mt-4 h-1.5 rounded-full bg-white/10">
          <div className="h-full w-[92%] rounded-full bg-zinc-600" />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
          <span>Customs check</span>
          <span>No live resolver</span>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs">
        <span className="text-zinc-600">Release status</span>
        <span className="mono text-zinc-500">Not built — roadmap item</span>
      </div>
    </div>
  );
}

function IpVisual() {
  return (
    <div className="relative min-h-[240px] overflow-hidden rounded-2xl border border-dashed border-white/15 bg-[#161b1d]/60 p-5 grayscale">
      <div className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/[.04] px-2.5 py-1 text-[9px] uppercase tracking-[.1em] text-zinc-400">Coming soon</div>
      <div className="flex items-center justify-between">
        <span className="label">ROYALTY TRIGGER</span>
        <span className="mono text-[10px] text-zinc-500">MOCKUP</span>
      </div>
      <div className="mt-10 rounded-xl border border-dashed border-white/15 bg-white/[.02] p-4 opacity-60">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[.06] text-zinc-500">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="text-sm font-medium text-zinc-400">No usage-attestation mechanism</div>
            <div className="mt-1 text-xs text-zinc-600">Illustrative only — not implemented</div>
          </div>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[86%] rounded-full bg-zinc-600" />
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
          <span>—</span>
          <span>—</span>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs">
        <span className="text-zinc-600">Payout route</span>
        <span className="mono text-zinc-500">Not built — roadmap item</span>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [activeUseCase, setActiveUseCase] = useState<UseCase>('Weather agreements');
  const [activeFlow, setActiveFlow] = useState(0);
  const roadmapRef = useRef<HTMLDivElement>(null);

  // The hero card shows the one escrow this contract actually processed:
  // already settled and paid out on XRPL. The temperature beside it is the
  // live reading from the same Open-Meteo location the FDC attestation used,
  // and the threshold is read from WardenWeatherResolver on-chain rather than
  // being restated here — so neither number can drift away from the truth.
  const [liveTempC, setLiveTempC] = useState<number | null>(null);
  const [thresholdC, setThresholdC] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentTemperatureC(PHASE2.coordinates.lat, PHASE2.coordinates.lon)
      .then((t) => {
        if (!cancelled) setLiveTempC(t);
      })
      .catch(() => {
        /* leave null — the card renders a "—" placeholder rather than a stale number */
      });

    readWeatherCondition(Number(PHASE2.onChainEscrowId))
      .then((c) => {
        if (!cancelled && c.set) setThresholdC(Number(c.thresholdTemperatureCx100) / 100);
      })
      .catch(() => {
        /* same — no invented fallback */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Proximity is derived, never written down: how far the live reading sits
  // above (+) or below (-) the threshold the contract actually holds.
  const proximityC = liveTempC !== null && thresholdC !== null ? liveTempC - thresholdC : null;
  const fmtTemp = (v: number | null) => (v === null ? '—' : `${v.toFixed(1)}°C`);
  // Position the marker across the bar between 5°C below and 5°C above the
  // threshold, clamped so an extreme reading cannot push it off the track.
  const markerPct =
    proximityC === null ? 50 : Math.min(96, Math.max(4, ((proximityC + 5) / 10) * 100));
  const scrollRoadmap = (direction: 'left' | 'right') => {
    roadmapRef.current?.scrollBy({ left: direction === 'left' ? -360 : 360, behavior: 'smooth' });
  };
  const currentCase = useCases[activeUseCase];

  return (
    <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar activeItem="about" />

      <main className="relative z-10 noise">
        {/* HERO */}
        <section className="relative px-5 pb-20 pt-16 lg:px-10 lg:pb-28 lg:pt-24">
          <div className="mx-auto grid max-w-[1440px] gap-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:gap-20">
            <div>
              <div className="mb-7 flex items-center gap-3">
                <span className="h-px w-10 bg-[#b4f56b]" />
                <span className="label text-[#b4f56b]">SMART ESCROW ON FLARE</span>
              </div>
              <h1 className="display max-w-4xl text-[clamp(3.7rem,8.8vw,8.6rem)] font-medium leading-[.87] text-white">
                Hold funds.<br />
                <span className="text-zinc-500">Verify reality.</span><br />
                <span className="text-[#b4f56b]">Release automatically.</span>
              </h1>
              <p className="mt-9 max-w-xl text-lg leading-relaxed text-zinc-400">
                Lock XRP safely on Flare, check real-world conditions automatically, and pay out winners without
                intermediaries.
              </p>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate('/connect')}
                  className="group inline-flex items-center gap-3 rounded-full bg-[#b4f56b] px-5 py-3 text-sm font-semibold text-[#0b0d10] transition-all hover:gap-5 active:scale-[.97]"
                >
                  Create escrow <ArrowRight size={16} />
                </button>
                <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm text-zinc-300 transition-colors hover:border-white/40 hover:text-white">
                  View dashboard <ArrowUpRight size={15} />
                </Link>
              </div>
            </div>

            <div className="relative lg:pt-10">
              <div className="absolute -inset-10 rounded-full bg-[#b4f56b]/[.05] blur-3xl" />
              <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[#12161a] p-5 shadow-2xl shadow-black/40 lg:p-7">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <div className="label">SETTLED ESCROW</div>
                    <div className="mt-1 text-sm text-zinc-300">Weather agreement / #00000</div>
                  </div>
                  <a
                    href={XRPL_EXPLORER_TX(PHASE2.knownPayoutXrplTxHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-full border border-[#b4f56b]/30 bg-[#b4f56b]/10 px-2.5 py-1 text-[10px] text-[#b4f56b] transition hover:bg-[#b4f56b]/20"
                  >
                    <Check size={11} />PAID OUT<ExternalLink size={9} className="opacity-70" />
                  </a>
                </div>
                <div className="my-8 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                    <div className="label">SENDER</div>
                    <div className="mt-4 text-lg font-medium">10.00 <span className="text-zinc-500">FXRP</span></div>
                    <div className="mt-1 mono text-[9px] text-zinc-600">0x17D…88A2</div>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#b4f56b]/40 bg-[#b4f56b]/10 text-[#b4f56b]">
                    <ArrowRight size={15} />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
                    <div className="label">RECEIVER</div>
                    <div className="mt-4 text-lg font-medium">XRPL</div>
                    <div className="mt-1 mono text-[9px] text-zinc-600">rQhi…4xnP</div>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0d1013] p-4">
                  <div className="flex items-center justify-between">
                    <span className="label">CONDITION PROXIMITY</span>
                    <span className={`mono text-xs ${proximityC !== null && proximityC >= 0 ? 'text-[#b4f56b]' : 'text-zinc-400'}`}>
                      {proximityC === null ? '—' : `${proximityC >= 0 ? '+' : ''}${proximityC.toFixed(1)}°C`}
                    </span>
                  </div>
                  <div className="relative mt-8 h-2 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#72d7ff] via-[#b4f56b] to-[#ffe278] transition-[width] duration-700"
                      style={{ width: `${markerPct}%` }}
                    />
                    <span
                      className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#b4f56b] bg-[#0d1013] shadow-[0_0_20px_rgba(180,245,107,.6)] transition-[left] duration-700"
                      style={{ left: `${markerPct}%` }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between text-[10px] text-zinc-600">
                    <span>{fmtTemp(liveTempC)}</span>
                    <span className="text-zinc-400">{PHASE2.location} / live</span>
                    <span>{fmtTemp(thresholdC)} threshold</span>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between text-[10px] text-zinc-600">
                  {/* Real WardenEscrow — Phase 2 (Weather) address, matching
                      the "Weather agreement" label above — was previously
                      showing the Phase 3 dispute contract's address instead,
                      an internal mismatch flagged and fixed. */}
                  <a
                    href={`${COSTON2_EXPLORER}/address/${PHASE2.escrowAddress}?tab=contract`}
                    target="_blank"
                    rel="noreferrer"
                    className="mono transition hover:text-zinc-400"
                  >
                    0xBDDD…53D
                  </a>
                  {/* Source-verified on the Coston2 explorer, so this badge is
                      something a reader can check rather than take on trust. */}
                  <a
                    href={`${COSTON2_EXPLORER}/address/${PHASE2.escrowAddress}?tab=contract`}
                    target="_blank"
                    rel="noreferrer"
                    className="transition hover:text-zinc-400"
                  >
                    CONTRACT VERIFIED <Check size={12} className="ml-1 inline text-[#b4f56b]" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="border-y border-white/10 bg-[#101417] px-5 py-20 lg:px-10">
          <div className="mx-auto max-w-[1440px]">
            <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
              <div>
                <div className="label text-[#b4f56b]">01 / HOW IT WORKS</div>
                <h2 className="display mt-4 max-w-xl text-5xl leading-[.95] text-white lg:text-7xl">Simple steps to trustless escrow.</h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-zinc-500 lg:justify-self-end">
                Every escrow flows from locked funds to automated release based on verified real-world facts.
              </p>
            </div>
            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-5">
              {flow.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.number}
                    onClick={() => setActiveFlow(i)}
                    className={`group relative min-h-[250px] p-5 text-left transition-all ${activeFlow === i ? 'bg-[#1a211d]' : 'bg-[#121619] hover:bg-[#171c20]'}`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="mono text-xs text-zinc-600">{item.number}</span>
                      <Icon size={18} style={{ color: item.accent }} className="transition-transform group-hover:scale-110" />
                    </div>
                    <div className="mt-14">
                      <div className="display text-lg font-medium" style={{ color: activeFlow === i ? item.accent : '#f4f6f6' }}>{item.title}</div>
                      <p className="mt-3 text-xs leading-relaxed text-zinc-500">{item.copy}</p>
                    </div>
                    {activeFlow === i && <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: item.accent }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* USE CASES */}
        <section className="px-5 py-20 lg:px-10 lg:py-28">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-col justify-between gap-8 border-b border-white/10 pb-8 md:flex-row md:items-end">
              <div>
                <div className="label text-[#b4f56b]">02 / WHAT YOU CAN SECURE</div>
                <h2 className="display mt-4 text-5xl leading-[.95] lg:text-7xl">Real-world conditions.<br /><span className="text-zinc-500">Guaranteed payouts.</span></h2>
              </div>
              <div className="flex max-w-xl flex-wrap gap-2">
                {(Object.keys(useCases) as UseCase[]).map((item) => {
                  const isLive = useCases[item].status === 'live';
                  const isActive = activeUseCase === item;
                  return (
                    <button
                      key={item}
                      onClick={() => setActiveUseCase(item)}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition-all ${
                        !isLive
                          ? isActive
                            ? 'border-white/25 bg-white/[.08] text-zinc-300'
                            : 'border-white/10 text-zinc-600 hover:border-white/25 hover:text-zinc-400'
                          : isActive
                            ? 'border-[#b4f56b] bg-[#b4f56b] text-[#0b0d10]'
                            : 'border-white/15 text-zinc-500 hover:border-white/35 hover:text-zinc-200'
                      }`}
                    >
                      {item}
                      {!isLive && <span className="rounded-full border border-white/15 px-1.5 py-0.5 text-[8px] uppercase tracking-[.08em] text-zinc-500">Soon</span>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-10 grid gap-10 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
              <div>
                {currentCase.status !== 'live' && (
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.03] px-3 py-1 text-[10px] uppercase tracking-[.12em] text-zinc-400">
                    Not built yet — roadmap item, not a live feature
                  </div>
                )}
                <div className={`label ${currentCase.status === 'live' ? 'text-[#b4f56b]' : 'text-zinc-500'}`}>{currentCase.kicker}</div>
                <h3 className={`display mt-5 max-w-xl text-4xl leading-[.98] lg:text-6xl ${currentCase.status === 'live' ? 'text-white' : 'text-zinc-400'}`}>{currentCase.title}</h3>
                <p className="mt-6 max-w-md leading-relaxed text-zinc-500">{currentCase.copy}</p>
                <div className="mt-10 flex items-end gap-10">
                  <div>
                    <div className={`mono text-3xl ${currentCase.status === 'live' ? 'text-white' : 'text-zinc-500'}`}>{currentCase.metric}</div>
                    <div className="label mt-2">{currentCase.metricLabel}</div>
                  </div>
                  <div className="h-10 w-px bg-white/15" />
                  <div>
                    <div className={`text-xs ${currentCase.status === 'live' ? 'text-zinc-300' : 'text-zinc-500'}`}>{currentCase.chip}</div>
                    <div className="label mt-2">{currentCase.status === 'live' ? 'Verified source' : 'Status'}</div>
                  </div>
                </div>
              </div>
              <div>
                {currentCase.visual === 'weather' ? <WeatherVisual /> : currentCase.visual === 'trade' ? <TradeVisual /> : <IpVisual />}
              </div>
            </div>
          </div>
        </section>

        {/* TRANSPARENCY */}
        <section className="border-y border-white/10 bg-[#101417] px-5 py-20 lg:px-10">
          <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[1fr_.9fr]">
            <div>
              <div className="label text-[#b4f56b]">03 / BUILT FOR TRANSPARENCY</div>
              <h2 className="display mt-4 max-w-2xl text-5xl leading-[.94] text-white lg:text-7xl">Inspect every contract and payout.</h2>
              <p className="mt-7 max-w-lg text-sm leading-relaxed text-zinc-500">
                Warden hides nothing. Every smart contract, data verification, and payout transaction can be
                inspected directly on the Coston2 explorer.
              </p>
              <Link to="/proof" className="mt-8 inline-flex items-center gap-2 text-sm text-[#b4f56b] hover:gap-4 transition-all">
                Open transparency portal <ArrowRight size={15} />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#161b1d] p-5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#b4f56b]/10 text-[#b4f56b]">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div className="text-sm text-white">Smart contract layer</div>
                      <div className="label mt-1">COSTON2 / CHAIN 114</div>
                    </div>
                  </div>
                  <ExternalLink size={15} className="text-zinc-600" />
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="mono text-[10px] text-zinc-500">0x12FeF54Aa967Cc921D8A42528B7ff23218911e14</span>
                  <span className="text-[10px] text-[#b4f56b]">VERIFIED</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#161b1d] p-5">
                <div className="label">DISPUTE ENCLAVE</div>
                <div className="mt-4 text-3xl text-white">ACTIVE</div>
                <div className="mt-2 text-xs text-zinc-500">Secure hardware verification</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#161b1d] p-5">
                <div className="label">DATA FEED</div>
                <div className="mt-4 mono text-3xl text-white">Live</div>
                <div className="mt-2 text-xs text-zinc-500">Open-Meteo attested</div>
              </div>
            </div>
          </div>
        </section>

        {/* ROADMAP */}
        <section className="px-5 py-20 lg:px-10">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex items-center justify-between">
              <div>
                <div className="label text-[#b4f56b]">04 / ROADMAP</div>
                <h2 className="display mt-4 text-4xl text-white lg:text-6xl">What we are building next.</h2>
              </div>
              <div className="hidden items-center gap-2 text-xs text-zinc-600 md:flex">
                <ArrowDownRight size={16} /> scroll to explore
              </div>
            </div>
            <div className="relative mt-10">
              <div className="mb-3 hidden items-center justify-end gap-2 md:flex">
                <span className="mr-2 text-[10px] text-zinc-600">Navigate roadmap</span>
                <button type="button" onClick={() => scrollRoadmap('left')} className="roadmap-nav-button" aria-label="Scroll roadmap left">
                  <ArrowRight size={14} className="rotate-180" />
                </button>
                <button type="button" onClick={() => scrollRoadmap('right')} className="roadmap-nav-button" aria-label="Scroll roadmap right">
                  <ArrowRight size={14} />
                </button>
              </div>
              <div ref={roadmapRef} className="roadmap-scroller flex snap-x gap-3 overflow-x-auto pb-3 pr-12 scroll-smooth">
                <div className="min-w-[280px] snap-start rounded-2xl border border-[#b4f56b]/40 bg-[#b4f56b]/5 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#b4f56b]/70 hover:bg-[#1a211d] md:min-w-[350px]">
                  <div className="flex items-center justify-between">
                    <span className="label text-[#b4f56b]">NOW / LIVE</span>
                    <span className="h-2 w-2 rounded-full bg-[#b4f56b] shadow-[0_0_12px_#b4f56b]" />
                  </div>
                  <div className="mt-16 text-2xl text-white">Coston2 testnet launch</div>
                  <p className="mt-3 text-sm text-zinc-500">Live XRP bridging, data feeds, and automated escrow release.</p>
                </div>
                {[
                  ['NEXT / 02', 'Partial split verdicts', 'Graduated payouts that handle partial dispute resolutions.'],
                  ['NEXT / 03', 'More resolver types', 'Support for logistics, freight, and digital commerce milestones.'],
                  ['NEXT / 04', 'Institutional workflows', 'Enhanced trade finance approvals and notarized documents.'],
                  ['NEXT / 05', 'Multi-chain expansion', 'Expanding secure escrow release paths to other networks.'],
                ].map(([k, t, c]) => (
                  <div key={k} className="min-w-[280px] snap-start rounded-2xl border border-white/10 bg-[#121619] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-white/30 hover:bg-[#1a211d] md:min-w-[350px]">
                    <div className="label">{k}</div>
                    <div className="mt-16 text-2xl text-white">{t}</div>
                    <p className="mt-3 text-sm text-zinc-500">{c}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="border-t border-white/10 px-5 py-16 lg:px-10">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-8 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="label text-[#b4f56b]">READY TO START</div>
              <h2 className="display mt-4 max-w-3xl text-5xl leading-[.95] text-white lg:text-7xl">Create your first<br /><span className="text-zinc-500">trustless escrow.</span></h2>
            </div>
            <Link to="/connect" className="group inline-flex shrink-0 items-center gap-4 rounded-full bg-[#b4f56b] px-5 py-3 text-sm font-semibold text-[#0b0d10] transition-all hover:gap-6 active:scale-[.97]">
              Fund an escrow <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        {/* VERIFIED RAILS */}
        <section className="border-t border-white/10 bg-[#0e1114] px-5 py-16 lg:px-10">
          <div className="mx-auto max-w-[1440px]">
            <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end">
              <div>
                <div className="label text-[#b4f56b]">05 / VERIFIED RAILS</div>
                <h2 className="display mt-3 text-4xl text-white lg:text-5xl">Powered by proven infrastructure.</h2>
              </div>
              <p className="max-w-md text-sm leading-relaxed text-zinc-500">
                Warden is built on secure, battle-tested protocols. Click any rail below to explore official
                documentation and code.
              </p>
            </div>
            <div className="mt-7 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-5">
              {[
                ['FLARE', 'NETWORK', 'https://flare.network/'],
                ['FDC', 'DATA FEEDS', 'https://dev.flare.network/'],
                ['FASSETS', 'BRIDGE', 'https://dev.flare.network/fassets/'],
                ['XRPL', 'SETTLEMENT', 'https://xrpl.org/'],
                ['COSTON2', 'EXPLORER', 'https://coston2-explorer.flare.network/'],
              ].map(([name, role, href]) => (
                <a key={name} href={href} target="_blank" rel="noreferrer" className="group bg-[#121619] p-5 transition-colors hover:bg-[#1a211d]">
                  <div className="flex items-center justify-between">
                    <span className="display text-lg text-zinc-300 transition-colors group-hover:text-[#b4f56b]">{name}</span>
                    <ArrowUpRight size={14} className="text-zinc-700 transition-colors group-hover:text-[#b4f56b]" />
                  </div>
                  <div className="label mt-7">{role}</div>
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#b4f56b]" />OFFICIAL DOCS
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
