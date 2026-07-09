import { useMemo, useState } from 'react';
import { Package, FileCheck, Truck as TruckIcon, Clock, Archive, Fuel, Banknote } from 'lucide-react';
import { cn, formatCurrency } from '../../../lib/utils';
import { StatCard } from './StatCard';
import { FuelLog } from '../hooks/useFuelLogs';

interface KpiStats {
  loaded: number;
  delivered: number;
  invoicedAmt: number;
}

type InvoicedMetricMode = 'last' | 'history';
type FuelMetricMode = 'liters' | 'rand';
type FuelPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

const FUEL_PERIOD_OPTIONS: { value: FuelPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

// Whether a 'YYYY-MM-DD' refuel date falls within the given rolling period,
// anchored to today. Weekly uses a Monday-start calendar week.
function isWithinFuelPeriod(refuelDate: string, period: FuelPeriod): boolean {
  const date = new Date(`${refuelDate}T00:00:00`);
  if (isNaN(date.getTime())) return false;
  const now = new Date();

  switch (period) {
    case 'daily':
      return refuelDate === now.toISOString().slice(0, 10);
    case 'weekly': {
      const dayIndex = (now.getDay() + 6) % 7; // Monday = 0 ... Sunday = 6
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayIndex);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6, 23, 59, 59, 999);
      return date >= monday && date <= sunday;
    }
    case 'monthly':
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    case 'yearly':
      return date.getFullYear() === now.getFullYear();
  }
}

export function KpiStatsRow({
  stats, onDeliveredClick, onPartiallyCompletedClick, onInvoicedClick, onFuelClick,
  lastInvoicedAmount, historyInvoicedTotal, fuelLogs
}: {
  stats: KpiStats;
  onDeliveredClick: () => void;
  onPartiallyCompletedClick: () => void;
  onInvoicedClick: () => void;
  onFuelClick: () => void;
  // Self-invoice derived amounts the two top-right toggle icons switch between.
  lastInvoicedAmount: number;
  historyInvoicedTotal: number;
  fuelLogs: FuelLog[];
}) {
  const [invoicedMode, setInvoicedMode] = useState<InvoicedMetricMode>('last');
  const invoicedValue = invoicedMode === 'last' ? lastInvoicedAmount : historyInvoicedTotal;
  const invoicedSubtitle = invoicedMode === 'last' ? 'Last Invoiced Amount' : 'Total Invoiced (History)';

  const [fuelMetricMode, setFuelMetricMode] = useState<FuelMetricMode>('liters');
  const [fuelPeriod, setFuelPeriod] = useState<FuelPeriod>('monthly');

  const fuelPeriodLogs = useMemo(
    () => fuelLogs.filter(log => isWithinFuelPeriod(log.refuelDate, fuelPeriod)),
    [fuelLogs, fuelPeriod]
  );
  const fuelLitersTotal = useMemo(
    () => fuelPeriodLogs.reduce((sum, log) => sum + (log.liters || 0), 0),
    [fuelPeriodLogs]
  );
  const fuelRandTotal = useMemo(
    () => fuelPeriodLogs.reduce((sum, log) => sum + (log.cost || 0), 0),
    [fuelPeriodLogs]
  );
  const fuelValue = fuelMetricMode === 'liters' ? `${fuelLitersTotal.toFixed(1)} L` : formatCurrency(fuelRandTotal);
  const fuelPeriodLabel = FUEL_PERIOD_OPTIONS.find(o => o.value === fuelPeriod)?.label;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="FUEL"
        value={fuelValue}
        icon={Fuel}
        color="bg-orange-50 text-orange-600"
        subtitle={`Fuel Consumption · ${fuelPeriodLabel}`}
        onClick={onFuelClick}
        topRightActions={
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              title="Show liters consumed"
              onClick={() => setFuelMetricMode('liters')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                fuelMetricMode === 'liters' ? "bg-orange-100 text-orange-700" : "text-zinc-350 hover:text-zinc-500 hover:bg-zinc-100"
              )}
            >
              <Fuel className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              title="Show Rand value"
              onClick={() => setFuelMetricMode('rand')}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                fuelMetricMode === 'rand' ? "bg-orange-100 text-orange-700" : "text-zinc-350 hover:text-zinc-500 hover:bg-zinc-100"
              )}
            >
              <Banknote className="w-3.5 h-3.5" />
            </button>
          </div>
        }
        filterRow={
          <select
            title="Select the date range for fuel consumption"
            value={fuelPeriod}
            onChange={(e) => setFuelPeriod(e.target.value as FuelPeriod)}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-[10px] font-black uppercase tracking-widest bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
          >
            {FUEL_PERIOD_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        }
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
