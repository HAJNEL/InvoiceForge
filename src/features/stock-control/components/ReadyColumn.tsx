import { PackageCheck, Truck, RotateCcw } from 'lucide-react';
import { PhaseColumn } from './PhaseColumn';
import type { OrderRow } from '../utils/phaseCalculations';

function formatReadyDate(iso: string | null): string {
  if (!iso) return 'N/A';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function ReadyColumn({
  orders,
  totalUnits,
  onOpenOrder,
  onAddToTrip,
  onRevert
}: {
  orders: OrderRow[];
  totalUnits: number;
  onOpenOrder: (order: OrderRow) => void;
  onAddToTrip: (order: OrderRow) => void;
  onRevert: (order: OrderRow) => void;
}) {
  return (
    <PhaseColumn
      index={4}
      title="Ready for Delivery"
      subtitle="Fully assembled and ready for dispatch"
      icon={PackageCheck}
      accent="emerald"
      countLabel={`${orders.length} School${orders.length === 1 ? '' : 's'} · ${totalUnits.toLocaleString()} Units`}
      isEmpty={orders.length === 0}
      emptyTitle="Nothing ready yet"
      emptyDescription="Orders will appear here automatically once every SKU is fully assembled."
    >
      {orders.map((order) => (
        <div key={order.invoiceId} className="bg-emerald-50/40 border border-emerald-150 rounded-2xl p-3.5 space-y-2.5">
          <button
            type="button"
            title={`Open order details for ${order.schoolName}`}
            onClick={() => onOpenOrder(order)}
            className="w-full text-left cursor-pointer"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-emerald-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Ready</span>
              <span className="font-mono text-[10px] font-black bg-zinc-900 text-white px-1.5 py-0.5 rounded">{order.orderNumber}</span>
            </div>
            <p className="text-sm font-black text-brand-primary uppercase leading-snug mt-1.5 truncate">{order.schoolName}</p>
            <div className="flex items-center justify-between text-xs font-mono text-zinc-500 mt-1">
              <span>{order.totalOrdered} units ready</span>
              <span>{order.area}</span>
            </div>
            <p className="text-xs font-mono text-zinc-400 mt-0.5">Ready: {formatReadyDate(order.lastAssemblyAt)}</p>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title={`Add ${order.schoolName}'s order to a delivery trip`}
              onClick={() => onAddToTrip(order)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase rounded-lg transition-all cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5" />
              Add to Trip
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
      ))}
    </PhaseColumn>
  );
}
