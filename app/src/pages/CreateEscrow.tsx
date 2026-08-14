import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, FileJson, Lock, ShieldCheck, Wallet } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useEscrowContext } from '../hooks/useEscrowContext';
import { useWallet } from '../hooks/useWallet';
import { fundPhase3Escrow } from '../chain/writes';
import { truncateMiddle } from '../utils/format';

const steps = [
  { label: 'Lock asset', sub: 'XRP to FXRP', icon: Wallet },
  { label: 'Set condition', sub: 'Data verification', icon: Check },
  { label: 'Recipient', sub: 'XRPL payout address', icon: ShieldCheck },
  { label: 'Review & fund', sub: 'Lock contract', icon: Lock },
];

const CONTRACT_ADDRESS = '0x12FeF54Aa967Cc921D8A42528B7ff23218911e14';

export default function CreateEscrow() {
  const { draft, updateDraft } = useEscrowContext();
  const { status: walletStatus, getSigner } = useWallet();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundStage, setFundStage] = useState<string | null>(null);

  const payload = useMemo(
    () => ({
      url: 'https://api.open-meteo.com/v1/forecast',
      query: { location: draft.location, current: 'temperature_2m', timezone: 'UTC' },
      postProcessJq: '{temperatureC: .current.temperature_2m}',
      abiSignature: 'temperatureC(uint256)',
      source: 'open-meteo',
      attestation: 'FDC_WEB2JSON',
      threshold: `${draft.thresholdC} °C`,
    }),
    [draft.location, draft.thresholdC]
  );

  const setNext = () => setStep((v) => Math.min(4, v + 1));
  const setPrevious = () => setStep((v) => Math.max(1, v - 1));

  const handleConfirmAndFund = async () => {
    if (walletStatus !== 'connected') {
      setFundError('Connect your wallet first (Connect Wallet page) — Fund Escrow needs a real signer.');
      return;
    }
    setFunding(true);
    setFundError(null);
    try {
      const signer = await getSigner();
      setFundStage('Approving FXRP (if needed)…');
      const result = await fundPhase3Escrow(signer, draft.beneficiaryXrplAddress, draft.amount);
      setFundStage(`Funded — escrow #${result.escrowId} on Coston2 (tx ${result.fundTxHash.slice(0, 10)}…)`);
      navigate(`/escrow/${result.escrowId}`);
    } catch (err) {
      setFundError((err as Error).message || 'Fund transaction failed.');
    } finally {
      setFunding(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar activeItem="features" />

      <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-12 flex flex-col justify-between gap-5 border-b border-white/10 pb-8 md:flex-row md:items-end">
            <div>
              <div className="label text-[#b4f56b]">NEW ESCROW VAULT</div>
              <h1 className="display mt-4 text-5xl leading-[.92] text-white lg:text-7xl">
                Fund a secure vault.<br /><span className="text-zinc-500">Automate the payout.</span>
              </h1>
            </div>
            <div className="text-left md:text-right">
              <div className="label">NETWORK</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-zinc-300 md:justify-end">
                <span className="h-2 w-2 rounded-full bg-[#b4f56b] shadow-[0_0_12px_#b4f56b]" />
                Flare Coston2 <span className="mono text-zinc-600">/ 114</span>
              </div>
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-[240px_1fr_330px] lg:items-start">
            <aside className="lg:sticky lg:top-24">
              <div className="label mb-5">SETUP STEPS</div>
              <div className="space-y-1">
                {steps.map((item, i) => {
                  const Icon = item.icon;
                  const active = step === i + 1;
                  const complete = step > i + 1;
                  return (
                    <button
                      key={item.label}
                      onClick={() => setStep(i + 1)}
                      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${active ? 'bg-white/[.08]' : 'hover:bg-white/[.04]'}`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                          complete ? 'border-[#b4f56b]/40 bg-[#b4f56b]/10 text-[#b4f56b]' : active ? 'border-white/25 bg-white/10 text-white' : 'border-white/10 text-zinc-600'
                        }`}
                      >
                        {complete ? <Check size={15} /> : <Icon size={15} />}
                      </span>
                      <span>
                        <span className={`block text-sm ${active ? 'text-white' : 'text-zinc-400'}`}>{item.label}</span>
                        <span className="label mt-1 block">{item.sub}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-8 rounded-2xl border border-white/10 bg-[#121619] p-4">
                <div className="flex items-center gap-2 text-xs text-[#b4f56b]"><ShieldCheck size={14} /> Safe &amp; verified</div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">Your terms are signed only after your explicit review. Warden never requests your seed phrase.</p>
              </div>
            </aside>

            <section className="min-h-[620px] rounded-[24px] border border-white/10 bg-[#111518] p-5 sm:p-8">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <div className="label">STEP 0{step} / 04</div>
                  <h2 className="display mt-3 text-3xl text-white">{steps[step - 1].label}</h2>
                </div>
              </div>

              {step === 1 && (
                <div className="space-y-8">
                  <div>
                    <label className="label mb-3 block">AMOUNT TO LOCK</label>
                    <div className="flex items-center rounded-2xl border border-white/15 bg-[#0d1013] px-4 py-3">
                      <input
                        value={draft.amount}
                        onChange={(e) => updateDraft({ amount: e.target.value })}
                        className="w-full bg-transparent font-mono text-3xl text-white outline-none"
                      />
                      <span className="mono text-sm text-zinc-500">XRP</span>
                    </div>
                    <p className="mt-3 text-xs text-zinc-600">Amount will be locked in the FAssets bridge as FXRP.</p>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-[#b4f56b]/50 bg-[#b4f56b]/[.06] p-5">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#b4f56b] font-bold text-[#0b0d10]">X</div>
                      <div>
                        <div className="text-lg text-white">XRP → FXRP</div>
                        <div className="label mt-1">XRPL TESTNET → FLARE COSTON2</div>
                      </div>
                    </div>
                    <span className="rounded-full border border-[#b4f56b]/25 bg-[#b4f56b]/10 px-2 py-1 text-[10px] text-[#b4f56b]">1:1 REDEEMABLE</span>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-7">
                  <div>
                    <label className="label mb-3 block">CONDITION TYPE</label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button className="rounded-xl border border-[#b4f56b]/50 bg-[#b4f56b]/[.07] p-4 text-left">
                        <div className="flex items-center justify-between text-sm text-white">Weather threshold <Check size={14} className="text-[#b4f56b]" /></div>
                        <div className="mt-2 text-xs text-zinc-500">Verified temperature check</div>
                      </button>
                      <button disabled className="rounded-xl border border-white/10 p-4 text-left opacity-50">
                        <div className="text-sm text-zinc-300">Delivery milestone</div>
                        <div className="mt-2 text-xs text-zinc-600">Coming soon</div>
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label mb-3 block">CITY</label>
                      <input
                        value={draft.location}
                        onChange={(e) => updateDraft({ location: e.target.value })}
                        className="w-full rounded-xl border border-white/15 bg-[#0d1013] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#b4f56b]/60"
                      />
                    </div>
                    <div>
                      <label className="label mb-3 block">RELEASE ABOVE</label>
                      <div className="flex items-center rounded-xl border border-white/15 bg-[#0d1013] px-4">
                        <input
                          value={draft.thresholdC}
                          onChange={(e) => updateDraft({ thresholdC: e.target.value })}
                          className="w-full bg-transparent py-3 text-sm text-white outline-none"
                        />
                        <span className="mono text-xs text-zinc-500">°C</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0d1013] p-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-300"><FileJson size={15} className="text-[#72d7ff]" /> Verified data query payload</div>
                    <pre className="mt-4 max-h-64 overflow-auto rounded-xl border border-white/8 bg-[#090b0d] p-4 text-[11px] leading-relaxed text-[#8af5d1]">{JSON.stringify(payload, null, 2)}</pre>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-8">
                  <div className="rounded-2xl border border-[#72d7ff]/30 bg-[#72d7ff]/[.05] p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#72d7ff]/15 text-[#72d7ff]"><ShieldCheck size={19} /></div>
                      <div>
                        <div className="text-sm text-white">Direct XRPL payout</div>
                        <div className="mt-1 text-xs text-zinc-500">The recipient receives native XRP directly when conditions are met.</div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="label mb-3 block">RECIPIENT XRPL ADDRESS</label>
                    <input
                      value={draft.beneficiaryXrplAddress}
                      onChange={(e) => updateDraft({ beneficiaryXrplAddress: e.target.value })}
                      className="w-full rounded-xl border border-white/15 bg-[#0d1013] px-4 py-4 font-mono text-xs text-white outline-none transition-colors focus:border-[#b4f56b]/60"
                    />
                    <div className="mt-3 flex items-center justify-between text-xs text-zinc-600">
                      <span>Destination is permanently locked in the contract.</span>
                      <span className="text-[#b4f56b]">XRPL TESTNET</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-[#b4f56b]/30 bg-[#b4f56b]/[.05] p-5">
                    <div className="flex items-center gap-2 text-xs text-[#b4f56b]"><Lock size={14} /> LOCKED &amp; IMMUTABLE ONCE CONFIRMED</div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                      This vault will hold {draft.amount} FXRP and release automatically when {draft.location} exceeds{' '}
                      {draft.thresholdC}°C, or once a TEE-verified dispute verdict resolves it.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-[#0d1013] p-5 font-mono text-xs">
                    <div className="mb-5 label">FUNDING SUMMARY</div>
                    <div className="space-y-4">
                      <div className="flex justify-between gap-5"><span className="text-zinc-600">amount</span><span className="text-zinc-300">{draft.amount} XRP</span></div>
                      <div className="flex justify-between gap-5"><span className="text-zinc-600">condition</span><span className="text-right text-zinc-300">{draft.location} &gt; {draft.thresholdC}°C</span></div>
                      <div className="flex justify-between gap-5"><span className="text-zinc-600">recipient</span><span className="max-w-[220px] truncate text-zinc-300" title={draft.beneficiaryXrplAddress}>{truncateMiddle(draft.beneficiaryXrplAddress, 8, 6)}</span></div>
                      <div className="flex justify-between gap-5 border-t border-white/10 pt-4"><span className="text-zinc-600">contract</span><span className="max-w-[220px] truncate text-[#8af5d1]">{CONTRACT_ADDRESS}</span></div>
                      <div className="flex justify-between gap-5"><span className="text-zinc-600">est. network fee</span><span className="text-zinc-300">0.025 XRP</span></div>
                    </div>
                  </div>

                  {walletStatus !== 'connected' && (
                    <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs text-amber-300">
                      Connect your wallet on the Connect Wallet page before funding — this step signs a real transaction.
                    </div>
                  )}

                  <button
                    onClick={handleConfirmAndFund}
                    disabled={funding}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-[#b4f56b] px-5 py-4 text-sm font-semibold text-[#0b0d10] transition-all hover:gap-5 active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {funding ? 'Confirming…' : 'Confirm & fund'} {!funding && <Check size={15} />}
                  </button>
                  {fundStage && !fundError && <p className="text-center font-mono text-[10px] uppercase tracking-wide text-[#b4f56b]">{fundStage}</p>}
                  {fundError && <p className="break-words text-center font-mono text-[10px] uppercase tracking-wide text-red-400">{fundError}</p>}
                </div>
              )}

              <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-6">
                {step > 1 ? (
                  <button onClick={setPrevious} className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white"><ArrowLeft size={15} /> Back</button>
                ) : (
                  <span />
                )}
                {step < 4 && (
                  <button onClick={setNext} className="inline-flex items-center gap-3 rounded-full bg-[#b4f56b] px-5 py-3 text-sm font-semibold text-[#0b0d10] transition-all hover:gap-5 active:scale-[.97]">
                    Continue <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </section>

            <aside className="lg:sticky lg:top-24">
              <div className="label mb-5">VAULT PREVIEW</div>
              <div className="rounded-[24px] border border-white/10 bg-[#111518] p-5">
                <div className="flex items-center justify-between">
                  <span className="label">DRAFT ESCROW</span>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#b4f56b]" />
                </div>
                <div className="mt-8">
                  <div className="mono text-4xl text-white">{draft.amount || '0'}<span className="ml-2 text-lg text-zinc-600">XRP</span></div>
                  <div className="mt-2 text-xs text-zinc-500">≈ {draft.amount || '0'} FXRP locked on fund</div>
                </div>
                <div className="my-7 h-px bg-white/10" />
                <div className="space-y-5 text-xs">
                  <div className="flex justify-between gap-4"><span className="text-zinc-600">condition</span><span className="text-right text-zinc-300">{draft.location} &gt; {draft.thresholdC}°C</span></div>
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-600">status</span>
                    <span className="inline-flex items-center gap-1.5 text-[#b4f56b]"><span className="h-1.5 w-1.5 rounded-full bg-[#b4f56b]" />DRAFT</span>
                  </div>
                  <div className="flex justify-between gap-4"><span className="text-zinc-600">recipient</span><span className="mono max-w-[150px] truncate text-zinc-300" title={draft.beneficiaryXrplAddress}>{draft.beneficiaryXrplAddress}</span></div>
                  <div className="flex justify-between gap-4"><span className="text-zinc-600">network fee</span><span className="mono text-zinc-300">0.025 XRP</span></div>
                </div>
                <div className="mt-8 rounded-xl border border-white/10 bg-white/[.03] p-3 text-[10px] leading-relaxed text-zinc-600">
                  Terms become permanent once confirmed on the Coston2 network.
                </div>
                <a
                  href={`https://coston2-explorer.flare.network/address/${CONTRACT_ADDRESS}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-xs text-zinc-400 transition-colors hover:border-white/30 hover:text-white"
                >
                  <span>View contract on explorer</span>
                  <ArrowRight size={14} />
                </a>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer copyrightYear="2024" />
    </div>
  );
}
