import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useEscrowContext } from '../hooks/useEscrowContext';
import { useWallet } from '../hooks/useWallet';
import { fundPhase3Escrow } from '../chain/writes';
import { truncateMiddle } from '../utils/format';
import styles from './CreateEscrow.module.css';

export default function CreateEscrow() {
  const { draft, updateDraft } = useEscrowContext();
  const { status: walletStatus, getSigner } = useWallet();
  const navigate = useNavigate();
  const [funding, setFunding] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);
  const [fundStage, setFundStage] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);

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
    <div className="min-h-screen relative">
      <BackgroundGrid />
      <NavBar activeItem="features" />

      <main className="pt-40 pb-32">
        <div className="max-w-7xl mx-auto px-6 lg:flex gap-16">
          <div className="lg:w-3/5">
            <div className="mb-12">
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 block mb-2">Step 1 of 6</span>
              <h1 className="font-serif text-6xl uppercase font-light tracking-tighter">Create Escrow</h1>
            </div>

            <div className="space-y-16">
              <div className="flex flex-col gap-4">
                <label className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">Escrow Amount</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={draft.amount}
                    onChange={(e) => updateDraft({ amount: e.target.value })}
                    placeholder="10"
                    className={`${styles.inputBottom} font-serif text-3xl pr-12`}
                  />
                  <span className="absolute right-0 font-mono text-sm opacity-40">XRP</span>
                </div>
                <p className="font-sans text-xs opacity-40 mt-1">Amount will be locked in FAssets bridge</p>
              </div>

              <div className="flex flex-col gap-4">
                <label className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">Condition Type</label>
                <div className="relative">
                  <select
                    value={draft.conditionType}
                    onChange={(e) => updateDraft({ conditionType: e.target.value as typeof draft.conditionType })}
                    className={`${styles.selectCustom} w-full border border-[#e5e4de] bg-transparent p-4 font-mono text-xs uppercase tracking-wider focus:border-[#3d7068] outline-none rounded-[2px] transition-colors`}
                  >
                    <option value="weather">Weather Threshold</option>
                    <option value="delivery" disabled>Delivery Confirmation (Coming soon)</option>
                    <option value="market" disabled>Market Trigger (Coming soon)</option>
                    <option value="oracle" disabled>Custom Oracle (Coming soon)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <label className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">Beneficiary XRPL Address</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={draft.beneficiaryXrplAddress}
                    onChange={(e) => updateDraft({ beneficiaryXrplAddress: e.target.value })}
                    placeholder="rN7n7otQDd6FczFgLdlqtyMVrfNrVXXXXX"
                    className={`${styles.inputBottom} font-mono text-sm tracking-tight pr-8`}
                  />
                  <iconify-icon icon="lucide:check-circle" class={`absolute right-0 text-lg ${styles.validCheck}`}></iconify-icon>
                </div>
                <p className="font-sans text-xs opacity-40 mt-1">Recipient address on XRPL mainnet</p>
              </div>

              <div className="space-y-8">
                <span className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-40 block pb-4 border-b border-[#e5e4de]">Weather Parameters</span>
                <div className="grid md:grid-cols-2 gap-12">
                  <div className="flex flex-col gap-4">
                    <label className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">Location</label>
                    <input
                      type="text"
                      value={draft.location}
                      onChange={(e) => updateDraft({ location: e.target.value })}
                      className={`${styles.inputBottom} font-sans text-base`}
                    />
                    <p className="font-sans text-xs opacity-40 mt-1">City name for Open-Meteo API</p>
                  </div>
                  <div className="flex flex-col gap-4">
                    <label className="font-mono text-[10px] tracking-[0.2em] uppercase opacity-60">Temperature Threshold</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        value={draft.thresholdC}
                        onChange={(e) => updateDraft({ thresholdC: e.target.value })}
                        step="0.1"
                        className={`${styles.inputBottom} pr-8`}
                      />
                      <span className="absolute right-0 font-sans text-sm opacity-40">°C</span>
                    </div>
                    <p className="font-sans text-xs opacity-40 mt-1">Release escrow if temp exceeds threshold</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                className="cta-button w-full md:w-auto px-16 py-6 text-white font-mono text-[10px] tracking-[0.25em] uppercase rounded-[2px] editorial-transition mt-8"
              >
                Review Escrow
              </button>
            </div>
          </div>

          <aside className="lg:w-2/5 mt-20 lg:mt-0">
            <div ref={summaryRef} className="sticky top-32 p-10 border border-[#e5e4de] bg-[#f7f6f2] card-editorial">
              <span className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 block mb-8">Summary</span>
              <div className="space-y-6">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase opacity-40">Amount</span>
                  <span className="font-serif text-3xl text-[#3d7068]">{draft.amount} XRP</span>
                </div>
                <div className="h-px bg-[#e5e4de] w-full"></div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] uppercase opacity-40">Condition</span>
                  <span className="font-sans text-sm">Weather Threshold</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] uppercase opacity-40">Location</span>
                  <span className="font-sans text-sm">{draft.location}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] uppercase opacity-40">Temperature</span>
                  <span className="font-sans text-sm">{draft.thresholdC}°C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] uppercase opacity-40">Beneficiary</span>
                  <span className="font-mono text-[11px] opacity-80 cursor-help" title={draft.beneficiaryXrplAddress}>
                    {truncateMiddle(draft.beneficiaryXrplAddress, 5, 4)}
                  </span>
                </div>
                <div className="h-px bg-[#e5e4de] w-full"></div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[10px] uppercase opacity-40">Estimated Fee</span>
                  <span className="font-sans text-sm text-[#3d7068]">0.025 XRP</span>
                </div>
              </div>
              <div className="pt-12 mt-12 space-y-6 border-t border-[#e5e4de]">
                <p className="font-sans text-[11px] opacity-40 leading-relaxed">This escrow will be locked immediately upon confirmation. Conditions are immutable.</p>
                <button
                  onClick={handleConfirmAndFund}
                  disabled={funding}
                  className="cta-button block w-full text-center py-4 text-white font-mono text-[10px] tracking-[0.25em] uppercase rounded-[2px]"
                  style={{ opacity: funding ? 0.6 : 1, cursor: funding ? 'not-allowed' : 'pointer' }}
                >
                  {funding ? 'Confirming…' : 'Confirm & Fund'}
                </button>
                {fundStage && !fundError && (
                  <p className="font-mono text-[10px] text-[#3d7068] uppercase tracking-wide">{fundStage}</p>
                )}
                {fundError && (
                  <p className="font-mono text-[10px] text-red-700 uppercase tracking-wide break-words">{fundError}</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <Footer copyrightYear="2024" />
    </div>
  );
}
