import { ReactNode, useMemo, useState } from 'react';
import { Package, FileCheck, Truck as TruckIcon, Clock, Archive, Fuel, Banknote, ChevronDown, type LucideIcon } from 'lucide-react';
import { cn, formatCurrency } from '../../../lib/utils';
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
// Kept identical to KpiStatsRow.tsx's copy so mobile/desktop numbers never drift.
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

/**
 * Compact KPI tile for the 2x2 mobile grid. Deliberately not a reuse of the
 * desktop StatCard: that card's padding/font sizes are sized for a wide row
 * and only look right at ~78% viewport width, not a ~165px grid cell.
 * Tiles with secondary controls (fuel metric/period, invoiced last/history)
 * hide them behind a chevron instead of showing them permanently, since
 * there's no room for an inline toggle row at this width.
 */
function MiniStatTile({
  title, value, icon: Icon, color, subtitle, onClick, expandedContent,
}: {
  title: string;
  value: string;
  icon: LucideIcon;
  color: string;
  subtitle?: string;
  onClick?: () => void;
  expandedContent?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'saas-card p-3.5 relative overflow-hidden',
        onClick && 'active:scale-[0.98] transition-transform'
      )}
    >
      <div
        onClick={onClick}
        className={cn('flex items-start justify-between gap-2', onClick && 'cursor-pointer')}
      >
        <div className={cn('p-2 rounded-lg shrink-0', color)}>
          <Icon className="w-4 h-4" />
        </div>
        {expandedContent && (
          <button
            type="button"
            title={expanded ? 'Hide options' : 'Show options'}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="p-1.5 -m-1 rounded-lg text-zinc-350 hover:bg-zinc-100 transition-colors mobile-tap-target"
          >
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>

      <div onClick={onClick} className={cn('mt-2 min-w-0', onClick && 'cursor-pointer')}>
        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest truncate">{title}</p>
        <p className="text-xl font-black mt-0.5 tracking-tight tabular-nums text-zinc-900 truncate">{value}</p>
        {subtitle && (
          <p className="text-[9px] font-bold text-zinc-400 mt-0.5 uppercase tracking-tight truncate">{subtitle}</p>
        )}
      </div>

      {expandedContent && expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-zinc-100 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          {expandedContent}
        </div>
      )}
    </div>
  );
}

export function KpiStatsRowMobile({
  stats, onDeliveredClick, onPartiallyCompletedClick, onInvoicedClick, onFuelClick,
  lastInvoicedAmount, historyInvoicedTotal, fuelLogs
}: {
  stats: KpiStats;
  onDeliveredClick: () => void;
  onPartiallyCompletedClick: () => void;
  onInvoicedClick: () => void;
  onFuelClick: () => void;
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
    <div className="grid grid-cols-2 gap-3">
      <MiniStatTile
        title="FUEL"
        value={fuelValue}
        icon={Fuel}
        color="bg-orange-50 text-orange-600"
        subtitle={`Consumption · ${fuelPeriodLabel}`}
        onClick={onFuelClick}
        expandedContent={
          <>
            <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg p-0.5">
              <button
                type="button"
                title="Show liters consumed"
                onClick={() => setFuelMetricMode('liters')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all mobile-tap-target',
                  fuelMetricMode === 'liters' ? 'bg-white text-orange-700 shadow-2xs' : 'text-zinc-500'
                )}
              >
                <Fuel className="w-3 h-3" /> Liters
              </button>
              <button
                type="button"
                title="Show Rand value"
                onClick={() => setFuelMetricMode('rand')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all mobile-tap-target',
                  fuelMetricMode === 'rand' ? 'bg-white text-orange-700 shadow-2xs' : 'text-zinc-500'
                )}
              >
                <Banknote className="w-3 h-3" /> Rand
              </button>
            </div>
            <select
              title="Select the date range for fuel consumption"
              value={fuelPeriod}
              onChange={(e) => setFuelPeriod(e.target.value as FuelPeriod)}
              className="w-full text-[9px] font-black uppercase tracking-widest bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 text-zinc-600 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            >
              {FUEL_PERIOD_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </>
        }
      />

      <MiniStatTile
        title="PARTIAL"
        value={stats.loaded.toString()}
        icon={Package}
        color="bg-amber-50 text-amber-600"
        subtitle="Tap to view all"
        onClick={onPartiallyCompletedClick}
      />

      <MiniStatTile
        title="DELIVERED"
        value={stats.delivered.toString()}
        icon={TruckIcon}
        color="bg-indigo-50 text-indigo-600"
        subtitle="Tap to view & bill"
        onClick={onDeliveredClick}
      />

      <MiniStatTile
        title="INVOICED"
        value={formatCurrency(invoicedValue)}
        icon={FileCheck}
        color="bg-emerald-50 text-emerald-600"
        subtitle={invoicedSubtitle}
        onClick={onInvoicedClick}
        expandedContent={
          <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg p-0.5">
            <button
              type="button"
              title="Last Invoiced Amount"
              onClick={() => setInvoicedMode('last')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all mobile-tap-target',
                invoicedMode === 'last' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-zinc-500'
              )}
            >
              <Clock className="w-3 h-3" /> Last
            </button>
            <button
              type="button"
              title="Total Invoiced (History)"
              onClick={() => setInvoicedMode('history')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all mobile-tap-target',
                invoicedMode === 'history' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-zinc-500'
              )}
            >
              <Archive className="w-3 h-3" /> History
            </button>
          </div>
        }
      />
    </div>
  );
}
