import { ClipboardList, Package, FileCheck, Truck as TruckIcon } from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { StatCard } from './StatCard';

interface KpiStats {
  assembly: number;
  loaded: number;
  delivered: number;
  invoicedAmt: number;
}

export function KpiStatsRow({ stats, onDeliveredClick }: {
  stats: KpiStats;
  onDeliveredClick: () => void;
}) {
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
        subtitle="Ready for Transit"
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
        value={formatCurrency(stats.invoicedAmt)}
        icon={FileCheck}
        color="bg-emerald-50 text-emerald-600"
        subtitle="Invoiced Subtotal"
      />
    </div>
  );
}
