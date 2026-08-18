import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { PhaseModal } from './PhaseModal';
import type { StockRow } from '../utils/phaseCalculations';
import { normalize } from '../utils/phaseCalculations';
import type { StockAllocation } from '../hooks/useAllocations';
import type { Order } from '../../orders/hooks/useOrders';
import { cn } from '../../../lib/utils';

interface OrderMatch {
  order: Order;
  ordered: number;
  remaining: number;
}

export function AllocateStockModal({
  row,
  orders,
  allocations,
  onClose,
  onAllocate
}: {
  row: StockRow | null;
  orders: Order[];
  allocations: StockAllocation[];
  onClose: () => void;
  onAllocate: (params: { invoiceId: string; orderNumber: string; schoolName: string; stockCode: string; qty: number }) => Promise<{ success: boolean; error?: string }>;
}) {
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [qty, setQty] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSearch('');
    setSelectedOrder(null);
    setQty(0);
  }, [row]);

  // The picker is driven entirely by the Orders collection (the delivery-schedule
  // import), not invoices — a school/order only belongs here while it's an Active
  // order (not yet marked Complete) that still ordered this exact SKU. "Currently
  // requires" nets out whatever has already been allocated to that order for this
  // SKU (via the stock_allocations ledger, keyed by order id) so a fully-allocated
  // order drops out on its own without needing its own reservation bookkeeping.
  const matchingOrders = useMemo(() => {
    if (!row) return [];
    const codeKey = normalize(row.stockCode);
    const q = search.trim().toLowerCase();

    return orders
      .filter(order => order.status === 'Active')
      .map((order): OrderMatch | null => {
        const item = order.lineItems.find(l => normalize(l.stockCode) === codeKey);
        if (!item) return null;
        const alreadyAllocated = allocations.reduce((sum, a) => {
          if (a.releasedAt || a.invoiceId !== order.id || normalize(a.stockCode) !== codeKey) return sum;
          return sum + a.qty;
        }, 0);
        return { order, ordered: item.qty, remaining: Math.max(0, item.qty - alreadyAllocated) };
      })
      .filter((x): x is OrderMatch => !!x && x.remaining > 0)
      .filter(({ order }) => {
        if (!q) return true;
        return order.schoolName.toLowerCase().includes(q) || order.orderNumber.toLowerCase().includes(q);
      });
  }, [row, orders, allocations, search]);

  const selectedMatch = useMemo(() => {
    if (!selectedOrder) return null;
    return matchingOrders.find(m => m.order.id === selectedOrder.id) || null;
  }, [selectedOrder, matchingOrders]);

  const maxAllocatable = selectedMatch ? Math.min(row?.available ?? 0, selectedMatch.remaining) : 0;

  const handleAllocate = async () => {
    if (!row || !selectedOrder || !selectedMatch || qty <= 0) return;
    if (qty > (row.available ?? 0)) {
      toast.error(`Only ${row.available} units are available.`);
      return;
    }
    if (qty > selectedMatch.remaining) {
      toast.error(`${selectedOrder.schoolName} only needs ${selectedMatch.remaining} more of this item.`);
      return;
    }

    setSubmitting(true);
    const result = await onAllocate({
      invoiceId: selectedOrder.id,
      orderNumber: selectedOrder.orderNumber,
      schoolName: selectedOrder.schoolName,
      stockCode: row.stockCode,
      qty
    });
    setSubmitting(false);

    if (result.success) {
      toast.success(`Allocated ${qty} units of ${row.stockCode} to ${selectedOrder.schoolName}.`);
      onClose();
    } else {
      toast.error(result.error || 'Unable to allocate stock. Please try again.');
    }
  };

  return (
    <PhaseModal
      isOpen={!!row}
      onClose={onClose}
      title="Allocate Stock"
      subtitle={row ? `${row.stockCode} · ${row.available} units available` : ''}
      footer={
        <>
          <button
            type="button"
            title="Cancel allocation"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Confirm stock allocation"
            onClick={handleAllocate}
            disabled={!selectedOrder || qty <= 0 || submitting}
            className="px-4 py-2 bg-brand-primary hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            {submitting ? 'Allocating…' : `Allocate ${qty || 0} Units`}
          </button>
        </>
      }
    >
      {row && (
        <>
          <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-3.5 space-y-1">
            <p className="text-xs font-black text-brand-primary uppercase">{row.description}</p>
            <p className="text-[10px] font-mono text-zinc-500">SKU: {row.stockCode} &middot; Available: <strong className="text-emerald-600">{row.available} units</strong></p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wide">Select School / Order</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                title="Search schools or order numbers…"
                placeholder="Search schools or order numbers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-zinc-50/50 border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5">
              {matchingOrders.length === 0 ? (
                <p className="text-[11px] text-zinc-400 py-4 text-center">No active orders currently need this item.</p>
              ) : matchingOrders.map(({ order, remaining }) => (
                <button
                  key={order.id}
                  type="button"
                  title={`Select ${order.schoolName}`}
                  onClick={() => { setSelectedOrder(order); setQty(Math.min(remaining, row.available)); }}
                  className={cn(
                    'w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer',
                    selectedOrder?.id === order.id
                      ? 'bg-brand-accent/10 border-brand-accent/30'
                      : 'bg-white border-zinc-150 hover:border-zinc-250'
                  )}
                >
                  <p className="text-xs font-bold text-brand-primary truncate">{order.schoolName}</p>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-0.5">
                    <span>{order.orderNumber || '—'}</span>
                    <span>&middot;</span>
                    <span>{order.area || 'Unassigned'}</span>
                  </div>
                  <p className="text-[10px] font-mono text-amber-600 mt-0.5">Currently requires: {remaining} units</p>
                </button>
              ))}
            </div>
          </div>

          {selectedOrder && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-zinc-500 tracking-wide">Quantity</label>
              <input
                type="number"
                title="Quantity to allocate"
                min={1}
                max={maxAllocatable}
                value={qty}
                onChange={(e) => setQty(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
              <p className="text-[10px] text-zinc-400 font-mono">Max allocatable: {maxAllocatable} units</p>
            </div>
          )}
        </>
      )}
    </PhaseModal>
  );
}
