import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';
import { TimeAttendanceSettings } from '../../../types';
import { getPeriodRange } from '../utils';

export function PeriodStepper({ payInterval, weekStartDay, offset, onOffsetChange }: {
  payInterval: TimeAttendanceSettings['payInterval'];
  weekStartDay: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
}) {
  const period = getPeriodRange(payInterval, weekStartDay, new Date(), offset);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        title="Previous period"
        onClick={() => onOffsetChange(offset - 1)}
        className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-all shadow-2xs cursor-pointer"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 bg-white min-w-[190px] justify-center">
        <CalendarRange className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
        <span className="text-xs font-black text-zinc-800 whitespace-nowrap">{period.label}</span>
      </div>
      <button
        type="button"
        title="Next period"
        onClick={() => onOffsetChange(offset + 1)}
        className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-all shadow-2xs cursor-pointer"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      {offset !== 0 && (
        <button
          type="button"
          title="Jump to current period"
          onClick={() => onOffsetChange(0)}
          className="px-3 py-2 text-[10px] font-bold text-brand-accent hover:bg-brand-accent/5 rounded-xl transition-colors cursor-pointer"
        >
          Today
        </button>
      )}
    </div>
  );
}
