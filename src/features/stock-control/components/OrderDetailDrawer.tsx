import { ClipboardList, History, AlertTriangle, Hammer, RotateCcw } from 'lucide-react';
import { PhaseDrawer } from './PhaseDrawer';
import { PhaseProgressBar } from './PhaseColumn';
import type { OrderRow } from '../utils/phaseCalculations';
import { dueDateStatus } from '../utils/phaseCalculations';
import { cn } from '../../../lib/utils';

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  ready: { label: 'Ready for Delivery', className: 'bg-emerald-500 text-white' },
  'in-progress': { label: 'In Assembly', className: 'bg-sky-500 text-white' },
  'not-started': { label: 'Booked', className: 'bg-amber-500 text-white' }
};

const DUE_LABELS: Record<string, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'text-red-700 bg-red-50 border-red-200' },
  'due-today': { label: 'Due Today', className: 'text-amber-700 bg-amber-50 border-amber-200' },
  'due-tomorrow': { label: 'Due Tomorrow', className: 'text-amber-700 bg-amber-50 border-amber-200' },
  upcoming: { label: 'Upcoming', className: 'text-zinc-600 bg-zinc-50 border-zinc-200' }
};

function assemblyStatusKey(order: OrderRow): 'ready' | 'in-progress' | 'not-started' {
  if (order.isReady) return 'ready';
  if (order.totalAssembled > 0) return 'in-progress';
  return 'not-started';
}

export function OrderDetailDrawer({
  order,
  onClose,
  onViewHistory,
  onOpenAssembly,
  onRevert
}: {
  order: OrderRow | null;
  onClose: () => void;
  onViewHistory: (order: OrderRow) => void;
  onOpenAssembly: (order: OrderRow) => void;
  onRevert: (order: OrderRow) => void;
}) {
  if (!order) return null;

  const statusInfo = STATUS_LABELS[assemblyStatusKey(order)];
  const dueInfo = dueDateStatus(order.dueDate);

  return (
    <PhaseDrawer
      open={!!order}
      onClose={onClose}
      title={order.schoolName}
      subtitle={order.orderNumber}
      icon={ClipboardList}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase', statusInfo.className)}>
          {statusInfo.label}
        </span>
        {order.priority !== 'normal' && (
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-zinc-800 text-white">
            {order.priority}
          </span>
        )}
        {dueInfo && (
          <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-black uppercase border flex items-center gap-1', DUE_LABELS[dueInfo].className)}>
            {dueInfo === 'overdue' && <AlertTriangle className="w-3 h-3" />}
            {DUE_LABELS[dueInfo].label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-2.5">
          <p className="text-sm font-black text-brand-primary">{order.totalOrdered}</p>
          <p className="text-[9px] font-black uppercase text-zinc-400">Units</p>
        </div>
        <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-2.5">
          <p className="text-sm font-black text-emerald-600">{order.totalAssembled}</p>
          <p className="text-[9px] font-black uppercase text-zinc-400">Assembled</p>
        </div>
        <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-2.5">
          <p className="text-sm font-black text-brand-accent">{order.progressPct}%</p>
          <p className="text-[9px] font-black uppercase text-zinc-400">Complete</p>
        </div>
      </div>
      <PhaseProgressBar pct={order.progressPct} accent={order.isReady ? 'emerald' : 'sky'} />

      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-500">
        <span>Area: <strong className="text-zinc-700">{order.area}</strong></span>
        <span>School Type: <strong className="text-zinc-700">{order.schoolType || 'N/A'}</strong></span>
        <span>Client No: <strong className="text-zinc-700">{order.clientNumber || 'N/A'}</strong></span>
        <span>Due: <strong className="text-zinc-700">{order.dueDate || 'N/A'}</strong></span>
      </div>

      {order.isShortStock && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {order.shortUnits} units short of available stock — order is partially stocked.
        </div>
      )}

      <div className="flex items-center gap-2">
        {!order.isReady && (
          <button
            type="button"
            title={order.totalAssembled > 0 ? 'Continue assembly for this order' : 'Start assembly for this order'}
            onClick={() => onOpenAssembly(order)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
          >
            <Hammer className="w-3.5 h-3.5" />
            {order.totalAssembled > 0 ? 'Continue Assembly' : 'Start Assembly'}
          </button>
        )}
        <button
          type="button"
          title="View allocation and assembly history for this order"
          onClick={() => onViewHistory(order)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
        >
          <History className="w-3.5 h-3.5" />
          View History
        </button>
      </div>

      {order.totalReserved > 0 && (
        <button
          type="button"
          title="Revert this order back to Available Stock"
          onClick={() => onRevert(order)}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Revert to Stock
        </button>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-zinc-400 uppercase font-mono text-[9px] tracking-wide">
              <th className="text-left font-black pb-2">Product</th>
              <th className="text-right font-black pb-2">Ord</th>
              <th className="text-right font-black pb-2">Res</th>
              <th className="text-right font-black pb-2">Built</th>
              <th className="text-right font-black pb-2">Rem</th>
              <th className="text-right font-black pb-2">%</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map(line => (
              <tr key={line.stockCode} className="border-t border-zinc-100">
                <td className="py-2">
                  <p className="font-bold text-brand-primary truncate max-w-[120px]" title={line.description}>{line.description || line.stockCode}</p>
                  <p className="text-[9px] font-mono text-zinc-400">{line.stockCode}</p>
                </td>
                <td className="py-2 text-right font-mono">{line.ordered}</td>
                <td className={cn('py-2 text-right font-mono', line.isShort ? 'text-red-600 font-bold' : 'text-zinc-600')}>{line.reserved}</td>
                <td className="py-2 text-right font-mono text-emerald-600">{line.assembled}</td>
                <td className="py-2 text-right font-mono text-zinc-500">{line.remaining}</td>
                <td className="py-2 text-right font-mono font-bold">{line.progressPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PhaseDrawer>
  );
}
