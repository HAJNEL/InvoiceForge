import { useState } from 'react';
import { toast } from 'sonner';
import { Minus, Plus, CheckCircle2, RotateCcw } from 'lucide-react';
import { PhaseModal } from './PhaseModal';
import { PhaseProgressBar } from './PhaseColumn';
import type { OrderRow } from '../utils/phaseCalculations';

export function AssemblyModal({
  order,
  onClose,
  onRecordChange,
  onRevert
}: {
  order: OrderRow | null;
  onClose: () => void;
  onRecordChange: (params: {
    invoiceId: string; orderNumber: string; schoolName: string; stockCode: string;
    previousQty: number; newQty: number;
  }) => Promise<{ success: boolean; error?: string }>;
  onRevert: (order: OrderRow) => void;
}) {
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  if (!order) return null;

  const applyChange = async (stockCode: string, previousQty: number, delta: number, cap: number) => {
    const newQty = Math.max(0, Math.min(cap, previousQty + delta));
    if (newQty === previousQty) return;

    setPendingCode(stockCode);
    const result = await onRecordChange({
      invoiceId: order.invoiceId,
      orderNumber: order.orderNumber,
      schoolName: order.schoolName,
      stockCode,
      previousQty,
      newQty
    });
    setPendingCode(null);

    if (!result.success) {
      toast.error(result.error || 'Assembly quantity could not be updated.');
    }
  };

  return (
    <PhaseModal
      isOpen={!!order}
      onClose={onClose}
      title="Assembly Progress"
      subtitle={`${order.schoolName} · ${order.orderNumber}`}
      maxWidth="max-w-2xl"
    >
      <div className="bg-zinc-50 border border-zinc-150 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="font-black text-brand-primary">Overall: {order.totalAssembled} / {order.totalOrdered}</span>
          <span className={order.isReady ? 'text-emerald-600 font-black' : 'text-sky-600 font-black'}>
            {order.progressPct}% Complete
          </span>
        </div>
        <PhaseProgressBar pct={order.progressPct} accent={order.isReady ? 'emerald' : 'sky'} />
        {order.isReady && (
          <p className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Delivery
          </p>
        )}
        <button
          type="button"
          title={`Revert ${order.schoolName} back to Available Stock`}
          onClick={() => onRevert(order)}
          className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-lg transition-all cursor-pointer -ml-2"
        >
          <RotateCcw className="w-3 h-3" />
          Revert to Stock
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-zinc-400 uppercase font-mono text-[10px] tracking-wide">
              <th className="text-left font-black pb-2">Product</th>
              <th className="text-right font-black pb-2">Reserved</th>
              <th className="text-right font-black pb-2">Built</th>
              <th className="text-right font-black pb-2">Remaining</th>
              <th className="text-right font-black pb-2 pl-4">Build</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map(line => {
              const isComplete = line.reserved > 0 && line.assembled >= line.reserved;
              const isDisabled = pendingCode === line.stockCode || line.reserved === 0;
              return (
                <tr key={line.stockCode} className="border-t border-zinc-100">
                  <td className="py-2.5">
                    <p className="font-bold text-brand-primary truncate max-w-[160px]" title={line.description}>{line.description || line.stockCode}</p>
                    <p className="text-[10px] font-mono text-zinc-400">{line.stockCode}</p>
                  </td>
                  <td className="py-2.5 text-right font-mono">{line.reserved}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-emerald-600">{line.assembled}</td>
                  <td className="py-2.5 text-right font-mono text-zinc-500">{Math.max(0, line.reserved - line.assembled)}</td>
                  <td className="py-2.5 pl-4">
                    {isComplete ? (
                      <span className="flex items-center gap-1 justify-end text-[10px] font-black text-emerald-600 uppercase">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                      </span>
                    ) : (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          title={`Decrease built quantity for ${line.stockCode}`}
                          disabled={isDisabled || line.assembled <= 0}
                          onClick={() => applyChange(line.stockCode, line.assembled, -1, line.reserved)}
                          className="p-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 rounded-lg cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-mono font-bold">{line.assembled}</span>
                        <button
                          type="button"
                          title={`Increase built quantity for ${line.stockCode} by 1`}
                          disabled={isDisabled}
                          onClick={() => applyChange(line.stockCode, line.assembled, 1, line.reserved)}
                          className="p-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 rounded-lg cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          title={`Increase built quantity for ${line.stockCode} by 5`}
                          disabled={isDisabled}
                          onClick={() => applyChange(line.stockCode, line.assembled, 5, line.reserved)}
                          className="px-1.5 py-1 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 rounded-lg cursor-pointer disabled:cursor-not-allowed text-[9px] font-black"
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          title={`Build all remaining ${line.stockCode}`}
                          disabled={isDisabled}
                          onClick={() => applyChange(line.stockCode, line.assembled, line.reserved - line.assembled, line.reserved)}
                          className="px-1.5 py-1 bg-brand-primary hover:bg-zinc-800 text-white disabled:opacity-40 rounded-lg cursor-pointer disabled:cursor-not-allowed text-[9px] font-black uppercase"
                        >
                          Build All
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </PhaseModal>
  );
}
