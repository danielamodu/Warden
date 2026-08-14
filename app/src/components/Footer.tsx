import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { isMarketingRoute } from '../utils/routes';

interface FooterProps {
  copyrightYear?: string;
}

/**
 * Warden's shared footer, restyled after the Manus redesign's SiteShell
 * footer (link columns + infra credits) but pointed at this app's real
 * ten routes instead of Manus's invented ones.
 *
 * Route-aware the same way NavBar is: marketing pages (Landing, Docs,
 * Terms, Privacy) show the full footer (nav/infra/verification link
 * columns), every in-app route (Dashboard, CreateEscrow, EscrowDetail,
 * ConnectWallet, the dispute-flow pages, ProofTransparency, ...) renders
 * nothing. Every page still mounts <Footer /> unconditionally in its own
 * JSX — this component decides per-route whether that's actually visible,
 * so no page file needed to change for this.
 */
export default function Footer({ copyrightYear = String(new Date().getFullYear()) }: FooterProps) {
  const location = useLocation();
  if (!isMarketingRoute(location.pathname)) return null;

  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#080a0d] px-5 py-12 lg:px-10 lg:py-16">
      <div className="mx-auto grid max-w-[1440px] gap-10 md:grid-cols-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b4f56b] text-[#0b0d10]">
              <ShieldCheck size={16} strokeWidth={2.5} />
            </span>
            <span className="display text-lg font-semibold tracking-[-.07em]">
              warden<span className="text-[#b4f56b]">.</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-xs leading-relaxed text-zinc-500">
            Autonomous smart escrow built on Flare. XRP held securely, real-world data independently attested, and
            automated payouts executed with zero counterparty risk.
          </p>
          <div className="mt-6 flex items-center gap-4 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b4f56b]" /> Coston2 network
            </span>
            <span>/</span>
            <span className="mono">Chain ID 114</span>
          </div>
        </div>

        <div>
          <div className="label mb-4">NAVIGATION</div>
          <ul className="space-y-3 text-xs">
            <li><Link to="/" className="text-zinc-400 hover:text-white">Overview</Link></li>
            <li><Link to="/dashboard" className="text-zinc-400 hover:text-white">Dashboard</Link></li>
            <li><Link to="/create" className="text-zinc-400 hover:text-white">Fund Escrow</Link></li>
            <li><Link to="/docs" className="text-zinc-400 hover:text-white">Documentation</Link></li>
          </ul>
        </div>

        <div>
          <div className="label mb-4">INFRASTRUCTURE</div>
          <ul className="space-y-3 text-xs">
            <li><a href="https://flare.network/" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white">Flare Network</a></li>
            <li><a href="https://dev.flare.network/" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white">Flare Data Connector</a></li>
            <li><a href="https://dev.flare.network/fassets/" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white">FAssets Bridge</a></li>
            <li><a href="https://xrpl.org/" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white">XRPL Settlement</a></li>
          </ul>
        </div>

        <div>
          <div className="label mb-4">VERIFICATION</div>
          <ul className="space-y-3 text-xs">
            <li><a href="https://coston2-explorer.flare.network" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white">Coston2 Explorer</a></li>
            <li><Link to="/proof" className="text-zinc-400 hover:text-white">Proof &amp; Transparency</Link></li>
            <li><Link to="/connect" className="text-zinc-400 hover:text-white">Connect Wallet</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-12 flex max-w-[1440px] flex-col items-center justify-between gap-4 border-t border-white/8 pt-8 text-[11px] text-zinc-600 md:flex-row">
        <div>© {copyrightYear} Warden Protocol.</div>
        <div className="flex gap-6">
          <Link to="/docs" className="hover:text-zinc-400">Docs</Link>
          <Link to="/proof" className="hover:text-zinc-400">Proof</Link>
        </div>
      </div>
    </footer>
  );
}
