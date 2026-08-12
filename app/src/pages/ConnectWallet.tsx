import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useWallet, LEGACY_WALLET_ID } from '../hooks/useWallet';
import styles from './ConnectWallet.module.css';

interface WalletOption {
  id: string;
  label: string;
  sub: string;
  iconUrl?: string; // real EIP-6963 wallet icon (data: URI), when known
  fallbackIcon: string; // iconify icon name, used when no real icon is available
}

const AUTO_ADVANCE_DELAY_MS = 900;

export default function ConnectWallet() {
  const { walletId, address, status, error, availableWallets, legacyAvailable, connect, disconnect } = useWallet();
  const navigate = useNavigate();
  const [advancing, setAdvancing] = useState(false);

  // Once a real wallet is connected, this page's job is done — move on into
  // the app rather than leaving the user stranded on the connect screen. A
  // short delay lets the "Connected" state actually be seen before leaving.
  useEffect(() => {
    if (status !== 'connected' || !address) return;
    setAdvancing(true);
    const t = setTimeout(() => navigate('/dashboard'), AUTO_ADVANCE_DELAY_MS);
    return () => clearTimeout(t);
  }, [status, address, navigate]);

  // Real, EIP-6963-discovered EVM wallets — whatever the user actually has
  // installed (MetaMask, Zerion, Rabby, Coinbase Wallet, ...), each with its
  // own real name/icon/provider. No wallet is invented or assumed; if
  // nothing is discovered and no legacy window.ethereum exists either, no
  // cards render and an install prompt shows instead.
  const wallets: WalletOption[] =
    availableWallets.length > 0
      ? availableWallets.map((w) => ({
          id: w.info.uuid,
          label: w.info.name,
          sub: 'Browser Extension',
          iconUrl: w.info.icon,
          fallbackIcon: 'lucide:wallet',
        }))
      : legacyAvailable
        ? [{ id: LEGACY_WALLET_ID, label: 'Injected Wallet', sub: 'window.ethereum', fallbackIcon: 'lucide:wallet' }]
        : [];

  const handleClick = (id: string) => {
    if (walletId === id && status === 'connected') {
      disconnect();
    } else {
      connect(id);
    }
  };

  return (
    <div className="min-h-screen relative">
      <BackgroundGrid />
      <NavBar activeItem="connect" />

      <main className="pt-48 pb-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-24">
            <h1 className="font-serif text-6xl md:text-7xl uppercase font-light tracking-tighter mb-6">Connect Your Wallet</h1>
            <p className="text-xl font-light opacity-70">One signature, no bridging. Secure your escrow in seconds.</p>
          </div>

          {error && (
            <div className="mb-8 p-4 border border-red-300 bg-red-50 font-mono text-xs text-red-700">{error}</div>
          )}

          {advancing && (
            <div className="mb-8 p-4 border border-[#4a9d6f]/30 bg-[#4a9d6f]/5 font-mono text-xs text-[#3d7068] uppercase tracking-wide text-center">
              Wallet connected — entering Warden…
            </div>
          )}

          {wallets.length === 0 ? (
            <div className="p-12 border border-dashed border-[#e5e4de] text-center">
              <p className="font-mono text-xs uppercase tracking-widest opacity-60 mb-2">No EVM wallet detected</p>
              <p className="font-sans text-sm opacity-70">Install MetaMask (or another injected EVM wallet extension) and reload this page to connect.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-0 border border-[#e5e4de] divide-x divide-[#e5e4de]">
              {wallets.map((wallet) => {
                const isThisWallet = walletId === wallet.id;
                const isConnected = isThisWallet && status === 'connected';
                const isConnecting = isThisWallet && status === 'connecting';

                return (
                  <div
                    key={wallet.id}
                    id={`wallet-${wallet.id}`}
                    className={`${styles.walletCard} ${isConnected ? styles.walletCardConnected : ''} p-12 flex flex-col items-center text-center`}
                  >
                    <div className="w-20 h-20 border border-[#e5e4de] flex items-center justify-center mb-8 rounded-[2px] relative">
                      {wallet.iconUrl ? (
                        <img
                          src={wallet.iconUrl}
                          alt={wallet.label}
                          className={`w-10 h-10 object-contain transition-all duration-700 ${isConnecting ? styles.iconPulse : ''}`}
                          style={{ opacity: isConnected ? 1 : 0.6 }}
                        />
                      ) : (
                        <iconify-icon
                          icon={wallet.fallbackIcon}
                          class={`text-4xl transition-all duration-700 ${isConnecting ? styles.iconPulse : ''}`}
                          style={{ opacity: isConnected ? 1 : 0.4, color: isConnected ? 'var(--success-color)' : undefined }}
                        ></iconify-icon>
                      )}
                      {isConnected && (
                        <div className="absolute top-1 right-1">
                          <iconify-icon icon="lucide:check-circle" class="text-lg text-[#4a9d6f]"></iconify-icon>
                        </div>
                      )}
                    </div>
                    <h3 className="font-mono text-sm tracking-[0.2em] uppercase mb-2">{wallet.label}</h3>
                    <p className="font-sans text-[13px] opacity-60 mb-8">{wallet.sub}</p>

                    <div className="flex items-center gap-2 mb-10">
                      <span
                        className={`${styles.statusDot} ${isConnecting ? styles.statusDotConnecting : ''}`}
                        style={{ backgroundColor: isConnecting ? undefined : isConnected ? '#4a9d6f' : '#B4B4B4' }}
                      ></span>
                      <span
                        className="font-mono text-[10px] tracking-[0.2em] uppercase"
                        style={{ opacity: isConnected ? 1 : 0.4, color: isConnecting ? '#F59E0B' : isConnected ? '#4a9d6f' : undefined }}
                      >
                        {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>

                    {isConnected && address && (
                      <div className="font-mono text-xs opacity-60 mb-6">{address}</div>
                    )}

                    <button
                      onClick={() => handleClick(wallet.id)}
                      disabled={isConnecting}
                      className="cta-button w-full border border-[#e5e4de] py-4 font-mono text-[10px] tracking-[0.25em] uppercase rounded-[2px]"
                      style={{
                        backgroundColor: isConnected ? '#4a9d6f' : 'transparent',
                        color: isConnected ? '#ffffff' : '#1c1c1c',
                        borderColor: isConnected ? '#4a9d6f' : '#e5e4de',
                        opacity: isConnecting ? 0.5 : 1,
                        cursor: isConnecting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : `Connect with ${wallet.label}`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <section className="mt-32">
            <h2 className="font-serif text-3xl uppercase font-light tracking-tight mb-12">Why XRPL?</h2>
            <div className="grid md:grid-cols-2 border border-[#e5e4de] divide-x divide-[#e5e4de]">
              <div className="p-10 card-editorial transition-colors">
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 mb-4">Protocol 01</div>
                <h3 className="font-mono text-lg uppercase mb-4">One Signature</h3>
                <p className="opacity-70 leading-relaxed">
                  No multi-step approval workflows. Your wallet verifies the escrow in a single transaction, reducing gas friction and time-to-lock by up to 80%.
                </p>
              </div>
              <div className="p-10 card-editorial transition-colors">
                <div className="font-mono text-[10px] tracking-[0.3em] uppercase opacity-40 mb-4">Protocol 02</div>
                <h3 className="font-mono text-lg uppercase mb-4">No Bridging</h3>
                <p className="opacity-70 leading-relaxed">
                  Native XRPL assets stay on XRPL. FAssets handles cross-chain token wrapping transparently, ensuring your original collateral remains in self-custody.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-32 py-16 border-t border-[#e5e4de] flex items-start gap-8">
            <div className="w-12 h-12 flex items-center justify-center border border-[#e5e4de]">
              <iconify-icon icon="lucide:shield-check" class="text-2xl text-[#3d7068] opacity-60"></iconify-icon>
            </div>
            <div>
              <h2 className="font-serif text-2xl uppercase font-light tracking-tight mb-6">Your Keys, Your Control</h2>
              <ul className="space-y-3">
                {[
                  'Private keys never leave your device',
                  'Escrow conditions verified on-chain, not in our servers',
                  'You can revoke access at any time through your wallet dashboard',
                ].map((li) => (
                  <li key={li} className="flex items-center gap-3 opacity-70 font-sans">
                    <span className="h-[1px] w-3 bg-[#1c1c1c] opacity-30"></span>
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
