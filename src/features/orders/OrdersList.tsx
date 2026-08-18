import { useState, useMemo, useEffect } from 'react';
import { ClipboardList, Plus, Search, Edit2, Trash2, Loader2, AlertCircle, Check, X, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOrders } from './hooks/useOrders';
import type { Order, OrderStatus } from './hooks/useOrders';
import { OrderFormModal } from './components/OrderFormModal';
import { OrdersImportDialog } from './components/OrdersImportDialog';
import { OrdersListMobile } from './OrdersListMobile';
import { useIsMobile } from '../../hooks/useIsMobile';

export function OrdersList() {
  const { orders, loading, error, addOrder, updateOrder, deleteOrder, deleteOrders } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('Active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(o => {
      if (o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.schoolName.toLowerCase().includes(q) ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.area.toLowerCase().includes(q) ||
        o.schoolType.toLowerCase().includes(q) ||
        o.clientNumber.toLowerCase().includes(q) ||
        o.lineItems.some(l => l.stockCode.toLowerCase().includes(q))
      );
    });
  }, [orders, searchQuery, statusFilter]);

  // Drop any selected ids that scrolled out of the current filtered/live set.
  useEffect(() => {
    const validIds = new Set(filteredOrders.map(o => o.id));
    setSelectedIds(prev => {
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredOrders]);

  const allSelected = filteredOrders.length > 0 && selectedIds.size === filteredOrders.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(filteredOrders.map(o => o.id)));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleOpenModal = (order?: Order) => {
    setEditingOrder(order || null);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (editingOrder) {
      return await updateOrder(editingOrder.id, data);
    }
    return await addOrder(data);
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const ok = await deleteOrder(id);
      if (ok) setDeleteConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const ok = await deleteOrders([...selectedIds]);
      if (ok) {
        setSelectedIds(new Set());
        setBulkDeleteConfirm(false);
      }
    } finally {
      setBulkDeleting(false);
    }
  };

  const totalUnits = (order: Order) => order.lineItems.reduce((s, l) => s + l.qty, 0);

  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <>
        <OrdersListMobile
          orders={filteredOrders}
          loading={loading}
          error={error}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onOpenModal={handleOpenModal}
          onOpenImport={() => setIsImportOpen(true)}
          onDelete={deleteOrder}
          selectedIds={selectedIds}
          onToggleOne={toggleSelectOne}
          onToggleAll={toggleSelectAll}
          allSelected={allSelected}
          onDeleteSelected={handleBulkDelete}
        />
        <OrderFormModal isOpen={isModalOpen} order={editingOrder} onSave={handleSave} onClose={() => setIsModalOpen(false)} />
        <OrdersImportDialog isOpen={isImportOpen} addOrder={addOrder} onClose={() => setIsImportOpen(false)} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-brand-accent shrink-0" />
            Orders
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            School furniture orders — import a delivery schedule or add orders manually.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsImportOpen(true)}
            title="Import Orders"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-semibold text-sm transition-all shadow-2xs cursor-pointer"
          >
            <Upload className="w-4 h-4 text-zinc-500" />
            Import
          </button>
          <button
            onClick={() => handleOpenModal()}
            title="Add Order"
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Order
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-zinc-200 bg-zinc-50/30 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 w-full md:max-w-2xl">
            <div className="relative w-full sm:max-w-md">
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
              className="w-full sm:w-auto px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs cursor-pointer shrink-0"
            >
              <option value="Active">Active (Default)</option>
              <option value="Complete">Completed</option>
            </select>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {selectedIds.size > 0 && (
              bulkDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-600">Delete {selectedIds.size} order{selectedIds.size === 1 ? '' : 's'}?</span>
                  <button
                    type="button"
                    title="Confirm bulk delete"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-white bg-red-500 hover:bg-red-600 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Confirm
                  </button>
                  <button
                    type="button"
                    title="Cancel bulk delete"
                    onClick={() => setBulkDeleteConfirm(false)}
                    disabled={bulkDeleting}
                    className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-all cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  title="Delete selected orders"
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete {selectedIds.size} Selected
                </button>
              )
            )}
            <div className="text-xs font-medium text-zinc-500 shrink-0">
              {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
            <p className="text-zinc-500 font-medium text-sm">Loading orders…</p>
          </div>
        ) : error ? (
          <div className="p-16 text-center max-w-lg mx-auto">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h3 className="text-lg font-bold text-zinc-900 mt-4">Database Connection Problem</h3>
            <p className="text-sm text-zinc-500 mt-2">{error}</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-16 text-center max-w-md mx-auto">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-4 border border-zinc-200">
              <ClipboardList className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900">No orders found</h3>
            <p className="text-sm text-zinc-500 mt-1.5">
              {searchQuery
                ? 'No results match your search.'
                : statusFilter === 'Complete'
                  ? 'No completed orders yet.'
                  : 'Import a delivery schedule or add your first order to get started.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 border-b border-zinc-200">
                  <th className="px-5 py-3.5 w-10">
                    <input
                      type="checkbox"
                      title="Select all orders"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30 cursor-pointer"
                    />
                  </th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">School</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Order No.</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Area</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">School Type</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">SKUs</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Units</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[110px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className={cn('hover:bg-zinc-50/40 transition-colors', selectedIds.has(o.id) && 'bg-brand-accent/5')}>
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        title={`Select order for ${o.schoolName}`}
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleSelectOne(o.id)}
                        className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30 cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-zinc-850">{o.schoolName}</p>
                      {o.clientNumber && <p className="text-[10px] text-zinc-400 mt-0.5">Client #{o.clientNumber}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm font-mono text-zinc-600">{o.orderNumber || '—'}</td>
                    <td className="px-5 py-4 text-sm text-zinc-600">{o.area || '—'}</td>
                    <td className="px-5 py-4 text-sm text-zinc-600">{o.schoolType || '—'}</td>
                    <td className="px-5 py-4">
                      <span className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide',
                        o.status === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-zinc-600 text-right font-mono">{o.lineItems.length}</td>
                    <td className="px-5 py-4 text-sm font-bold text-zinc-800 text-right font-mono">{totalUnits(o)}</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          onClick={() => handleOpenModal(o)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit Order"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === o.id ? (
                          <>
                            <button
                              type="button"
                              title="Confirm delete"
                              onClick={() => handleDelete(o.id)}
                              disabled={busyId === o.id}
                              className="p-1.5 text-white bg-red-500 rounded-lg border border-red-600 transition-all disabled:opacity-50"
                            >
                              {busyId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              title="Cancel delete"
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(o.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OrderFormModal isOpen={isModalOpen} order={editingOrder} onSave={handleSave} onClose={() => setIsModalOpen(false)} />
      <OrdersImportDialog isOpen={isImportOpen} addOrder={addOrder} onClose={() => setIsImportOpen(false)} />
    </div>
  );
}
