import { useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock,
  ClipboardList, LayoutGrid, Rows3, CalendarCheck2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../core/hooks/useAuth';
import { useTrips } from '../trips/hooks/useTrips';
import { useDayPlanners } from '../trips/hooks/useDayPlanners';
import { DayPlannerModal } from '../trips/TripListComponents/DayPlannerModal';
import { DayPlannerEditor } from '../trips/TripListComponents/DayPlannerEditor';
import { useIsMobile } from '../../hooks/useIsMobile';
import { DailyPlannerPageMobile } from './DailyPlannerPageMobile';

type ViewMode = 'month' | 'week' | 'day';

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Local (not UTC) "YYYY-MM-DD" - matches how Trip.date is stored/parsed everywhere
// else in this codebase, avoiding the classic toISOString() timezone-shift bug.
function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

export function DailyPlannerPage() {
  const { user } = useAuth();
  const { trips, loading: tripsLoading } = useTrips();
  const { planners, loading: plannersLoading, saveEntries, moveEntries } = useDayPlanners();
  // Recorded on planner entries when the account owner ticks them, so it's clear who
  // completed it even when that's the owner themselves (not just team members).
  const ownerDisplayName = user?.displayName || user?.email?.split('@')[0] || 'Account Owner';

  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modalDate, setModalDate] = useState<string | null>(null);

  const today = new Date();

  const entriesByDate = useMemo(() => {
    const map: Record<string, typeof planners[number]['entries']> = {};
    planners.forEach(p => {
      map[p.date] = p.entries;
    });
    return map;
  }, [planners]);

  const tripDatesSet = useMemo(() => new Set(trips.map(t => t.date)), [trips]);

  const isDayUsable = (dateKey: string) => tripDatesSet.has(dateKey) || (entriesByDate[dateKey]?.length ?? 0) > 0;

  const goToday = () => setCurrentDate(new Date());

  const goPrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => addDays(prev, -7));
    } else {
      setCurrentDate(prev => addDays(prev, -1));
    }
  };

  const goNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(prev => addDays(prev, 7));
    } else {
      setCurrentDate(prev => addDays(prev, 1));
    }
  };

  const headerLabel = useMemo(() => {
    if (viewMode === 'month') {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate);
      const end = addDays(start, 6);
      const sameMonth = start.getMonth() === end.getMonth();
      const startLabel = `${MONTH_NAMES[start.getMonth()].slice(0, 3)} ${start.getDate()}`;
      const endLabel = sameMonth ? `${end.getDate()}` : `${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getDate()}`;
      return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
    }
    return `${DAY_NAMES[currentDate.getDay()]}, ${currentDate.getDate()} ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [viewMode, currentDate]);

  // 6 full weeks (42 days) starting from the Sunday on/before the 1st, so the grid
  // never reflows between 4/5/6-row months.
  const monthGridDays = useMemo(() => {
    const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const gridStart = startOfWeek(firstOfMonth);
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const loading = tripsLoading || plannersLoading;

  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <DailyPlannerPageMobile
        viewMode={viewMode}
        setViewMode={setViewMode}
        currentDate={currentDate}
        goToday={goToday}
        goPrev={goPrev}
        goNext={goNext}
        headerLabel={headerLabel}
        loading={loading}
        monthGridDays={monthGridDays}
        weekDays={weekDays}
        entriesByDate={entriesByDate}
        isDayUsable={isDayUsable}
        saveEntries={saveEntries}
        moveEntries={moveEntries}
        completedByName={ownerDisplayName}
        toDateKey={toDateKey}
        parseDateKey={parseDateKey}
      />
    );
  }

  const renderDot = (dateKey: string) => {
    const count = entriesByDate[dateKey]?.length ?? 0;
    if (count === 0) return null;
    const completedCount = entriesByDate[dateKey]?.filter(e => e.completed).length ?? 0;
    const allDone = completedCount === count;
    return (
      <span className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black leading-none",
        allDone ? "bg-emerald-100 text-emerald-700" : "bg-brand-accent/15 text-brand-accent"
      )}>
        <ClipboardList className="w-2.5 h-2.5" />
        {count}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-brand-primary tracking-tight uppercase flex items-center gap-3">
            <CalendarDays className="w-6 h-6 text-brand-accent" />
            Daily Planner
          </h1>
          <p className="text-zinc-500 text-sm">Browse and manage every day's plan across all your trips.</p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-zinc-100 border border-zinc-200 rounded-xl p-1 w-fit">
          {([
            { mode: 'month' as ViewMode, label: 'Month', icon: LayoutGrid },
            { mode: 'week' as ViewMode, label: 'Week', icon: Rows3 },
            { mode: 'day' as ViewMode, label: 'Day', icon: CalendarCheck2 },
          ]).map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              title={`${label} view`}
              onClick={() => setViewMode(mode)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-wider transition-all",
                viewMode === mode ? "bg-white text-brand-primary shadow-sm" : "text-zinc-500 hover:text-zinc-700"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation bar */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-5 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title={`Previous ${viewMode}`}
            onClick={goPrev}
            className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-brand-primary transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Jump to today"
            onClick={goToday}
            className="px-3 py-2 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-brand-primary transition-all font-bold text-xs uppercase tracking-wide"
          >
            Today
          </button>
          <button
            type="button"
            title={`Next ${viewMode}`}
            onClick={goNext}
            className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-brand-primary transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <h2 className="text-sm font-black text-brand-primary uppercase tracking-tight text-center flex-1">
          {headerLabel}
        </h2>
        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">
          <span className="w-2 h-2 rounded-full bg-brand-accent/60" />
          Has Plan
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Loading planner...</p>
        </div>
      ) : viewMode === 'month' ? (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/50">
            {DAY_ABBREVS.map(d => (
              <div key={d} className="py-2.5 text-center text-[10px] font-black uppercase tracking-widest text-zinc-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGridDays.map((d) => {
              const dateKey = toDateKey(d);
              const inCurrentMonth = d.getMonth() === currentDate.getMonth();
              const isToday = isSameDay(d, today);
              const usable = isDayUsable(dateKey);

              return (
                <button
                  key={dateKey}
                  type="button"
                  disabled={!usable}
                  title={usable ? `Open planner for ${dateKey}` : 'No trip scheduled for this day'}
                  onClick={() => setModalDate(dateKey)}
                  className={cn(
                    "min-h-[92px] border-b border-r border-zinc-100 p-2 flex flex-col items-start gap-1.5 text-left transition-all relative",
                    inCurrentMonth ? "bg-white" : "bg-zinc-50/40",
                    usable ? "hover:bg-brand-accent/5 cursor-pointer" : "cursor-not-allowed",
                  )}
                >
                  <span className={cn(
                    "w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0",
                    isToday ? "bg-brand-primary text-white" : inCurrentMonth ? "text-zinc-700" : "text-zinc-300",
                  )}>
                    {d.getDate()}
                  </span>
                  {renderDot(dateKey)}
                </button>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
          {weekDays.map((d) => {
            const dateKey = toDateKey(d);
            const isToday = isSameDay(d, today);
            const usable = isDayUsable(dateKey);
            const dayEntries = entriesByDate[dateKey] || [];

            return (
              <div
                key={dateKey}
                className={cn(
                  "bg-white rounded-2xl border shadow-sm flex flex-col min-h-[220px]",
                  isToday ? "border-brand-primary/40 ring-1 ring-brand-primary/20" : "border-zinc-200"
                )}
              >
                <div className="px-3.5 py-3 border-b border-zinc-100 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{DAY_ABBREVS[d.getDay()]}</p>
                    <p className={cn("text-sm font-black", isToday ? "text-brand-primary" : "text-zinc-800")}>{d.getDate()}</p>
                  </div>
                  {renderDot(dateKey)}
                </div>

                <div className="p-2.5 flex-1 space-y-1.5 overflow-y-auto max-h-[200px]">
                  {dayEntries.length === 0 ? (
                    <p className="text-[11px] text-zinc-350 italic px-1 py-2">No entries</p>
                  ) : (
                    dayEntries.map(entry => (
                      <div key={entry.id} className="text-[11px] bg-zinc-50 border border-zinc-100 rounded-lg px-2 py-1.5 flex items-start gap-1.5">
                        {entry.time && (
                          <span className="shrink-0 flex items-center gap-0.5 text-emerald-700 font-bold">
                            <Clock className="w-2.5 h-2.5" />
                            {entry.time}
                          </span>
                        )}
                        <span className={cn("truncate", entry.completed ? "line-through text-zinc-400" : "text-zinc-700")}>
                          {entry.note}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <button
                  type="button"
                  disabled={!usable}
                  title={usable ? 'View / add entries' : 'No trip scheduled for this day'}
                  onClick={() => setModalDate(dateKey)}
                  className="m-2.5 mt-0 px-3 py-1.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-brand-primary transition-all font-bold text-[10px] uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-zinc-600"
                >
                  {dayEntries.length > 0 ? 'View / Edit' : 'Add Entries'}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6">
          {isDayUsable(toDateKey(currentDate)) ? (
            <div className="h-[520px]">
              <DayPlannerEditor
                key={toDateKey(currentDate)}
                entries={entriesByDate[toDateKey(currentDate)] || []}
                onSave={(entries) => saveEntries(toDateKey(currentDate), entries)}
                completedByName={ownerDisplayName}
              />
            </div>
          ) : (
            <div className="text-center py-16 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
              <CalendarDays className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-bold text-sm uppercase tracking-tight">No Trip Scheduled</p>
              <p className="text-zinc-400 text-xs mt-1 max-w-sm mx-auto">
                Planners can only be created for days with at least one trip. Schedule a trip for this date from the Trips screen first.
              </p>
            </div>
          )}
        </div>
      )}

      {modalDate && (
        <DayPlannerModal
          key={modalDate}
          date={modalDate}
          dateLabel={(() => {
            const d = parseDateKey(modalDate);
            return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
          })()}
          entries={entriesByDate[modalDate] || []}
          onClose={() => setModalDate(null)}
          onSave={(entries) => saveEntries(modalDate, entries)}
          onMoveToDate={(newDate) => {
            moveEntries(modalDate, newDate);
            setModalDate(newDate);
          }}
          completedByName={ownerDisplayName}
        />
      )}
    </div>
  );
}
