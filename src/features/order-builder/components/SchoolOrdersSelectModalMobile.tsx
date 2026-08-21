import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import type { Order } from '../../orders/hooks/useOrders';

// Mobile counterpart to SchoolOrdersSelectModal.tsx - a bottom sheet instead of a
// centered dialog, matching this feature area's existing desktop-modal-to-mobile-
// sheet conversion (see CustomStopModal.tsx / CustomStopModalMobile.tsx). Same
// props/behavior as the desktop version.
export function SchoolOrdersSelectModalMobile({
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

  useEffect(() => {
    if (isOpen) {
      setTicked(new Set(orders.filter(o => selectedOrderIds.has(o.id)).map(o => o.id)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, schoolName]);

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
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={schoolName}
      subtitle={`${orders.length} order${orders.length === 1 ? '' : 's'}`}
      fullHeight={false}
      footer={
        <button
          type="button"
          title="Confirm selected orders"
          onClick={() => onConfirm([...ticked])}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-brand-accent mobile-tap-target"
        >
          <Check className="w-4 h-4" />
          Confirm
        </button>
      }
    >
      <div className="space-y-2">
        {orders.map(order => (
          <label
            key={order.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors mobile-tap-target',
              ticked.has(order.id) ? 'border-brand-accent bg-brand-accent/5' : 'border-zinc-200'
            )}
          >
            <input
              type="checkbox"
              title={`Include order ${order.orderNumber}`}
              checked={ticked.has(order.id)}
              onChange={() => toggle(order.id)}
              className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30"
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
    </MobileSheet>
  );
}
