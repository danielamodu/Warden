import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound, Loader2, ShieldCheck, Wallet, Zap } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useWallet, LEGACY_WALLET_ID } from '../hooks/useWallet';

interface WalletOption {
  id: string;
  label: string;
  sub: string;
  iconUrl?: string; // real EIP-6963 wallet icon (data: URI), when known
}

const AUTO_ADVANCE_DELAY_MS = 900;

/**
 * No Manus design exists for this screen — Manus's own redesign never has a
 * dedicated wallet-selection page; SiteShell's header button calls
 * `window.ethereum.request({ method: 'eth_requestAccounts' })` directly with
 * no multi-provider chooser. That shortcut doesn't fit this app's real
 * EIP-6963 multi-wallet discovery, so this page is extrapolated from the
 * established dark/lime visual system (card grid from CreateEscrow's asset
 * picker, status treatment from Dashboard's vault badges) rather than
 * dropped in favor of Manus's inline connect.
 */
export default function ConnectWallet() {
  const { walletId, address, status, error, availableWallets, legacyAvailable, connect, disconnect } = useWallet();
  const navigate = useNavigate();
  const [advancing, setAdvancing] = useState(false);

  useEffect(() => {
    if (status !== 'connected' || !address) return;
    setAdvancing(true);
    const t = setTimeout(() => navigate('/dashboard'), AUTO_ADVANCE_DELAY_MS);
    return () => clearTimeout(t);
  }, [status, address, navigate]);

  const wallets: WalletOption[] =
    availableWallets.length > 0
      ? availableWallets.map((w) => ({ id: w.info.uuid, label: w.info.name, sub: 'Browser extension', iconUrl: w.info.icon }))
      : legacyAvailable
        ? [{ id: LEGACY_WALLET_ID, label: 'Injected Wallet', sub: 'window.ethereum' }]
        : [];

  const handleClick = (id: string) => {
    if (walletId === id && status === 'connected') {
      disconnect();
    } else {
      connect(id);
    }
  };

  return (
    <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar activeItem="connect" />

      <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1440px]">
          <div className="mb-12 border-b border-white/10 pb-8 text-center">
            <div className="label text-[#b4f56b] justify-center flex">CONNECT WALLET</div>
            <h1 className="display mt-4 text-5xl leading-[.95] text-white lg:text-7xl">
              One signature.<br /><span className="text-zinc-500">No bridging.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-zinc-500">
              Every real EVM wallet extension you have installed is discovered live via EIP-6963 — no wallet is
              assumed or hardcoded.
            </p>
          </div>

          {error && (
            <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center font-mono text-xs text-red-300">
              {error}
            </div>
          )}

          {advancing && (
            <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-[#b4f56b]/30 bg-[#b4f56b]/10 p-4 text-center font-mono text-xs uppercase tracking-wide text-[#b4f56b]">
              Wallet connected — entering Warden…
            </div>
          )}

          {wallets.length === 0 ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-white/15 bg-white/[.02] p-12 text-center">
              <Wallet className="mx-auto mb-4 text-zinc-600" size={32} />
              <p className="label mb-2 justify-center flex">NO EVM WALLET DETECTED</p>
              <p className="text-sm text-zinc-400">Install MetaMask (or another injected EVM wallet extension) and reload this page to connect.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {wallets.map((wallet) => {
                const isThisWallet = walletId === wallet.id;
                const isConnected = isThisWallet && status === 'connected';
                const isConnecting = isThisWallet && status === 'connecting';

                return (
                  <div
                    key={wallet.id}
                    className={`flex flex-col items-center rounded-2xl border p-8 text-center transition-all ${
                      isConnected ? 'border-[#b4f56b]/50 bg-[#b4f56b]/[.06]' : 'border-white/10 bg-[#111518] hover:border-white/25'
                    }`}
                  >
                    <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#0d1013]">
                      {wallet.iconUrl ? (
                        <img
                          src={wallet.iconUrl}
                          alt={wallet.label}
                          className={`h-9 w-9 object-contain transition-opacity ${isConnecting ? 'animate-pulse' : ''}`}
                          style={{ opacity: isConnected ? 1 : 0.75 }}
                        />
                      ) : (
                        <Wallet size={26} className={isConnected ? 'text-[#b4f56b]' : 'text-zinc-500'} />
                      )}
                      {isConnected && (
                        <CheckCircle2 size={18} className="absolute -right-1.5 -top-1.5 rounded-full bg-[#0b0d10] text-[#b4f56b]" />
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-white">{wallet.label}</h3>
                    <p className="mt-1 text-xs text-zinc-500">{wallet.sub}</p>

                    <div className="mt-6 flex items-center gap-2">
                      {isConnecting && <Loader2 size={12} className="animate-spin text-amber-400" />}
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isConnecting ? 'bg-amber-400' : isConnected ? 'bg-[#b4f56b]' : 'bg-zinc-600'}`}
                      />
                      <span className="label" style={{ color: isConnecting ? '#fbbf24' : isConnected ? '#b4f56b' : undefined }}>
                        {isConnecting ? 'Connecting…' : isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>

                    {isConnected && address && <div className="mono mt-4 text-xs text-zinc-400">{address}</div>}

                    <button
                      onClick={() => handleClick(wallet.id)}
                      disabled={isConnecting}
                      className={`mt-8 w-full rounded-full py-3 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                        isConnected ? 'bg-[#b4f56b] text-[#0b0d10]' : 'border border-white/15 text-zinc-200 hover:border-[#b4f56b]/50 hover:text-[#b4f56b]'
                      }`}
                    >
                      {isConnecting ? 'Connecting…' : isConnected ? 'Disconnect' : `Connect with ${wallet.label}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <section className="mt-24 grid gap-4 border-t border-white/10 pt-16 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#b4f56b]/10 text-[#b4f56b]"><Zap size={18} /></div>
              <h3 className="mt-6 text-lg font-medium text-white">One signature</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                No multi-step approval workflows. Your wallet verifies the escrow in a single transaction, reducing
                gas friction and time-to-lock significantly.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#72d7ff]/10 text-[#72d7ff]"><ShieldCheck size={18} /></div>
              <h3 className="mt-6 text-lg font-medium text-white">No bridging</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                Native XRPL assets stay on XRPL. FAssets handles cross-chain token wrapping transparently, so your
                original collateral remains in self-custody.
              </p>
            </div>
          </section>

          <section className="mt-10 flex items-start gap-6 rounded-2xl border border-white/10 bg-[#0e1114] p-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 text-[#b4f56b]">
              <KeyRound size={22} />
            </div>
            <div>
              <h2 className="display text-2xl text-white">Your keys, your control</h2>
              <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                <li>Private keys never leave your device</li>
                <li>Escrow conditions verified on-chain, not in our servers</li>
                <li>You can revoke access at any time through your wallet dashboard</li>
              </ul>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
