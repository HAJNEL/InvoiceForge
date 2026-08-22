import { useState, useMemo } from 'react';
import { PackagePlus, Search, Loader2, AlertCircle, Trash2, Check, X, School, Copy, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useOrderBuilds, deleteBuild } from './hooks/useOrderBuilds';
import { formatBuildDate, formatBuildAsText } from './utils';
import { OrderBuilderListMobile } from './OrderBuilderListMobile';
import { OrderBuilderSettingsDialog } from './components/OrderBuilderSettingsDialog';
import type { OrderBuild } from './types';

export function OrderBuilderList() {
  const { builds, loading, error } = useOrderBuilds();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleDelete = async (buildId: string) => {
    const build = builds.find(b => b.id === buildId);
    if (!build) return;
    setDeletingId(buildId);
    try {
      await deleteBuild(build);
      toast.success(`Build #${build.buildNumber} deleted`, { description: 'Its orders are available to bundle again.' });
      setDeleteConfirmId(null);
    } catch (err) {
      toast.error('Failed to delete build', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (build: typeof builds[number]) => {
    try {
      await navigator.clipboard.writeText(formatBuildAsText(build));
      toast.success(`Build #${build.buildNumber} copied to clipboard`);
    } catch (err) {
      toast.error('Failed to copy build details', { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const filteredBuilds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return builds;
    return builds.filter(b =>
      b.buildNumber.toLowerCase().includes(q) ||
      b.schoolGroups.some(g => g.schoolName.toLowerCase().includes(q))
    );
  }, [builds, searchQuery]);

  const totals = (b: typeof builds[number]) => {
    const schools = b.schoolGroups.length;
    const orders = b.schoolGroups.reduce((s, g) => s + g.orderIds.length, 0);
    const units = b.schoolGroups.reduce((s, g) => s + g.lineItems.reduce((s2, li) => s2 + li.qty, 0), 0);
    return { schools, orders, units };
  };

  if (isMobile) {
    return (
      <OrderBuilderListMobile
        builds={filteredBuilds}
        loading={loading}
        error={error}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenBuild={(id) => navigate(`/order-builder/build/${id}`)}
        onNewBuild={() => navigate('/order-builder/build')}
        onCopy={handleCopy}
        onDelete={(build: OrderBuild) => handleDelete(build.id)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-brand-accent shrink-0" />
            Order Builder
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Bundle orders from the same school into a single delivery-ready build.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="Order Builder settings"
            className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 transition-all shadow-2xs cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/order-builder/build')}
            title="Start a new order build"
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            Build
          </button>
        </div>
      </div>

      <OrderBuilderSettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-zinc-200 bg-zinc-50/30 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
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
          <div className="text-xs font-medium text-zinc-500 shrink-0">
            {filteredBuilds.length} build{filteredBuilds.length === 1 ? '' : 's'}
          </div>
        </div>

        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
            <p className="text-zinc-500 font-medium text-sm">Loading builds…</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center max-w-lg mx-auto">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-bold text-zinc-900 mt-4">Database Connection Problem</h3>
            <p className="text-sm text-zinc-500 mt-2">{error}</p>
          </div>
        ) : filteredBuilds.length === 0 ? (
          <div className="p-16 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-4 border border-zinc-200">
              <School className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900">No builds yet</h3>
            <p className="text-sm text-zinc-500 mt-1.5">
              {searchQuery ? 'No results match your search.' : 'Bundle your first set of school orders to get started.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => navigate('/order-builder/build')}
                title="Start a new order build"
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
              >
                <PackagePlus className="w-4 h-4" />
                Build
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 border-b border-zinc-200">
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Build #</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Delivery Date</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Schools</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Orders</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Units</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Created</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredBuilds.map((b) => {
                  const { schools, orders, units } = totals(b);
                  return (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/order-builder/build/${b.id}`)}
                      className="hover:bg-zinc-50/40 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 text-sm font-mono font-semibold text-zinc-850">Build #{b.buildNumber}</td>
                      <td className="px-5 py-4 text-sm text-zinc-600">{formatBuildDate(b.deliveryDate)}</td>
                      <td className="px-5 py-4 text-sm text-zinc-600 text-right font-mono">{schools}</td>
                      <td className="px-5 py-4 text-sm text-zinc-600 text-right font-mono">{orders}</td>
                      <td className="px-5 py-4 text-sm font-bold text-zinc-800 text-right font-mono">{units}</td>
                      <td className="px-5 py-4 text-xs text-zinc-400">
                        {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-ZA') : '—'}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            title="Copy build details"
                            onClick={() => handleCopy(b)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          {deleteConfirmId === b.id ? (
                            <>
                              <button
                                type="button"
                                title="Confirm delete"
                                onClick={() => handleDelete(b.id)}
                                disabled={deletingId === b.id}
                                className="p-1.5 text-white bg-red-500 rounded-lg border border-red-600 transition-all disabled:opacity-50 cursor-pointer"
                              >
                                {deletingId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                title="Cancel delete"
                                onClick={() => setDeleteConfirmId(null)}
                                disabled={deletingId === b.id}
                                className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              title="Delete build"
                              onClick={() => setDeleteConfirmId(b.id)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
