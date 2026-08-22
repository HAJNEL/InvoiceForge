import { useState } from 'react';
import { PackagePlus, Search, Loader2, AlertCircle, Trash2, Copy, School, Settings } from 'lucide-react';
import { MobileCard, MobileCardActionsMenu } from '../../components/mobile/MobileCard';
import { formatBuildDate } from './utils';
import { OrderBuilderSettingsDialogMobile } from './components/OrderBuilderSettingsDialogMobile';
import type { OrderBuild } from './types';

export function OrderBuilderListMobile({
  builds, loading, error, searchQuery, setSearchQuery, onOpenBuild, onNewBuild, onCopy, onDelete
}: {
  builds: OrderBuild[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onOpenBuild: (id: string) => void;
  onNewBuild: () => void;
  onCopy: (build: OrderBuild) => void;
  onDelete: (build: OrderBuild) => Promise<void>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleDelete = async (build: OrderBuild) => {
    if (window.confirm(`Delete Build #${build.buildNumber}? Its orders will be available to bundle again.`)) {
      setDeletingId(build.id);
      await onDelete(build);
      setDeletingId(null);
    }
  };

  const totals = (b: OrderBuild) => {
    const schools = b.schoolGroups.length;
    const orders = b.schoolGroups.reduce((s, g) => s + g.orderIds.length, 0);
    const units = b.schoolGroups.reduce((s, g) => s + g.lineItems.reduce((s2, li) => s2 + li.qty, 0), 0);
    return { schools, orders, units };
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-brand-accent shrink-0" />
            Order Builder
          </h1>
          <p className="text-xs text-zinc-500">
            Bundle orders from the same school into a single delivery-ready build.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          title="Order Builder settings"
          className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 shrink-0 mobile-tap-target"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onNewBuild}
        title="Start a new order build"
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs mobile-tap-target"
      >
        <PackagePlus className="w-3.5 h-3.5" />
        Build
      </button>

      <OrderBuilderSettingsDialogMobile isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          title="Search builds"
          placeholder="Search build no., school…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs"
        />
      </div>

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
          <p className="text-zinc-500 font-medium text-xs">Loading builds…</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="text-sm text-zinc-500 mt-2">{error}</p>
        </div>
      ) : builds.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-3 border border-zinc-200">
            <School className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-zinc-900">No builds yet</p>
          <p className="text-xs text-zinc-500 mt-1">
            {searchQuery ? 'No results match your search.' : 'Bundle your first set of school orders to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {builds.map((b) => {
            const { schools, orders, units } = totals(b);
            return (
              <MobileCard key={b.id} onClick={() => onOpenBuild(b.id)}>
                <MobileCard.Primary>
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-zinc-900 truncate">Build #{b.buildNumber}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {formatBuildDate(b.deliveryDate)}{b.truckName ? ` · ${b.truckName}` : ''}
                    </p>
                  </div>
                  <MobileCardActionsMenu
                    actions={[
                      { label: 'Copy details', icon: Copy, onClick: () => onCopy(b) },
                      {
                        label: deletingId === b.id ? 'Deleting…' : 'Delete',
                        icon: Trash2,
                        destructive: true,
                        onClick: () => handleDelete(b)
                      }
                    ]}
                  />
                </MobileCard.Primary>
                <MobileCard.Secondary>
                  <span>{schools} school{schools === 1 ? '' : 's'}</span>
                  <span>{orders} order{orders === 1 ? '' : 's'}</span>
                  <span className="font-bold text-zinc-700">{units} units</span>
                </MobileCard.Secondary>
              </MobileCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
