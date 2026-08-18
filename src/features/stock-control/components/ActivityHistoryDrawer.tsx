import { useMemo } from 'react';
import { History, PackagePlus, Hammer } from 'lucide-react';
import { PhaseDrawer } from './PhaseDrawer';
import type { OrderRow } from '../utils/phaseCalculations';
import type { StockAllocation } from '../hooks/useAllocations';
import type { AssemblyLog } from '../hooks/useAssemblyLogs';

interface TimelineEntry {
  key: string;
  timestamp: string;
  icon: typeof PackagePlus;
  text: string;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function ActivityHistoryDrawer({
  order,
  allocations,
  assemblyLogs,
  onClose
}: {
  order: OrderRow | null;
  allocations: StockAllocation[];
  assemblyLogs: AssemblyLog[];
  onClose: () => void;
}) {
  const timeline = useMemo<TimelineEntry[]>(() => {
    if (!order) return [];
    const entries: TimelineEntry[] = [];

    for (const alloc of allocations) {
      if (alloc.invoiceId !== order.invoiceId) continue;
      entries.push({
        key: `alloc-${alloc.id}`,
        timestamp: alloc.allocatedAt,
        icon: PackagePlus,
        text: `${alloc.allocatedByName} allocated ${alloc.qty} × ${alloc.stockCode} to ${alloc.schoolName}${alloc.releasedAt ? ' (later released)' : ''}.`
      });
    }

    for (const log of assemblyLogs) {
      if (log.invoiceId !== order.invoiceId) continue;
      const verb = log.change >= 0 ? 'assembled' : 'un-built';
      entries.push({
        key: `assy-${log.id}`,
        timestamp: log.updatedAt,
        icon: Hammer,
        text: `${log.updatedByName} ${verb} ${Math.abs(log.change)} × ${log.stockCode} (now ${log.newQty}).`
      });
    }

    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries;
  }, [order, allocations, assemblyLogs]);

  if (!order) return null;

  return (
    <PhaseDrawer
      open={!!order}
      onClose={onClose}
      title="Activity History"
      subtitle={`${order.schoolName} · ${order.orderNumber}`}
      icon={History}
    >
      {timeline.length === 0 ? (
        <p className="text-[11px] text-zinc-400 py-6 text-center">No allocation or assembly activity recorded yet for this order.</p>
      ) : (
        <div className="space-y-2">
          {timeline.map(entry => {
            const Icon = entry.icon;
            return (
              <div key={entry.key} className="flex items-start gap-2.5 bg-zinc-50 border border-zinc-150 rounded-xl p-3">
                <Icon className="w-3.5 h-3.5 text-brand-accent shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] text-zinc-700 leading-snug">{entry.text}</p>
                  <p className="text-[9px] font-mono text-zinc-400 mt-0.5">{formatTimestamp(entry.timestamp)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PhaseDrawer>
  );
}
