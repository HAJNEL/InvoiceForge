import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Truck as TruckIcon, Plus, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Truck } from '../../trucks/hooks/useTrucks';
import { Trip } from '../../../types';

interface WeekDay {
  dateString: string;
  label: string;
  dayName: string;
}

/**
 * Mobile variant of DispatchSchedule: instead of a truck x weekday grid (which
 * doesn't fit a narrow viewport), each truck is a collapsible accordion row.
 * Collapsed: name, plate, total-trips-this-week badge. Expanded: a vertical
 * Mon-Sun list, each day reusing the same getTripsForCell/onCellClick contract
 * as the desktop grid cells - zero data-layer changes.
 */
export function DispatchScheduleMobile({
  trucks,
  paginatedTrucks,
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
  // Only one truck's accordion body open at a time.
  const [openTruckId, setOpenTruckId] = useState<string | null>(null);

  const totalTripsForTruck = (truckId: string) =>
    weekDays.reduce((sum, day) => sum + getTripsForCell(truckId, day.dateString).length, 0);

  return (
    <div className="saas-card overflow-hidden">
      <div className="py-3 px-4 bg-[#e0f2f1]/50 border-b border-zinc-100 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#2d3748] tracking-tight flex-1 min-w-0 truncate">Weekly Dispatch</h2>
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black bg-white text-[#2a7a72] border border-[#b2dfdb] shadow-xs select-none shrink-0">
            <Calendar className="w-3 h-3 text-[#2a7a72]" />
            Wk {weekNumber}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Previous week"
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-600 active:scale-95 transition-all shadow-sm mobile-tap-target"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Jump to current week"
            onClick={() => setWeekOffset(0)}
            className={cn(
              "flex-1 px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all mobile-tap-target",
              weekOffset === 0
                ? "bg-brand-primary text-white"
                : "bg-white border border-zinc-200 text-zinc-650 shadow-sm"
            )}
          >
            Current Week
          </button>
          <button
            type="button"
            title="Next week"
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-1.5 bg-white border border-zinc-200 rounded-lg text-zinc-600 active:scale-95 transition-all shadow-sm mobile-tap-target"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3">
        {trucks.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
            <TruckIcon className="w-9 h-9 text-zinc-300 mb-3" />
            <p className="text-sm font-medium text-zinc-900">No trucks in fleet</p>
            <p className="text-xs text-zinc-500 mt-1 mb-5 px-4">Add vehicles to manage your weekly dispatch schedule.</p>
            <Link
              to="/trucks"
              className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest mobile-tap-target"
            >
              Add Truck
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {paginatedTrucks.map((truck) => {
                const isOpen = openTruckId === truck.id;
                const weeklyTotal = totalTripsForTruck(truck.id);
                return (
                  <div key={truck.id} className="border border-zinc-100 rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      title={isOpen ? `Collapse ${truck.name}` : `Expand ${truck.name}`}
                      onClick={() => setOpenTruckId(isOpen ? null : truck.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 mobile-tap-target"
                    >
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-bold text-zinc-800 truncate">{truck.name}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">{truck.licensePlate}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn(
                          "text-[10px] font-black px-2 py-1 rounded-full",
                          weeklyTotal > 0 ? "bg-brand-primary/10 text-brand-primary" : "bg-zinc-100 text-zinc-400"
                        )}>
                          {weeklyTotal} {weeklyTotal === 1 ? 'trip' : 'trips'}
                        </span>
                        <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", isOpen && "rotate-180")} />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-zinc-100 divide-y divide-zinc-50">
                        {weekDays.map((day, idx) => {
                          const cellTrips = getTripsForCell(truck.id, day.dateString);
                          const tripCount = cellTrips.length;
                          return (
                            <button
                              key={idx}
                              type="button"
                              title={`View trips for ${day.dayName}, ${day.label}`}
                              onClick={() => onCellClick({
                                dateString: day.dateString,
                                dayName: day.dayName,
                                truckId: truck.id
                              })}
                              className="w-full flex items-center justify-between gap-3 px-4 py-2.5 mobile-tap-target active:bg-zinc-50"
                            >
                              <div className="text-left">
                                <p className="text-xs font-bold text-zinc-700">{day.dayName}</p>
                                <p className="text-[10px] text-zinc-400 font-mono">{day.label}</p>
                              </div>
                              {tripCount > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-brand-primary bg-brand-primary/5 border border-brand-primary/20 rounded-lg px-2.5 py-1">
                                  {tripCount} {tripCount === 1 ? 'Trip' : 'Trips'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-300 border border-zinc-100 rounded-lg px-2.5 py-1">
                                  <Plus className="w-3 h-3" />
                                  Add
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {totalTrucksPages > 1 && (
              <div className="flex items-center justify-between px-1 py-3 border-t border-zinc-150 mt-3 bg-zinc-50/50 rounded-xl">
                <span className="text-[10px] text-zinc-500 font-medium px-2">
                  {((trucksPage - 1) * trucksPerPage) + 1}-{Math.min(trucksPage * trucksPerPage, trucks.length)} of {trucks.length}
                </span>
                <div className="flex gap-2 pr-1">
                  <button
                    type="button"
                    onClick={() => setTrucksPage(prev => Math.max(1, prev - 1))}
                    disabled={trucksPage === 1}
                    className="p-1.5 border border-zinc-250 bg-white rounded-lg disabled:opacity-40 text-zinc-700 transition mobile-tap-target"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrucksPage(prev => Math.min(totalTrucksPages, prev + 1))}
                    disabled={trucksPage === totalTrucksPages}
                    className="p-1.5 border border-zinc-250 bg-white rounded-lg disabled:opacity-40 text-zinc-700 transition mobile-tap-target"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            <p className="mt-3 text-[9px] font-bold uppercase tracking-widest text-zinc-400 text-center">
              Tap a truck to expand, then tap a day to view or schedule trips
            </p>
          </>
        )}
      </div>
    </div>
  );
}
