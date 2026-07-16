import { useMemo, useState } from 'react';
import {
  CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Clock,
  ClipboardList, LayoutGrid, Rows3, CalendarCheck2, Calendar as CalendarIcon
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { DayPlannerEntry } from '../../types';
import { DayPlannerEditor } from '../trips/TripListComponents/DayPlannerEditor';
import { ChangeDateDialogMobile } from '../trips/TripListComponents/ChangeDateDialogMobile';
import { MobileSheet } from '../../components/mobile/MobileSheet';

type ViewMode = 'month' | 'week' | 'day';

const DAY_ABBREVS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Mobile variant of DailyPlannerPage. The desktop 7-col month grid and
 * card-per-weekday week view both cram too much into a narrow viewport, so both
 * become a single-column accordion: one row per day (date + entry-count badge),
 * tap to expand an inline entries preview, tap the row's "Open" action (or the
 * day itself in Day view) to edit in a full MobileSheet wrapping the same
 * chrome-less DayPlannerEditor the desktop dialog uses. Day view is already a
 * single column, so it just reflows without needing the accordion treatment.
 */
export function DailyPlannerPageMobile({
  viewMode,
  setViewMode,
  currentDate,
  goToday,
  goPrev,
  goNext,
  headerLabel,
  loading,
  monthGridDays,
  weekDays,
  entriesByDate,
  isDayUsable,
  saveEntries,
  moveEntries,
  completedByName,
  toDateKey,
  parseDateKey,
}: {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  currentDate: Date;
  goToday: () => void;
  goPrev: () => void;
  goNext: () => void;
  headerLabel: string;
  loading: boolean;
  monthGridDays: Date[];
  weekDays: Date[];
  entriesByDate: Record<string, DayPlannerEntry[]>;
  isDayUsable: (dateKey: string) => boolean;
  saveEntries: (date: string, entries: DayPlannerEntry[]) => Promise<boolean>;
  moveEntries: (fromDate: string, toDate: string) => void;
  completedByName: string;
  toDateKey: (d: Date) => string;
  parseDateKey: (key: string) => Date;
}) {
  const [openDateKey, setOpenDateKey] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [showMovePicker, setShowMovePicker] = useState(false);

  const today = new Date();

  const dateLabel = (dateKey: string) => {
    const d = parseDateKey(dateKey);
    return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Month view only bothers showing days that already have real content (plus
  // "today") — 42 collapsed accordion rows for a mostly-empty month would just
  // be scroll-forever with no payoff on a phone.
  const visibleMonthDays = useMemo(() => {
    return monthGridDays.filter(d => {
      const key = toDateKey(d);
      const inCurrentMonth = d.getMonth() === currentDate.getMonth();
      return inCurrentMonth && (isSameDay(d, today) || isDayUsable(key));
    });
  }, [monthGridDays, currentDate, isDayUsable]);

  const renderDayRow = (d: Date, opts: { showMonth?: boolean } = {}) => {
    const dateKey = toDateKey(d);
    const isToday = isSameDay(d, today);
    const usable = isDayUsable(dateKey);
    const dayEntries = entriesByDate[dateKey] || [];
    const count = dayEntries.length;
    const completedCount = dayEntries.filter(e => e.completed).length;
    const allDone = count > 0 && completedCount === count;
    const isOpen = openDateKey === dateKey;

    return (
      <div key={dateKey} className="border border-zinc-100 rounded-xl overflow-hidden bg-white">
        <button
          type="button"
          title={isOpen ? `Collapse ${dateKey}` : `Expand ${dateKey}`}
          onClick={() => setOpenDateKey(isOpen ? null : dateKey)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 mobile-tap-target"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className={cn(
              "w-8 h-8 flex items-center justify-center rounded-full text-xs font-black shrink-0",
              isToday ? "bg-brand-primary text-white" : "bg-zinc-100 text-zinc-600"
            )}>
              {d.getDate()}
            </span>
            <div className="min-w-0 text-left">
              <p className="text-sm font-bold text-zinc-800 truncate">
                {DAY_NAMES[d.getDay()]}
                {opts.showMonth && ` · ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`}
              </p>
              {!usable && <p className="text-[10px] text-zinc-400 font-medium">No trip scheduled</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {count > 0 && (
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black",
                allDone ? "bg-emerald-100 text-emerald-700" : "bg-brand-accent/15 text-brand-accent"
              )}>
                <ClipboardList className="w-3 h-3" />
                {count}
              </span>
            )}
            <ChevronDown className={cn("w-4 h-4 text-zinc-400 transition-transform", isOpen && "rotate-180")} />
          </div>
        </button>

        {isOpen && (
          <div className="border-t border-zinc-100 p-3 space-y-2 bg-zinc-50/40">
            {dayEntries.length === 0 ? (
              <p className="text-xs text-zinc-400 italic px-1 py-1">No entries yet</p>
            ) : (
              dayEntries.map(entry => (
                <div key={entry.id} className="text-xs bg-white border border-zinc-100 rounded-lg px-3 py-2 flex items-start gap-2">
                  {entry.time && (
                    <span className="shrink-0 flex items-center gap-1 text-emerald-700 font-bold">
                      <Clock className="w-3 h-3" />
                      {entry.time}
                    </span>
                  )}
                  <span className={cn("flex-1 min-w-0 break-words", entry.completed ? "line-through text-zinc-400" : "text-zinc-700")}>
                    {entry.note}
                  </span>
                </div>
              ))
            )}
            <button
              type="button"
              disabled={!usable}
              title={usable ? `Open planner for ${dateKey}` : 'No trip scheduled for this day'}
              onClick={() => setSheetDate(dateKey)}
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-600 font-bold text-xs uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed mobile-tap-target"
            >
              {count > 0 ? 'View / Edit' : 'Add Entries'}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-black text-brand-primary tracking-tight uppercase flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-brand-accent" />
          Daily Planner
        </h1>
        <p className="text-zinc-500 text-xs mt-0.5">Browse and manage every day's plan across all your trips.</p>
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 bg-zinc-100 border border-zinc-200 rounded-xl p-1">
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
              "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg font-black text-[10px] uppercase tracking-wider transition-all mobile-tap-target",
              viewMode === mode ? "bg-white text-brand-primary shadow-sm" : "text-zinc-500"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Navigation bar */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-3 py-3 flex items-center justify-between gap-2">
        <button
          type="button"
          title={`Previous ${viewMode}`}
          onClick={goPrev}
          className="p-2 rounded-xl border border-zinc-200 text-zinc-500 mobile-tap-target"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center flex-1 min-w-0">
          <h2 className="text-xs font-black text-brand-primary uppercase tracking-tight text-center truncate w-full">
            {headerLabel}
          </h2>
          <button
            type="button"
            title="Jump to today"
            onClick={goToday}
            className="mt-1 px-2.5 py-1 rounded-lg text-zinc-500 font-bold text-[10px] uppercase tracking-wide mobile-tap-target"
          >
            Today
          </button>
        </div>
        <button
          type="button"
          title={`Next ${viewMode}`}
          onClick={goNext}
          className="p-2 rounded-xl border border-zinc-200 text-zinc-500 mobile-tap-target"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Loading planner...</p>
        </div>
      ) : viewMode === 'month' ? (
        <div className="space-y-2">
          {visibleMonthDays.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
              <CalendarDays className="w-9 h-9 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-bold text-sm uppercase tracking-tight">No Trips This Month</p>
              <p className="text-zinc-400 text-xs mt-1 max-w-xs mx-auto">
                Days only show up here once a trip is scheduled for them.
              </p>
            </div>
          ) : (
            visibleMonthDays.map(d => renderDayRow(d))
          )}
        </div>
      ) : viewMode === 'week' ? (
        <div className="space-y-2">
          {weekDays.map(d => renderDayRow(d))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-4">
          {isDayUsable(toDateKey(currentDate)) ? (
            <>
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  {entriesByDate[toDateKey(currentDate)]?.length ?? 0} entries
                </p>
                <button
                  type="button"
                  title="Move entries to a different date"
                  onClick={() => setShowMovePicker(true)}
                  className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20 mobile-tap-target"
                >
                  <CalendarIcon className="w-4 h-4 text-brand-primary" />
                </button>
              </div>
              <DayPlannerEditor
                key={toDateKey(currentDate)}
                entries={entriesByDate[toDateKey(currentDate)] || []}
                onSave={(entries) => saveEntries(toDateKey(currentDate), entries)}
                completedByName={completedByName}
              />
              {showMovePicker && (
                <ChangeDateDialogMobile
                  initialDate={toDateKey(currentDate)}
                  onClose={() => setShowMovePicker(false)}
                  onConfirm={(newDate) => moveEntries(toDateKey(currentDate), newDate)}
                />
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
              <CalendarDays className="w-9 h-9 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-bold text-sm uppercase tracking-tight">No Trip Scheduled</p>
              <p className="text-zinc-400 text-xs mt-1 max-w-xs mx-auto">
                Planners can only be created for days with at least one trip. Schedule a trip for this date from the Trips screen first.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Entry editor sheet, used from the Month/Week accordion rows */}
      <MobileSheet
        isOpen={sheetDate !== null}
        onClose={() => setSheetDate(null)}
        title="Day Planner"
        subtitle={sheetDate ? dateLabel(sheetDate) : undefined}
        headerLeft={
          sheetDate && (
            <button
              type="button"
              title="Move entries to a different date"
              onClick={() => setShowMovePicker(true)}
              className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20 mobile-tap-target shrink-0"
            >
              <CalendarIcon className="w-4 h-4 text-brand-primary" />
            </button>
          )
        }
      >
        {sheetDate && (
          <DayPlannerEditor
            key={sheetDate}
            entries={entriesByDate[sheetDate] || []}
            onSave={(entries) => saveEntries(sheetDate, entries)}
            completedByName={completedByName}
          />
        )}
      </MobileSheet>

      {sheetDate && showMovePicker && (
        <ChangeDateDialogMobile
          initialDate={sheetDate}
          onClose={() => setShowMovePicker(false)}
          onConfirm={(newDate) => {
            moveEntries(sheetDate, newDate);
            setSheetDate(newDate);
          }}
        />
      )}
    </div>
  );
}
