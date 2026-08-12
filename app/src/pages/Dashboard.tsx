import { useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Footer from '../components/Footer';
import BackgroundGrid from '../components/BackgroundGrid';
import { useEscrowList } from '../hooks/useEscrowData';
import type { Escrow, EscrowStatus } from '../types';
import { truncateMiddle } from '../utils/format';
import styles from './Dashboard.module.css';

type Filter = 'all' | EscrowStatus;

const STATUS_META: Record<EscrowStatus, { label: string; icon: string; className: string }> = {
  pending: { label: 'Pending', icon: 'lucide:clock', className: styles.statusPending },
  released: { label: 'Released', icon: 'lucide:check-circle', className: styles.statusReleased },
  disputed: { label: 'Disputed', icon: 'lucide:alert-triangle', className: styles.statusDisputed },
};

function DashboardRow({ escrow }: { escrow: Escrow }) {
  const meta = STATUS_META[escrow.status];
  const detailHref = escrow.status === 'disputed' ? `/escrow/${escrow.id}/dispute/submit` : `/escrow/${escrow.id}`;

  return (
    <div className={`${styles.dashboardRow} grid grid-cols-1 md:grid-cols-12 items-center p-5 group`}>
      <div className="md:col-span-2">
        <span className={`${styles.statusBadge} ${meta.className}`}>
          <iconify-icon icon={meta.icon}></iconify-icon>
          {meta.label}
        </span>
      </div>
      <div className="md:col-span-2">
        <div className="font-serif text-2xl tracking-tighter uppercase">{escrow.amount} {escrow.amountAsset}</div>
        <div className="font-mono text-[9px] tracking-widest opacity-40 uppercase">
          Escrow #{escrow.onChainEscrowId.padStart(6, '0')} · {truncateMiddle(escrow.contracts.escrowAddress, 6, 4)}
        </div>
      </div>
      <div className="md:col-span-4">
        <p className="font-sans text-sm opacity-70 truncate pr-4">{escrow.conditionSummary}</p>
      </div>
      <div className="md:col-span-2">
        <div className="flex items-center gap-2 font-mono text-[9px] tracking-widest opacity-40 uppercase">
          <iconify-icon icon="lucide:calendar" class="text-xs"></iconify-icon>
          {escrow.fundedAgo ?? '—'}
        </div>
      </div>
      <div className="md:col-span-2 flex justify-end">
        <Link
          to={detailHref}
          className={styles.actionBtn}
          style={escrow.status === 'disputed' ? { backgroundColor: 'var(--dispute-color)' } : undefined}
        >
          {escrow.status === 'disputed' ? 'View Dispute' : 'View Details'}
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { escrows, loading } = useEscrowList();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = filter === 'all' ? escrows : escrows.filter((e) => e.status === filter);

  return (
    <div className="min-h-screen relative">
      <BackgroundGrid />
      <NavBar activeItem="dashboard" />

      <main className="pt-48 pb-32 max-w-7xl mx-auto px-6">
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-[#e5e4de] pb-10">
            <div>
              <h1 className="font-serif text-5xl uppercase font-light tracking-tighter mb-4">WARDEN Dashboard</h1>
              <p className="font-sans text-lg opacity-60 font-light">View and manage your active escrow contracts protected by WARDEN.</p>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/create" className={`${styles.actionBtn} inline-flex items-center gap-2`}>
                <iconify-icon icon="lucide:plus"></iconify-icon>
                New Escrow
              </Link>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-8">
            <div className="flex gap-3">
              {(['all', 'pending', 'released', 'disputed'] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-6 py-2 rounded-full font-mono text-[10px] tracking-[0.2em] uppercase transition-all editorial-transition ${
                    filter === f ? 'bg-[#3d7068] text-white' : 'border border-[#e5e4de] opacity-60 hover:opacity-100'
                  }`}
                >
                  {f === 'all' ? 'All' : STATUS_META[f].label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {loading && <div className="font-mono text-xs opacity-40 uppercase tracking-widest py-12">Loading escrows…</div>}
          {!loading && filtered.map((escrow) => <DashboardRow key={escrow.id} escrow={escrow} />)}
        </section>

        {!loading && filtered.length === 0 && (
          <section className="py-32 text-center border border-dashed border-[#e5e4de]">
            <iconify-icon icon="lucide:fingerprint" class="text-9xl opacity-10 mb-8 mx-auto"></iconify-icon>
            <h2 className="font-serif text-3xl uppercase mb-4">No escrows yet</h2>
            <p className="font-sans opacity-60 mb-12">
              {filter === 'all' ? 'Create your first escrow to get started with WARDEN.' : `No escrows currently in "${filter}" status.`}
            </p>
            <Link to="/create" className={styles.actionBtn}>Create Escrow</Link>
          </section>
        )}

        <section className="mt-16 flex flex-col md:flex-row items-center justify-between gap-6 border-t border-[#e5e4de] pt-8">
          <div className="font-mono text-[10px] tracking-widest uppercase opacity-40">
            Showing {filtered.length} of {escrows.length} escrows
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
