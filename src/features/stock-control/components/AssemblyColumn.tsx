import { Hammer, ChevronRight } from 'lucide-react';
import { PhaseColumn, PhaseProgressBar } from './PhaseColumn';
import type { OrderRow } from '../utils/phaseCalculations';

export function AssemblyColumn({
  orders,
  totalUnits,
  onOpenAssembly
}: {
  orders: OrderRow[];
  totalUnits: number;
  onOpenAssembly: (order: OrderRow) => void;
}) {
  return (
    <PhaseColumn
      index={3}
      title="In Assembly"
      subtitle="Currently being assembled"
      icon={Hammer}
      accent="sky"
      countLabel={`${orders.length} Job${orders.length === 1 ? '' : 's'} · ${totalUnits.toLocaleString()} Units`}
      isEmpty={orders.length === 0}
      emptyTitle="No orders in assembly"
      emptyDescription="No orders are currently being assembled."
    >
      {orders.map((order) => (
        <button
          key={order.invoiceId}
          type="button"
          title={`Open assembly view for ${order.schoolName}`}
          onClick={() => onOpenAssembly(order)}
          className="w-full text-left bg-zinc-50/50 border border-zinc-200 hover:border-sky-250 rounded-2xl p-3.5 space-y-2 cursor-pointer transition-all"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-black text-brand-primary uppercase leading-snug truncate">{order.schoolName}</p>
              <span className="font-mono text-[10px] font-black bg-zinc-900 text-white px-1.5 py-0.5 rounded">{order.orderNumber}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
          </div>

          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-500">{order.totalAssembled} / {order.totalOrdered}</span>
            <span className="font-black text-sky-600">{order.progressPct}% Complete</span>
          </div>
          <PhaseProgressBar pct={order.progressPct} accent="sky" />
        </button>
      ))}
    </PhaseColumn>
  );
}
