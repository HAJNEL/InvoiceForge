import { Fragment, useMemo, useState } from 'react';
import { X, ArrowLeft, Calendar, Truck as TruckIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Trip } from '../../../types';
import { UIDashboardInvoice } from '../useTeamDashboard';
import { startOfWeekMonday } from '../../reports/weeklyRevenue';

// Mirrors the status chip color scheme already used across the app (SelfInvoiceModal's
// renderStatusBadge, the Invoice Management view here) - shared color meaning for both
// trip and invoice statuses so the table stays visually consistent.
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
// week's year, so "Week 1" is always the week Jan 1 falls in - matching the
// Monday-Sunday grouping convention used everywhere else here.
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

// Groups trips into Monday-Sunday calendar weeks (same convention as the
// Reports weekly revenue chart), newest week first, trips within a week kept
// in whatever order they arrive in (already date-desc from useTeamDashboard).
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

interface TripOverviewTableProps {
  trips: Trip[];
  invoices: UIDashboardInvoice[];
}

export function TripOverviewTable({ trips, invoices }: TripOverviewTableProps) {
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<UIDashboardInvoice | null>(null);

  const weekGroups = useMemo(() => groupTripsByWeek(trips), [trips]);

  const getInvoicesForTrip = (trip: Trip) =>
    (trip.invoiceIds || [])
      .map(invId => invoices.find(inv => inv.id === invId))
      .filter((inv): inv is UIDashboardInvoice => Boolean(inv));

  if (trips.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-zinc-200 text-center space-y-3">
        <TruckIcon className="w-8 h-8 text-zinc-300 mx-auto" />
        <p className="text-xs font-bold text-zinc-700">No trips found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[480px]">
          <thead>
            <tr className="border-b border-zinc-150 text-[9px] uppercase tracking-widest font-black text-zinc-400 bg-zinc-50/50">
              <th className="py-3 px-4">Trip Date</th>
              <th className="py-3 px-4">Trip Status</th>
              <th className="py-3 px-4">Invoices</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {weekGroups.map(group => (
              <Fragment key={group.weekStart.toDateString()}>
                <tr className="bg-zinc-50/80">
                  <td colSpan={3} className="py-2 px-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Week {getWeekNumber(group.weekStart)} - {formatWeekLabel(group.weekStart)} · {group.trips.length} {group.trips.length === 1 ? 'trip' : 'trips'}
                  </td>
                </tr>
                {group.trips.map(trip => {
                  const tripInvoices = getInvoicesForTrip(trip);
                  return (
                    <tr
                      key={trip.id}
                      onClick={() => setSelectedTrip(trip)}
                      className="cursor-pointer hover:bg-zinc-50/70 transition-colors align-top"
                    >
                      <td className="py-3 px-4 text-xs font-bold text-zinc-800 whitespace-nowrap">{trip.date}</td>
                      <td className="py-3 px-4">
                        <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border inline-block whitespace-nowrap", statusChipClass(trip.status))}>
                          {trip.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {tripInvoices.length === 0 ? (
                            <span className="text-[10px] text-zinc-400 italic">No invoices</span>
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trip -> bundled invoices dialog */}
      {selectedTrip && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm"
          onClick={() => setSelectedTrip(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <div className="min-w-0">
                <h3 className="font-black text-sm text-zinc-900 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-brand-accent shrink-0" /> {selectedTrip.date}
                </h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 truncate">
                  {selectedTrip.name || 'Trip'} · {getInvoicesForTrip(selectedTrip).length} {getInvoicesForTrip(selectedTrip).length === 1 ? 'invoice' : 'invoices'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTrip(null)}
                title="Close"
                className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-2.5">
              {getInvoicesForTrip(selectedTrip).length === 0 ? (
                <p className="text-center text-zinc-400 text-xs py-8">No invoices on this trip.</p>
              ) : (
                getInvoicesForTrip(selectedTrip).map(inv => (
                  <button
                    key={inv.id}
                    type="button"
                    onClick={() => setSelectedInvoice(inv)}
                    className="w-full text-left flex items-center justify-between gap-2 p-3.5 border border-zinc-200 rounded-2xl hover:border-brand-accent hover:bg-zinc-50/50 transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-zinc-900 font-mono">#{inv.number}</p>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">{inv.client}</p>
                    </div>
                    <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0", statusChipClass(inv.status))}>
                      {inv.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice -> line items dialog, stacked above the trip dialog */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="text-[10px] font-bold text-zinc-400 hover:text-zinc-600 flex items-center gap-1 mb-1"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to trip invoices
                </button>
                <h3 className="font-black text-sm text-zinc-900 font-mono">#{selectedInvoice.number}</h3>
                <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{selectedInvoice.client}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                title="Close"
                className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              {selectedInvoice.lineItems.length === 0 ? (
                <p className="text-center text-zinc-400 text-xs py-8">No line items on this invoice.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-150 text-[9px] uppercase tracking-widest font-black text-zinc-400">
                      <th className="py-2 pr-2">Code</th>
                      <th className="py-2 pr-2">Description</th>
                      <th className="py-2 pr-2 text-right">Qty</th>
                      <th className="py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {selectedInvoice.lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-2 font-mono text-[10px] font-bold text-zinc-600 whitespace-nowrap">{item.stockCode || '—'}</td>
                        <td className="py-2 pr-2 text-zinc-700">{item.description}</td>
                        <td className="py-2 pr-2 text-right font-bold text-zinc-800 whitespace-nowrap">{item.qty}</td>
                        <td className="py-2 text-right font-mono text-zinc-600 whitespace-nowrap">R {item.value.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
