import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Home, Menu, ShieldCheck, X } from 'lucide-react';
import { useWallet } from '../hooks/useWallet';
import { truncateMiddle } from '../utils/format';
import { isMarketingRoute } from '../utils/routes';

export type NavActiveItem = 'about' | 'features' | 'dashboard' | 'docs' | 'connect' | 'payout' | undefined;

interface NavBarProps {
  activeItem?: NavActiveItem;
}

// Marketing pages (Landing + Docs/Terms/Privacy, reachable from Landing and
// from each other) get their own nav — docs and legal links. Every in-app
// route (Dashboard, CreateEscrow, ConnectWallet, EscrowDetail, the
// dispute-flow pages, ProofTransparency) gets the app-flow nav. Mirrors
// Manus's SiteShell, which switches its own nav set the same way
// (`isAppRoute ? appNavItems : landingNavItems`), just keyed off this app's
// actual routes instead of Manus's three.
const landingNavItems = [
  { href: '/docs', label: 'Docs' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms of Service' },
];

const appNavItems = [
  { href: '/create', label: 'Fund escrow' },
  { href: '/dashboard', label: 'Vaults' },
  { href: '/proof', label: 'Proof' },
];

/**
 * Warden's shared header, restyled after the Manus redesign's SiteShell
 * (dark shell, lime brand mark, pill nav, translucent blur) but wired to the
 * app's real WalletContext instead of Manus's throwaway window.ethereum
 * connect call — clicking Connect always routes to the real Connect Wallet
 * page (EIP-6963 multi-provider chooser), never requests accounts directly.
 */
export default function NavBar({ activeItem: _activeItem }: NavBarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, address } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMarketing = isMarketingRoute(location.pathname);
  const navItems = isMarketing ? landingNavItems : appNavItems;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0d10]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 lg:px-10">
        <Link to="/" className="group flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#b4f56b] text-[#0b0d10] transition-transform group-hover:rotate-6">
            <ShieldCheck size={18} strokeWidth={2.5} />
          </span>
          <span className="display text-xl font-semibold tracking-[-.07em]">
            warden<span className="text-[#b4f56b]">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[.03] p-1.5 md:flex">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`relative rounded-full px-4 py-1.5 text-xs transition-colors ${
                  active ? 'nav-pill-active bg-white font-bold shadow-md' : 'text-zinc-300 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {/* On Landing, Docs already lives in the pill nav above — this
              shortcut only adds value on app-flow pages, where Docs isn't
              otherwise reachable from the header. */}
          {!isMarketing && (
            <Link to="/docs" className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white">
              <Home size={14} /> Docs
            </Link>
          )}
          {status === 'connected' && address ? (
            <button
              onClick={() => navigate('/dashboard')}
              className="group inline-flex items-center gap-2 rounded-full border border-[#4a9d6f]/50 bg-[#4a9d6f]/10 px-4 py-2 text-xs text-[#8be3ac] transition-all hover:bg-[#4a9d6f]/20"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#4a9d6f]" />
              {truncateMiddle(address, 6, 4)}
            </button>
          ) : (
            <button
              onClick={() => navigate('/connect')}
              className="group inline-flex items-center gap-2 rounded-full bg-[#b4f56b] px-4 py-2 text-xs font-semibold text-[#0b0d10] transition-all hover:opacity-90"
            >
              Connect wallet <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          )}
        </div>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-xl border border-white/10 p-2.5 text-zinc-400 md:hidden"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-b border-white/10 bg-[#0d1013] px-5 py-6 md:hidden">
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-xl px-4 py-3 text-sm transition-colors ${
                  location.pathname === item.href ? 'nav-pill-active bg-white font-bold' : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {!isMarketing && (
              <Link to="/docs" onClick={() => setMenuOpen(false)} className="rounded-xl px-4 py-3 text-sm text-zinc-300 hover:bg-white/5">
                Docs
              </Link>
            )}
          </div>
          <div className="mt-6 border-t border-white/10 pt-5">
            {status === 'connected' && address ? (
              <button
                onClick={() => {
                  navigate('/dashboard');
                  setMenuOpen(false);
                }}
                className="w-full rounded-xl border border-[#4a9d6f]/50 bg-[#4a9d6f]/10 py-3 text-center text-xs font-semibold text-[#8be3ac]"
              >
                {truncateMiddle(address, 6, 4)}
              </button>
            ) : (
              <button
                onClick={() => {
                  navigate('/connect');
                  setMenuOpen(false);
                }}
                className="w-full rounded-xl bg-[#b4f56b] py-3 text-center text-xs font-semibold text-[#0b0d10]"
              >
                Connect wallet
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
