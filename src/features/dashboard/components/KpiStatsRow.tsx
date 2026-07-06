import { useState } from 'react';
import { ClipboardList, Package, FileCheck, Truck as TruckIcon, Clock, Archive } from 'lucide-react';
import { cn, formatCurrency } from '../../../lib/utils';
import { StatCard } from './StatCard';

interface KpiStats {
  assembly: number;
  loaded: number;
  delivered: number;
  invoicedAmt: number;
}

type InvoicedMetricMode = 'last' | 'history';

export function KpiStatsRow({
  stats, onDeliveredClick, onPartiallyCompletedClick, onInvoicedClick,
  lastInvoicedAmount, historyInvoicedTotal
}: {
  stats: KpiStats;
  onDeliveredClick: () => void;
  onPartiallyCompletedClick: () => void;
  onInvoicedClick: () => void;
  // Self-invoice derived amounts the two top-right toggle icons switch between.
  lastInvoicedAmount: number;
  historyInvoicedTotal: number;
}) {
  const [invoicedMode, setInvoicedMode] = useState<InvoicedMetricMode>('last');
  const invoicedValue = invoicedMode === 'last' ? lastInvoicedAmount : historyInvoicedTotal;
  const invoicedSubtitle = invoicedMode === 'last' ? 'Last Invoiced Amount' : 'Total Invoiced (History)';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="ASSEMBLY"
        value={stats.assembly.toString()}
        icon={ClipboardList}
        color="bg-blue-50 text-blue-600"
        subtitle="Picking & Packing"
      />
      <StatCard
        title="PARTIALLY COMPLETE"
        value={stats.loaded.toString()}
        icon={Package}
        color="bg-amber-50 text-amber-600"
        subtitle="Click to view all"
        onClick={onPartiallyCompletedClick}
      />
      <StatCard
        title="DELIVERED"
        value={stats.delivered.toString()}
        icon={TruckIcon}
        color="bg-indigo-50 text-indigo-600"
        subtitle="Click to view & bill"
        onClick={onDeliveredClick}
      />
      <StatCard
        title="INVOICED"
        value={formatCurrency(invoicedValue)}
        icon={FileCheck}
        color="bg-emerald-50 text-emerald-600"
        subtitle={invoicedSubtitle}
        onClick={onInvoicedClick}
        topRightActions={
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              title="Last Invoiced Amount"
              onClick={() => setInvoicedMode('last')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                invoicedMode === 'last' ? "bg-emerald-100 text-emerald-700" : "text-zinc-350 hover:text-zinc-500 hover:bg-zinc-100"
              )}
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Total Invoiced (History)"
              onClick={() => setInvoicedMode('history')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                invoicedMode === 'history' ? "bg-emerald-100 text-emerald-700" : "text-zinc-350 hover:text-zinc-500 hover:bg-zinc-100"
              )}
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          </div>
        }
      />
    </div>
  );
}
