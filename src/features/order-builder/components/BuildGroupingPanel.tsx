import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, X, School } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { schoolKeyFor } from '../../../lib/geocoding';
import type { Order } from '../../orders/hooks/useOrders';
import { buildSchoolGroups } from '../utils';

// Renders the sorted/grouped/consolidated preview of the in-progress build, below
// the map. Reads the exact same `orders`/`selectedOrderIds` state the map writes
// to, via buildSchoolGroups() - the same pure function the "Build persistence"
// issue uses to compute what actually gets saved, so this preview never drifts
// from what Save would write.
export function BuildGroupingPanel({
  orders,
  selectedOrderIds,
  onRemoveOrder
}: {
  orders: Order[];
  selectedOrderIds: Set<string>;
  onRemoveOrder: (orderId: string) => void;
}) {
  const groups = useMemo(() => buildSchoolGroups(orders, selectedOrderIds), [orders, selectedOrderIds]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapsed = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const totalOrders = groups.reduce((s, g) => s + g.orderIds.length, 0);
  const totalUnits = groups.reduce((s, g) => s + g.lineItems.reduce((s2, li) => s2 + li.qty, 0), 0);

  // Map each orderId back to its order number for the per-order remove row (the
  // group only stores id/number in parallel arrays).
  const orderNumberById = useMemo(() => {
    const map: Record<string, string> = {};
    orders.forEach(o => { map[o.id] = o.orderNumber; });
    return map;
  }, [orders]);

  if (groups.length === 0) {
    return (
      <div className="mt-6 p-8 text-center text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-2xl">
        Click pins on the map above to add orders to this build.
      </div>
    );
  }

  return (
    <div className="mt-6 bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
      <div className="divide-y divide-zinc-100">
        {groups.map(group => {
          const key = schoolKeyFor(group.schoolName);
          const isCollapsed = collapsed.has(key);
          const groupUnits = group.lineItems.reduce((s, li) => s + li.qty, 0);

          return (
            <div key={key}>
              <button
                type="button"
                title={isCollapsed ? `Expand ${group.schoolName}` : `Collapse ${group.schoolName}`}
                onClick={() => toggleCollapsed(key)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-zinc-50/40 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <School className="w-4 h-4 text-brand-accent shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-850 truncate">{group.schoolName}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {group.area || '—'} · Orders: {group.orderNumbers.join(', ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono font-bold text-zinc-600">{groupUnits} units</span>
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronUp className="w-4 h-4 text-zinc-400" />}
                </div>
              </button>

              {!isCollapsed && (
                <div className="px-5 pb-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {group.orderIds.map(orderId => (
                      <span
                        key={orderId}
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-zinc-100 text-xs font-mono font-semibold text-zinc-600"
                      >
                        {orderNumberById[orderId] || orderId}
                        <button
                          type="button"
                          title={`Remove order ${orderNumberById[orderId] || orderId} from this build`}
                          onClick={() => onRemoveOrder(orderId)}
                          className={cn('p-0.5 rounded hover:bg-zinc-200 text-zinc-400 hover:text-red-600 transition-colors cursor-pointer')}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Stock Code</th>
                        <th className="py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {group.lineItems.map(li => (
                        <tr key={li.stockCode}>
                          <td className="py-1.5 text-sm font-mono text-zinc-700">{li.stockCode}</td>
                          <td className="py-1.5 text-sm font-mono font-semibold text-zinc-800 text-right">{li.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3.5 bg-zinc-50/50 border-t border-zinc-200 flex items-center justify-end gap-5 text-xs font-semibold text-zinc-500">
        <span>{groups.length} school{groups.length === 1 ? '' : 's'}</span>
        <span>{totalOrders} order{totalOrders === 1 ? '' : 's'}</span>
        <span>{totalUnits} unit{totalUnits === 1 ? '' : 's'} total</span>
      </div>
    </div>
  );
}
