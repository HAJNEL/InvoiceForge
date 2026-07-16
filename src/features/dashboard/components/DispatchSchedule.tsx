import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Truck as TruckIcon, Plus, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn, formatCurrency } from '../../../lib/utils';
import { Truck } from '../../trucks/hooks/useTrucks';
import { Trip } from '../../../types';
import { UIInvoice } from '../../invoices/hooks/useInvoices';

interface WeekDay {
  dateString: string;
  label: string;
  dayName: string;
}

export function DispatchSchedule({
  trucks,
  paginatedTrucks,
  invoices,
  weekDays,
  weekNumber,
  weekOffset,
  setWeekOffset,
  trucksPage,
  setTrucksPage,
  totalTrucksPages,
  trucksPerPage,
  getTripsForCell,
  onCellClick
}: {
  trucks: Truck[];
  paginatedTrucks: Truck[];
  invoices: UIInvoice[];
  weekDays: WeekDay[];
  weekNumber: number;
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  trucksPage: number;
  setTrucksPage: React.Dispatch<React.SetStateAction<number>>;
  totalTrucksPages: number;
  trucksPerPage: number;
  getTripsForCell: (truckId: string, dateString: string) => Trip[];
  onCellClick: (info: { dateString: string; dayName: string; truckId: string }) => void;
}) {
  // Collapsed by default; toggled via the "Daily Totals" row header cell.
  const [showDailyTotals, setShowDailyTotals] = useState(false);

  // Sums every trip's invoice value (across the full fleet, not just the paginated page)
  // for a given day, so the totals row reflects the whole week regardless of pagination.
  const invoiceAmountById = useMemo(() => new Map(invoices.map(i => [i.id, i.amount || 0])), [invoices]);
  const dayTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const day of weekDays) {
      let total = 0;
      for (const truck of trucks) {
        for (const trip of getTripsForCell(truck.id, day.dateString)) {
          total += (trip.invoiceIds || []).reduce((sum, id) => sum + (invoiceAmountById.get(id) || 0), 0);
        }
      }
      totals.set(day.dateString, total);
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekDays, trucks, invoiceAmountById]);
  return (
    <div className="saas-card overflow-hidden">
      <div className="bg-[#e0f2f1]/50 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <h2 className="text-xl font-bold text-[#2d3748] tracking-tight">Weekly Dispatch Schedule</h2>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-white text-[#2a7a72] border border-[#b2dfdb] shadow-xs select-none transition-all">
            <Calendar className="w-3.5 h-3.5 text-[#2a7a72]" />
            Week {weekNumber}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="px-3 py-1 bg-white border border-zinc-200 text-xs font-bold rounded-lg text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            ← Prev Week
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className={cn(
              "px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
              weekOffset === 0
                ? "bg-brand-primary text-white"
                : "bg-white border border-zinc-200 text-zinc-650 hover:bg-zinc-50 shadow-sm"
            )}
          >
            Current
          </button>
          <button
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="px-3 py-1 bg-white border border-zinc-200 text-xs font-bold rounded-lg text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            Next Week →
          </button>
        </div>
      </div>
      <div className="p-6 overflow-x-auto">
        {trucks.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <TruckIcon className="w-10 h-10 text-zinc-300 mb-4" />
            <p className="text-sm font-medium text-zinc-900">No trucks in fleet</p>
            <p className="text-xs text-zinc-500 mt-1 mb-6">Add vehicles to manage your weekly dispatch schedule.</p>
            <Link
              to="/trucks"
              className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all"
            >
              Add Truck
            </Link>
          </div>
        ) : (
          <>
            <table className="w-full min-w-[600px] border-collapse relative">
              <thead>
                <tr>
                  <th className="w-40 bg-zinc-50/70 border border-zinc-100 py-2 px-4 text-left">
                    <button
                      type="button"
                      title={showDailyTotals ? 'Collapse daily totals' : 'Expand daily totals'}
                      onClick={() => setShowDailyTotals(prev => !prev)}
                      className="flex items-center gap-1.5 text-[10px] font-black text-zinc-500 uppercase tracking-widest hover:text-zinc-700 transition-colors cursor-pointer"
                    >
                      <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", !showDailyTotals && "-rotate-90")} />
                      Daily Totals
                    </button>
                  </th>
                  {weekDays.map((day, idx) => (
                    <th key={idx} className="bg-zinc-50/70 border border-zinc-100 py-2 px-1 text-center font-normal">
                      {showDailyTotals && (
                        <span className="text-[11px] font-black text-brand-primary tabular-nums">
                          R {formatCurrency(dayTotals.get(day.dateString) || 0)}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="w-40 bg-zinc-50 border border-zinc-100 py-4 px-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Truck Name</th>
                  {weekDays.map((day, idx) => (
                    <th key={idx} className="bg-zinc-50 border border-zinc-100 py-3 text-center min-w-[80px]">
                      <div className="text-xs font-black text-zinc-600">{day.dayName.substring(0, 3).toUpperCase()}</div>
                      <div className="text-[9px] font-bold text-zinc-400 font-mono mt-0.5">{day.label}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedTrucks.map((truck) => (
                  <tr key={truck.id}>
                    <td className="bg-white border border-zinc-100 py-4 px-4 text-xs font-bold text-zinc-700">
                      {truck.name}
                      <p className="text-[10px] text-zinc-400 font-mono font-normal">{truck.licensePlate}</p>
                    </td>
                    {weekDays.map((day, colIdx) => {
                      const cellTrips = getTripsForCell(truck.id, day.dateString);
                      const tripCount = cellTrips.length;

                      return (
                        <td key={colIdx} className="border border-zinc-100 p-2">
                          <div
                            onClick={() => onCellClick({
                              dateString: day.dateString,
                              dayName: day.dayName,
                              truckId: truck.id
                            })}
                            className={cn(
                              "aspect-[4/3] w-full rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer",
                              tripCount > 0
                                ? "bg-brand-primary/5 border-brand-primary/20 hover:bg-brand-primary hover:border-brand-primary hover:shadow-lg hover:shadow-brand-primary/20 group"
                                : "bg-zinc-50/50 border-zinc-100 opacity-60 hover:opacity-100 hover:border-zinc-300 hover:bg-white"
                            )}
                          >
                            {tripCount > 0 ? (
                              <>
                                <span className="text-sm font-black text-brand-primary group-hover:text-white">{tripCount}</span>
                                <span className="text-[8px] font-bold uppercase tracking-tighter text-brand-primary/60 group-hover:text-white/80">
                                  {tripCount === 1 ? 'Trip' : 'Trips'}
                                </span>
                              </>
                            ) : (
                              <Plus className="w-3.5 h-3.5 text-zinc-300 transition-colors" />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {totalTrucksPages > 1 && (
              <div className="flex items-center justify-between px-2 py-3 border-t border-zinc-150 mt-4 bg-zinc-50/50 rounded-xl">
                <span className="text-xs text-zinc-500 font-medium">
                  Showing <span className="font-bold text-zinc-800">{((trucksPage - 1) * trucksPerPage) + 1}</span> to <span className="font-bold text-zinc-800">{Math.min(trucksPage * trucksPerPage, trucks.length)}</span> of <span className="font-bold text-zinc-800">{trucks.length}</span> trucks
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTrucksPage(prev => Math.max(1, prev - 1))}
                    disabled={trucksPage === 1}
                    className="p-1 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalTrucksPages }).map((_, i) => {
                      const pNum = i + 1;
                      return (
                        <button
                          key={pNum}
                          onClick={() => setTrucksPage(pNum)}
                          className={cn(
                            "w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg border transition",
                            trucksPage === pNum
                              ? "bg-brand-primary border-brand-primary text-white"
                              : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                          )}
                        >
                          {pNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setTrucksPage(prev => Math.min(totalTrucksPages, prev + 1))}
                    disabled={trucksPage === totalTrucksPages}
                    className="p-1 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              <p>Click on grid cells to view, change, or schedule trips on that day</p>
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-brand-primary"></div> Scheduled Trips</span>
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-zinc-200"></div> No Trips</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
