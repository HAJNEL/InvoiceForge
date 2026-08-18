import { useState } from 'react';
import { ClipboardList, ChevronDown, ChevronUp, AlertTriangle, Hammer, RotateCcw } from 'lucide-react';
import { PhaseColumn, PhaseProgressBar } from './PhaseColumn';
import type { OrderRow } from '../utils/phaseCalculations';
import { cn } from '../../../lib/utils';

export function BookedColumn({
  orders,
  totalUnits,
  onOpenOrder,
  onOpenAssembly,
  onRevert
}: {
  orders: OrderRow[];
  totalUnits: number;
  onOpenOrder: (order: OrderRow) => void;
  onOpenAssembly: (order: OrderRow) => void;
  onRevert: (order: OrderRow) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  return (
    <PhaseColumn
      index={2}
      title="Booked to Schools"
      subtitle="Reserved for assembly"
      icon={ClipboardList}
      accent="amber"
      countLabel={`${orders.length} School${orders.length === 1 ? '' : 's'} · ${totalUnits.toLocaleString()} Units`}
      isEmpty={orders.length === 0}
      emptyTitle="No booked orders"
      emptyDescription="Allocate knockdown stock to a school to book it here."
    >
      {orders.map((order) => {
        const isExpanded = !!expandedIds[order.invoiceId];
        return (
          <div key={order.invoiceId} className="bg-zinc-50/50 border border-zinc-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              title={`View details for ${order.schoolName}`}
              onClick={() => setExpandedIds(prev => ({ ...prev, [order.invoiceId]: !prev[order.invoiceId] }))}
              className="w-full text-left p-3.5 space-y-2 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-black text-brand-primary uppercase leading-snug truncate">{order.schoolName}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="font-mono text-[10px] font-black bg-zinc-900 text-white px-1.5 py-0.5 rounded">{order.orderNumber}</span>
                    <span className="text-[10px] text-zinc-400 font-mono uppercase">{order.area}</span>
                    {order.isShortStock && (
                      <span className="flex items-center gap-0.5 text-[10px] font-black text-red-700 bg-red-50 border border-red-150 px-1.5 py-0.5 rounded uppercase">
                        <AlertTriangle className="w-3 h-3" /> {order.shortUnits} short
                      </span>
                    )}
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />}
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                <span>{order.totalReserved} units booked</span>
                <span className="font-black text-brand-primary">{order.totalAssembled} / {order.totalOrdered} assembled ({order.progressPct}%)</span>
              </div>
              <PhaseProgressBar pct={order.progressPct} accent="amber" />
            </button>

            {isExpanded && (
              <div className="border-t border-zinc-150 bg-white p-3 space-y-2">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-400 uppercase font-mono tracking-wide">
                        <th className="text-left font-black pb-1.5">SKU</th>
                        <th className="text-right font-black pb-1.5">Ord</th>
                        <th className="text-right font-black pb-1.5">Res</th>
                        <th className="text-right font-black pb-1.5">Built</th>
                        <th className="text-right font-black pb-1.5">Rem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.lines.map(line => (
                        <tr key={line.stockCode} className="border-t border-zinc-100">
                          <td className="py-1.5 font-mono font-bold text-zinc-700 truncate max-w-[90px]" title={line.description}>{line.stockCode}</td>
                          <td className="py-1.5 text-right font-mono">{line.ordered}</td>
                          <td className={cn('py-1.5 text-right font-mono', line.isShort ? 'text-red-600 font-bold' : 'text-zinc-600')}>{line.reserved}</td>
                          <td className="py-1.5 text-right font-mono text-emerald-600">{line.assembled}</td>
                          <td className="py-1.5 text-right font-mono text-zinc-500">{line.remaining}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    title={`Open full order details for ${order.schoolName}`}
                    onClick={() => onOpenOrder(order)}
                    className="flex-1 py-1.5 text-xs font-black uppercase text-brand-accent hover:bg-brand-accent/5 rounded-lg transition-all cursor-pointer border border-brand-accent/20"
                  >
                    Order Details
                  </button>
                  <button
                    type="button"
                    title={`Start assembly for ${order.schoolName}`}
                    onClick={() => onOpenAssembly(order)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-black uppercase text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-all cursor-pointer"
                  >
                    <Hammer className="w-3.5 h-3.5" />
                    Build
                  </button>
                  <button
                    type="button"
                    title={`Revert ${order.schoolName} back to Available Stock`}
                    onClick={() => onRevert(order)}
                    className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer border border-transparent hover:border-amber-150 shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </PhaseColumn>
  );
}
