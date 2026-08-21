import { useState, useEffect } from 'react';
import { X, School, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Order } from '../../orders/hooks/useOrders';

// Opens when a map pin represents more than one eligible order for a school (see
// OrderBuilderMap.tsx). Lets the user tick which of that school's orders to
// include in the in-progress build - orders left unticked are NOT marked consumed
// anywhere, they simply stay available for a future build (product decision).
export function SchoolOrdersSelectModal({
  isOpen,
  schoolName,
  orders,
  selectedOrderIds,
  onConfirm,
  onClose
}: {
  isOpen: boolean;
  schoolName: string;
  orders: Order[];
  selectedOrderIds: Set<string>;
  onConfirm: (tickedIds: string[]) => void;
  onClose: () => void;
}) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  // Re-seed from the build's current selection every time the modal opens for a
  // (possibly different) school - orders already in the build start checked,
  // others start unchecked, per the product decision (no bulk-default-on).
  useEffect(() => {
    if (isOpen) {
      setTicked(new Set(orders.filter(o => selectedOrderIds.has(o.id)).map(o => o.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, schoolName]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setTicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const lineItemSummary = (order: Order) => {
    const codes = order.lineItems.length;
    const units = order.lineItems.reduce((s, l) => s + l.qty, 0);
    return `${codes} stock code${codes === 1 ? '' : 's'}, ${units} unit${units === 1 ? '' : 's'} total`;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <School className="w-5 h-5 text-brand-accent shrink-0" />
            <h2 className="text-sm font-bold text-zinc-900 truncate">{schoolName}</h2>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2">
          {orders.map(order => (
            <label
              key={order.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                ticked.has(order.id) ? 'border-brand-accent bg-brand-accent/5' : 'border-zinc-200 hover:bg-zinc-50'
              )}
            >
              <input
                type="checkbox"
                title={`Include order ${order.orderNumber}`}
                checked={ticked.has(order.id)}
                onChange={() => toggle(order.id)}
                className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30 cursor-pointer"
              />
              <div className="min-w-0">
                <p className="text-sm font-mono font-semibold text-zinc-850">{order.orderNumber || '—'}</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-ZA') : '—'} · {lineItemSummary(order)}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-200 shrink-0">
          <button
            type="button"
            title="Cancel"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Confirm selected orders"
            onClick={() => onConfirm([...ticked])}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-brand-accent hover:bg-brand-accent/95 transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
