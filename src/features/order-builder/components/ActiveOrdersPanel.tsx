import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Order } from '../../orders/hooks/useOrders';

// The "Active Orders" tab of the build screen - a flat, searchable list of
// every eligible order with a checkbox, as an alternative to clicking pins on
// the map above (useful for schools that haven't geocoded yet, or picking a
// specific order number directly). Shares the exact same toggleOrder callback
// the map uses, so checking a row here and clicking its pin are equivalent.
export function ActiveOrdersPanel({ orders, selectedOrderIds, onToggleOrder }: {
  orders: Order[];
  selectedOrderIds: Set<string>;
  onToggleOrder: (orderId: string) => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = !q ? orders : orders.filter(o =>
      o.schoolName.toLowerCase().includes(q) ||
      o.orderNumber.toLowerCase().includes(q) ||
      o.area.toLowerCase().includes(q)
    );
    // Numeric-aware so "OR-012168" sorts after "OR-012166", not "OR-012168"
    // before "OR-01217" the way a plain string compare would.
    return [...list].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true }));
  }, [orders, search]);

  const totalUnits = (o: Order) => o.lineItems.reduce((s, l) => s + l.qty, 0);

  if (orders.length === 0) {
    return (
      <div className="mt-4 p-8 text-center text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-2xl">
        No active orders available to bundle.
      </div>
    );
  }

  return (
    <div className="mt-4 bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-zinc-100 bg-zinc-50/30">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            title="Search active orders"
            placeholder="Search school, order no., area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all"
          />
        </div>
      </div>
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-zinc-50/95 backdrop-blur-sm z-10">
            <tr className="border-b border-zinc-200">
              <th className="px-4 py-2.5 w-8"></th>
              <th className="px-4 py-2.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">School</th>
              <th className="px-4 py-2.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Order No.</th>
              <th className="px-4 py-2.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Area</th>
              <th className="px-4 py-2.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right">SKUs</th>
              <th className="px-4 py-2.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider text-right">Units</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.map(o => (
              <tr
                key={o.id}
                onClick={() => onToggleOrder(o.id)}
                className={cn('cursor-pointer transition-colors hover:bg-zinc-50/40', selectedOrderIds.has(o.id) && 'bg-brand-accent/5')}
              >
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    title={`Add order for ${o.schoolName} to this build`}
                    checked={selectedOrderIds.has(o.id)}
                    onChange={() => onToggleOrder(o.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30 cursor-pointer"
                  />
                </td>
                <td className="px-4 py-2.5 text-xs font-semibold text-zinc-800">{o.schoolName}</td>
                <td className="px-4 py-2.5 text-xs font-mono text-zinc-600">{o.orderNumber || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-600">{o.area || '—'}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-600 text-right font-mono">{o.lineItems.length}</td>
                <td className="px-4 py-2.5 text-xs font-bold text-zinc-800 text-right font-mono">{totalUnits(o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 bg-zinc-50/50 border-t border-zinc-200 text-[11px] font-semibold text-zinc-500 text-right">
        {filtered.length} of {orders.length} order{orders.length === 1 ? '' : 's'}
      </div>
    </div>
  );
}
