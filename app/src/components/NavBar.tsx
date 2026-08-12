import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { truncateMiddle } from '../utils/format';

export type NavActiveItem = 'about' | 'features' | 'dashboard' | 'docs' | 'connect' | 'payout' | undefined;

interface NavBarProps {
  activeItem?: NavActiveItem;
}

/**
 * EditorialNavBar (component id d9fba93f-a351-4ebd-9d94-a945792ff3e2).
 *
 * The Superdesign CLI has no raw-HTML read path for shared components (only
 * `list-components` metadata, no template source) — see final report.
 * Reconstructed faithfully from what's consistently visible across every one
 * of the 10 page drafts that reference it via <sd-component>: fixed floating
 * header, WARDEN wordmark, About/Features/Dashboard/Docs links, scroll-based
 * `nav-scrolled` transition (backdrop blur + border), and a Connect button
 * that becomes the wallet address once connected.
 */
export default function NavBar({ activeItem }: NavBarProps) {
  const navRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const { status, address } = useWallet();

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onScroll = () => {
      if (window.scrollY > 80) {
        nav.classList.add('nav-scrolled');
        nav.classList.remove('pt-8');
      } else {
        nav.classList.remove('nav-scrolled');
        nav.classList.add('pt-8');
      }
    };
    window.addEventListener('scroll', onScroll);
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const linkClass = (id: NavActiveItem) =>
    `hover:opacity-100 transition-opacity ${activeItem === id ? 'opacity-100' : 'opacity-50'}`;

  return (
    <header
      id="main-nav"
      ref={navRef}
      className="fixed top-0 left-0 right-0 z-50 pt-8 pb-4 px-6 editorial-transition"
    >
      <nav className="max-w-7xl mx-auto flex items-center justify-between">
        <Link id="nav-logo" to="/" className="font-serif text-xl uppercase tracking-tight">
          WARDEN
        </Link>

        <div className="hidden md:flex items-center gap-10 font-mono text-[10px] tracking-[0.2em] uppercase">
          <Link to="/create" className={linkClass('features')}>Create Escrow</Link>
          <Link to="/dashboard" className={linkClass('dashboard')}>Dashboard</Link>
          <Link to="/proof" className={linkClass('docs')}>Proof</Link>
        </div>

        {status === 'connected' && address ? (
          <button
            id="nav-cta"
            onClick={() => navigate('/dashboard')}
            className="font-mono text-[10px] tracking-[0.2em] uppercase px-6 py-3 border rounded-[2px] transition-colors"
            style={{ borderColor: 'var(--success-color)', color: 'var(--success-color)' }}
          >
            {truncateMiddle(address, 6, 4)}
          </button>
        ) : (
          <button
            id="nav-cta"
            onClick={() => navigate('/connect')}
            className="cta-button font-mono text-[10px] tracking-[0.2em] uppercase px-6 py-3 text-white rounded-[2px]"
          >
            Connect
          </button>
        )}
      </nav>
    </header>
  );
}
