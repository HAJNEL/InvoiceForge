import { Boxes, ClipboardList, Hammer, PackageCheck, TrendingUp } from 'lucide-react';
import { StatCard } from '../../dashboard/components/StatCard';
import type { PhaseKpis } from '../utils/phaseCalculations';

export function PhaseKpiBar({ kpis }: { kpis: PhaseKpis }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <StatCard
        title="Available Stock"
        value={kpis.knockdownAvailable.toLocaleString()}
        subtitle="Available to allocate"
        icon={Boxes}
        color="bg-brand-accent/10 text-brand-accent"
      />
      <StatCard
        title="Reserved to Schools"
        value={kpis.reservedToSchools.toLocaleString()}
        subtitle={`Reserved for assembly · ${kpis.reservedSchoolCount} school${kpis.reservedSchoolCount === 1 ? '' : 's'}`}
        icon={ClipboardList}
        color="bg-amber-50 text-amber-600"
      />
      <StatCard
        title="In Assembly"
        value={kpis.inAssembly.toLocaleString()}
        subtitle={`Currently being assembled · ${kpis.assemblyJobCount} job${kpis.assemblyJobCount === 1 ? '' : 's'}`}
        icon={Hammer}
        color="bg-sky-50 text-sky-600"
      />
      <StatCard
        title="Ready for Delivery"
        value={kpis.readyForDelivery.toLocaleString()}
        subtitle={`Fully assembled · ${kpis.readySchoolCount} school${kpis.readySchoolCount === 1 ? '' : 's'}`}
        icon={PackageCheck}
        color="bg-emerald-50 text-emerald-600"
      />
      <StatCard
        title="Overall Build Progress"
        value={`${kpis.overallProgressPct}%`}
        icon={TrendingUp}
        color="bg-brand-accent/10 text-brand-accent"
        filterRow={
          <div className="space-y-1.5">
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-accent transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(0, kpis.overallProgressPct))}%` }}
              />
            </div>
            <p className="text-[10px] font-bold text-zinc-500 font-mono">
              {kpis.totalAssembled.toLocaleString()} / {kpis.totalOrdered.toLocaleString()} units assembled
            </p>
          </div>
        }
      />
    </div>
  );
}
