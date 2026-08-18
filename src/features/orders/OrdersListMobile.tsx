import { useState } from 'react';
import { ClipboardList, Plus, Search, Edit2, Trash2, Loader2, AlertCircle, Upload, Check } from 'lucide-react';
import type { Order, OrderStatus } from './hooks/useOrders';
import { MobileCard, MobileCardActionsMenu } from '../../components/mobile/MobileCard';
import { cn } from '../../lib/utils';

export function OrdersListMobile({
  orders, loading, error, searchQuery, setSearchQuery, statusFilter, setStatusFilter, onOpenModal, onOpenImport, onDelete,
  selectedIds, onToggleOne, onToggleAll, allSelected, onDeleteSelected
}: {
  orders: Order[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: OrderStatus;
  setStatusFilter: (s: OrderStatus) => void;
  onOpenModal: (order?: Order) => void;
  onOpenImport: () => void;
  onDelete: (id: string) => Promise<boolean>;
  selectedIds: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  onDeleteSelected: () => Promise<void>;
}) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      setDeletingId(id);
      await onDelete(id);
      setDeletingId(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(`Delete ${selectedIds.size} order${selectedIds.size === 1 ? '' : 's'}?`)) {
      setBulkDeleting(true);
      await onDeleteSelected();
      setBulkDeleting(false);
    }
  };

  const totalUnits = (order: Order) => order.lineItems.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="space-y-4 pb-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-brand-accent shrink-0" />
          Orders
        </h1>
        <p className="text-xs text-zinc-500">
          School furniture orders — import a delivery schedule or add orders manually.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenImport}
          title="Import Orders"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-xs transition-all shadow-2xs mobile-tap-target"
        >
          <Upload className="w-3.5 h-3.5 text-zinc-500" />
          Import
        </button>
        <button
          onClick={() => onOpenModal()}
          title="Add Order"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs mobile-tap-target"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          title="Search orders"
          placeholder="Search school, order no., area, SKU…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs"
        />
      </div>

      <select
        title="Filter orders by status"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as OrderStatus)}
        className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs mobile-tap-target"
      >
        <option value="Active">Active (Default)</option>
        <option value="Complete">Completed</option>
      </select>

      {!loading && !error && orders.length > 0 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 mobile-tap-target">
            <input
              type="checkbox"
              title="Select all orders"
              checked={allSelected}
              onChange={onToggleAll}
              className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30"
            />
            Select all
          </label>
          {selectedIds.size > 0 && (
            <button
              type="button"
              title="Delete selected orders"
              onClick={handleDeleteSelected}
              disabled={bulkDeleting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 bg-red-50 border border-red-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50 mobile-tap-target"
            >
              {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete {selectedIds.size}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
          <p className="text-zinc-500 font-medium text-xs">Loading orders…</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="text-sm text-zinc-500 mt-2">{error}</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-8 text-center">
          <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-3 border border-zinc-200">
            <ClipboardList className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold text-zinc-900">No orders found</p>
          <p className="text-xs text-zinc-500 mt-1">
            {searchQuery
              ? 'No results match your search.'
              : statusFilter === 'Complete'
                ? 'No completed orders yet.'
                : 'Import a delivery schedule or add your first order to get started.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <MobileCard key={o.id} className={selectedIds.has(o.id) ? 'border-brand-accent/40 bg-brand-accent/5' : undefined}>
              <MobileCard.Primary>
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    title={`Select order for ${o.schoolName}`}
                    checked={selectedIds.has(o.id)}
                    onChange={() => onToggleOne(o.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 truncate">{o.schoolName}</p>
                    <p className="text-[10px] font-mono text-zinc-400 mt-0.5">{o.orderNumber || '—'}</p>
                  </div>
                </div>
                <MobileCardActionsMenu
                  actions={[
                    { label: 'Edit', icon: Edit2, onClick: () => onOpenModal(o) },
                    {
                      label: deletingId === o.id ? 'Deleting…' : 'Delete',
                      icon: Trash2,
                      destructive: true,
                      onClick: () => handleDelete(o.id)
                    }
                  ]}
                />
              </MobileCard.Primary>
              <MobileCard.Secondary>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide flex items-center gap-0.5',
                  o.status === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                )}>
                  {o.status === 'Complete' && <Check className="w-2.5 h-2.5" />}
                  {o.status}
                </span>
                <span>{o.area || 'Unassigned'}</span>
                <span>{o.schoolType || '—'}</span>
                <span>{o.lineItems.length} SKUs</span>
                <span className="font-bold text-zinc-700">{totalUnits(o)} units</span>
              </MobileCard.Secondary>
            </MobileCard>
          ))}
        </div>
      )}
    </div>
  );
}
