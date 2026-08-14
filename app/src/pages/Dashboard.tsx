import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Calendar, Plus } from 'lucide-react';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useEscrowList } from '../hooks/useEscrowData';
import { useWallet } from '../hooks/useWallet';
import type { Escrow, EscrowStatus } from '../types';
import { truncateMiddle } from '../utils/format';

type Filter = 'all' | 'mine' | EscrowStatus;

const STATUS_META: Record<EscrowStatus, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: 'LOCKED', bg: 'bg-white/[.06]', text: 'text-zinc-300', dot: 'bg-zinc-400' },
  released: { label: 'RELEASED', bg: 'bg-[#b4f56b]/10', text: 'text-[#b4f56b]', dot: 'bg-[#b4f56b]' },
  disputed: { label: 'DISPUTED', bg: 'bg-[#d5a5ff]/10', text: 'text-[#d5a5ff]', dot: 'bg-[#d5a5ff]' },
};

function progressFor(escrow: Escrow): number {
  if (escrow.condition.type === 'weather' && escrow.condition.currentC != null) {
    return Math.min(100, Math.round((escrow.condition.currentC / (escrow.condition.thresholdC || 1)) * 100));
  }
  if (escrow.status === 'released') return 100;
  if (escrow.status === 'disputed') return 60;
  return 35;
}

