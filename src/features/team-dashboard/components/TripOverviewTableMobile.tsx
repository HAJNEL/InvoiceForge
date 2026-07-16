import { useMemo, useState } from 'react';
import { Calendar, Truck as TruckIcon, FileText } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Trip } from '../../../types';
import { UIDashboardInvoice } from '../useTeamDashboard';
import { startOfWeekMonday } from '../../reports/weeklyRevenue';
import { MobileCard } from '../../../components/mobile/MobileCard';
import { MobileLineItemRow } from '../../../components/mobile/MobileLineItemRow';
import { MobileNavStack, useNavStack } from '../../../components/mobile/MobileNavStack';

// Mirrors the status chip color scheme used across the app (also duplicated in
// the desktop TripOverviewTable) so trip/invoice statuses stay visually consistent.
function statusChipClass(status: string): string {
  const norm = (status || '').toLowerCase();
  if (['delivered', 'invoiced', 'complete', 'completed'].includes(norm)) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (['on_route', 'on-route', 'partially-completed', 'partially_complete'].includes(norm)) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (norm === 'assembled') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (norm === 'proposed') return 'bg-violet-50 text-violet-700 border-violet-200';
  return 'bg-zinc-100 text-zinc-500 border-zinc-200';
}

// trip.date is stored as a plain "YYYY-MM-DD" string everywhere else in the app -
// parse it as local components (not new Date(str)) to avoid the classic UTC
// timezone shift that can bump a date into the wrong day/week.
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return new Date(dateStr);
  return new Date(y, m - 1, d);
}

function formatWeekLabel(weekStart: Date): string {
  return weekStart.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Week number relative to the Monday-aligned week containing Jan 1 of that
// week's year — matches the desktop TripOverviewTable's convention exactly.
function getWeekNumber(weekStart: Date): number {
  const jan1 = new Date(weekStart.getFullYear(), 0, 1);
  const firstWeekStart = startOfWeekMonday(jan1);
  const diffDays = Math.round((weekStart.getTime() - firstWeekStart.getTime()) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

interface TripWeekGroup {
  weekStart: Date;
  trips: Trip[];
}

// Groups trips into Monday-Sunday calendar weeks, newest week first, trips
// within a week kept in whatever order they arrive in (already date-desc).
function groupTripsByWeek(trips: Trip[]): TripWeekGroup[] {
  const byKey = new Map<string, TripWeekGroup>();
  trips.forEach(trip => {
    const weekStart = startOfWeekMonday(parseLocalDate(trip.date));
    const key = weekStart.toDateString();
    const existing = byKey.get(key);
    if (existing) {
      existing.trips.push(trip);
    } else {
      byKey.set(key, { weekStart, trips: [trip] });
    }
  });
  return Array.from(byKey.values()).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
}

interface TripOverviewTableMobileProps {
  trips: Trip[];
  invoices: UIDashboardInvoice[];
}

/**
 * Mobile counterpart of TripOverviewTable. Formalizes the desktop's two
 * stacked centered dialogs (trip -> invoice) into a true 3-level drill-down
 * using MobileNavStack: root = trip list grouped by week, push 1 = invoices
 * on the tapped trip, push 2 = line items on the tapped invoice.
 */
export function TripOverviewTableMobile({ trips, invoices }: TripOverviewTableMobileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { stack, push, pop, reset } = useNavStack();

  const weekGroups = useMemo(() => groupTripsByWeek(trips), [trips]);

  const getInvoicesForTrip = (trip: Trip) =>
    (trip.invoiceIds || [])
      .map(invId => invoices.find(inv => inv.id === invId))
      .filter((inv): inv is UIDashboardInvoice => Boolean(inv));

  const openInvoiceLineItems = (inv: UIDashboardInvoice) => {
    push({
      title: `#${inv.number}`,
      subtitle: inv.client,
      content: (
        <div className="space-y-2">
          {inv.lineItems.length === 0 ? (
            <p className="text-center text-zinc-400 text-xs py-8">No line items on this invoice.</p>
          ) : (
            inv.lineItems.map((item, idx) => (
              <MobileLineItemRow key={idx} item={item} />
            ))
          )}
        </div>
      ),
    });
  };

  const openTripInvoices = (trip: Trip) => {
    const tripInvoices = getInvoicesForTrip(trip);
    push({
      title: trip.name || 'Trip',
      subtitle: `${trip.date} · ${tripInvoices.length} ${tripInvoices.length === 1 ? 'invoice' : 'invoices'}`,
      content: (
        <div className="space-y-2.5">
          {tripInvoices.length === 0 ? (
            <p className="text-center text-zinc-400 text-xs py-8">No invoices on this trip.</p>
          ) : (
            tripInvoices.map(inv => (
              <MobileCard key={inv.id} onClick={() => openInvoiceLineItems(inv)}>
                <MobileCard.Primary>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-zinc-900 font-mono flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      #{inv.number}
                    </p>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">{inv.client}</p>
                  </div>
                  <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0", statusChipClass(inv.status))}>
                    {inv.status}
                  </span>
                </MobileCard.Primary>
              </MobileCard>
            ))
          )}
        </div>
      ),
    });
  };

  if (trips.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-zinc-200 text-center space-y-3">
        <TruckIcon className="w-8 h-8 text-zinc-300 mx-auto" />
        <p className="text-xs font-bold text-zinc-700">No trips found</p>
      </div>
    );
  }

  const rootFrame = {
    title: 'Trip Overview',
    subtitle: `${trips.length} ${trips.length === 1 ? 'trip' : 'trips'}`,
    content: (
      <div className="space-y-5">
        {weekGroups.map(group => (
          <div key={group.weekStart.toDateString()} className="space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-1">
              Week {getWeekNumber(group.weekStart)} · {formatWeekLabel(group.weekStart)} · {group.trips.length} {group.trips.length === 1 ? 'trip' : 'trips'}
            </p>
            <div className="space-y-2.5">
              {group.trips.map(trip => {
                const tripInvoices = getInvoicesForTrip(trip);
                return (
                  <MobileCard key={trip.id} onClick={() => openTripInvoices(trip)}>
                    <MobileCard.Primary>
                      <div className="min-w-0">
                        <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          {trip.date}
                        </p>
                        <p className="text-xs font-black text-zinc-900 truncate mt-0.5 capitalize">{trip.name}</p>
                      </div>
                      <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0", statusChipClass(trip.status))}>
                        {trip.status}
                      </span>
                    </MobileCard.Primary>
                    <MobileCard.Secondary>
                      {tripInvoices.length === 0 ? (
                        <span className="italic text-zinc-300">No invoices</span>
                      ) : (
                        tripInvoices.map(inv => (
                          <span
                            key={inv.id}
                            className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border whitespace-nowrap", statusChipClass(inv.status))}
                          >
                            #{inv.number}
                          </span>
                        ))
                      )}
                    </MobileCard.Secondary>
                  </MobileCard>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    ),
  };

  return (
    <>
      <button
        type="button"
        title="Open trip overview"
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-zinc-200 shadow-sm mobile-tap-target"
      >
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-zinc-800">
          <TruckIcon className="w-4 h-4 text-rose-500" />
          View Trip Overview
        </span>
        <span className="text-[10px] font-mono font-bold text-zinc-400">{trips.length} trips</span>
      </button>

      <MobileNavStack
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); reset(); }}
        root={rootFrame}
        stack={stack}
        onPop={pop}
      />
    </>
  );
}
