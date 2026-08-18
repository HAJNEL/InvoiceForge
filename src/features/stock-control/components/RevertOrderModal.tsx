import { useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw, AlertTriangle } from 'lucide-react';
import { PhaseModal } from './PhaseModal';
import type { OrderRow } from '../utils/phaseCalculations';

export function RevertOrderModal({
  order,
  onClose,
  onRevert
}: {
  order: OrderRow | null;
  onClose: () => void;
  onRevert: (order: OrderRow) => Promise<{ success: boolean; error?: string }>;
}) {
  const [submitting, setSubmitting] = useState(false);

  if (!order) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    const result = await onRevert(order);
    setSubmitting(false);

    if (result.success) {
      toast.success('Order Reverted', { description: `${order.schoolName}'s reserved and built units are back in Available Stock.` });
      onClose();
    } else {
      toast.error(result.error || 'Unable to revert this order. Please try again.');
    }
  };

  return (
    <PhaseModal
      isOpen={!!order}
      onClose={onClose}
      title="Revert to Stock"
      subtitle={`${order.schoolName} · ${order.orderNumber}`}
      footer={
        <>
          <button
            type="button"
            title="Cancel"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Confirm revert to stock"
            onClick={handleConfirm}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {submitting ? 'Reverting…' : 'Revert to Stock'}
          </button>
        </>
      }
    >
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-semibold flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>This releases every reservation for this order and resets its assembly progress back to 0. The order will drop out of Booked, Assembly and Ready, and the units become available to allocate again.</span>
      </div>

      <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-3.5 space-y-1.5">
        <p className="text-xs font-black text-brand-primary uppercase">{order.schoolName}</p>
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Reserved: <strong className="text-amber-600">{order.totalReserved}</strong></span>
          <span>Assembled: <strong className="text-emerald-600">{order.totalAssembled}</strong></span>
        </div>
      </div>
    </PhaseModal>
  );
}