function VaultCard({ escrow }: { escrow: Escrow }) {
  const meta = STATUS_META[escrow.status];
  const progress = progressFor(escrow);
  const detailHref = escrow.status === 'disputed' ? `/escrow/${escrow.id}/dispute/submit` : `/escrow/${escrow.id}`;

  return (
    <Link
      to={detailHref}
      className="group block w-full rounded-2xl border border-white/10 bg-[#111518] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-white/25 hover:bg-[#151a1e]"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="mono text-sm text-zinc-500">#{escrow.onChainEscrowId.padStart(5, '0')}</span>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-semibold tracking-[.08em] ${meta.bg} ${meta.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${escrow.status === 'pending' ? 'animate-pulse' : ''}`} />
            {meta.label}
          </span>
        </div>
      </div>
      <div className="mt-8 flex items-end justify-between">
        <div>
          <div className="mono text-3xl tracking-[-.06em] text-white">
            {escrow.amount}<span className="ml-2 text-sm text-zinc-600">{escrow.amountAsset}</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
            <Calendar size={12} />
            {escrow.fundedAgo ?? '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="label">CONTRACT</div>
          <div className="mt-2 mono text-xs text-zinc-400">{truncateMiddle(escrow.contracts.escrowAddress, 6, 4)}</div>
        </div>
      </div>
      <div className="mt-7 rounded-xl border border-white/8 bg-[#0d1013] p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="label">CONDITION</div>
            <div className="mt-2 truncate pr-4 text-sm text-zinc-300">{escrow.conditionSummary}</div>
          </div>
        </div>
        <div className="mt-5">
          <div className="relative h-1.5 rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${escrow.status === 'disputed' ? 'bg-[#d5a5ff]' : escrow.status === 'released' ? 'bg-[#b4f56b]' : 'bg-gradient-to-r from-[#72d7ff] to-[#b4f56b]'}`}
              style={{ width: `${progress}%` }}
            />
            <span className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-white/40 bg-[#0d1013]" style={{ left: `calc(${progress}% - 6px)` }} />
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4">
        <span className="mono text-xs text-zinc-500">{truncateMiddle(escrow.beneficiaryXrplAddress, 5, 4)}</span>
        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600 group-hover:text-[#b4f56b]">
          {escrow.status === 'disputed' ? 'View dispute' : 'View vault'} <ArrowRight size={11} />
        </span>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { escrows: allEscrows, loading } = useEscrowList();
  const { address } = useWallet();
  const [filter, setFilter] = useState<Filter>('all');

  // Every escrow is public on-chain, so the default view shows all of them —
  // hiding them behind a wallet connection would misrepresent an open ledger
  // and leave a first-time visitor staring at nothing. "Mine" is a filter over
  // the same list, scoped to the buyer the escrow contract itself recorded, so
  // ownership is read from `buyer` rather than scanned out of EscrowFunded logs
  // (Coston2's public RPC caps eth_getLogs at a 30-block range).
  const escrows = allEscrows;

  const mine = useMemo(
    () => (address ? escrows.filter((e) => e.buyer.toLowerCase() === address.toLowerCase()) : []),
    [escrows, address]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return escrows;
    if (filter === 'mine') return mine;
    return escrows.filter((e) => e.status === filter);
  }, [filter, escrows, mine]);

  const totalLocked = escrows.reduce((sum, e) => sum + (e.status !== 'released' ? e.amount : 0), 0);
  const totalPaid = escrows.reduce((sum, e) => sum + (e.payout?.amount ?? 0), 0);
  const activeCount = escrows.filter((e) => e.status !== 'released').length;

  return (
    <div className="min-h-screen relative bg-[#0b0d10] text-zinc-100">
      <BackgroundGrid />
      <NavBar activeItem="dashboard" />

      <main className="relative z-10 px-5 py-10 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end">
            <div>
              <div className="label text-[#b4f56b]">{address ? 'ACTIVE VAULTS' : 'PUBLIC LEDGER'}</div>
              <h1 className="display mt-4 text-5xl leading-[.92] text-white lg:text-7xl">
                {address ? (
                  <>Monitor your escrows<br /><span className="text-zinc-500">in real-time.</span></>
                ) : (
                  <>Every escrow on Warden,<br /><span className="text-zinc-500">read live from Coston2.</span></>
                )}
              </h1>
              {!address && (
                <p className="mt-4 max-w-md text-sm text-zinc-500">
                  Escrow records are public on-chain, so anyone can audit them — no wallet needed.
                  Connect one to filter to your own.
                </p>
              )}
            </div>
            <Link to="/create" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#b4f56b] px-5 py-3 text-sm font-semibold text-[#0b0d10] transition-all hover:gap-4 active:scale-[.97]">
              <Plus size={16} /> New escrow
            </Link>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-4">
              <div className="label">TOTAL LOCKED</div>
              <div className="mt-4 mono text-2xl text-white">{totalLocked.toFixed(2)} <span className="text-sm text-zinc-600">FXRP</span></div>
              <div className="mt-2 text-xs text-zinc-500">across {activeCount} active vault{activeCount === 1 ? '' : 's'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-4">
              <div className="label">TOTAL VAULTS</div>
              <div className="mt-4 mono text-2xl text-white">{String(escrows.length).padStart(2, '0')}</div>
              <div className="mt-2 text-xs text-zinc-500">live on Coston2</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-4">
              <div className="label">DISPUTED</div>
              <div className="mt-4 mono text-2xl text-white">{String(escrows.filter((e) => e.status === 'disputed').length).padStart(2, '0')}</div>
              <div className="mt-2 text-xs text-[#d5a5ff]">TEE arbitration</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#111518] p-4">
              <div className="label">TOTAL PAID OUT</div>
              <div className="mt-4 mono text-2xl text-white">{totalPaid.toFixed(2)} <span className="text-sm text-zinc-600">XRP</span></div>
              <div className="mt-2 text-xs text-zinc-500">live XRPL settlement</div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-1 overflow-x-auto">
              {((address ? ['all', 'mine', 'pending', 'released', 'disputed'] : ['all', 'pending', 'released', 'disputed']) as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`whitespace-nowrap rounded-full px-3 py-2 text-[10px] font-semibold tracking-[.08em] transition-colors ${
                    filter === f ? 'bg-white text-[#0b0d10]' : 'text-zinc-600 hover:text-white'
                  }`}
                >
                  {f === 'all' ? 'ALL' : f === 'mine' ? `MINE (${mine.length})` : STATUS_META[f].label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <span>{filtered.length} of {escrows.length} vaults shown</span>
            </div>
          </div>

          {loading && (
            <div className="mt-10 py-16 text-center font-mono text-xs uppercase tracking-widest text-zinc-500">Loading escrows from Coston2…</div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filtered.map((escrow) => <VaultCard key={escrow.id} escrow={escrow} />)}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="mt-10 rounded-2xl border border-dashed border-white/15 bg-white/[.02] py-24 text-center">
              <h2 className="display text-2xl text-white">
                {filter === 'mine' ? 'None funded by this wallet' : 'No escrows yet'}
              </h2>
              <p className="mt-3 text-sm text-zinc-500">
                {filter === 'mine'
                  ? 'This address has not funded any escrows yet. Switch to ALL to browse every escrow on Warden.'
                  : filter === 'all'
                    ? 'Create your first escrow to get started with Warden.'
                    : `No escrows currently in "${filter}" status.`}
              </p>
              <Link to="/create" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#b4f56b] px-5 py-3 text-sm font-semibold text-[#0b0d10]">
                Create escrow <ArrowRight size={15} />
              </Link>
            </div>
          )}

          <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[.02] p-6 text-center md:flex-row md:text-left">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#72d7ff]/10 text-[#72d7ff]"><Activity size={18} /></div>
              <div>
                <div className="text-sm text-zinc-200">Want to inspect smart contract code?</div>
                <div className="mt-1 text-xs text-zinc-600">Every contract address and data verification round is public.</div>
              </div>
            </div>
            <Link to="/proof" className="inline-flex items-center gap-2 text-sm text-[#72d7ff] hover:gap-4 transition-all">
              Open contract transparency portal <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
