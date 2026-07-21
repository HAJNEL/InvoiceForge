import { Calendar, Clock, ClipboardList, Check } from 'lucide-react';
import { DayPlannerEntry } from '../../types';
import { cn } from '../../lib/utils';
import { MobileSheet } from '../../components/mobile/MobileSheet';

interface TodayPlannerDialogMobileProps {
  open: boolean;
  onClose: () => void;
  entries: DayPlannerEntry[];
  dateLabel: string;
  onToggle: (entryId: string) => void;
}

// Mobile counterpart of TodayPlannerDialog: same time-tagged entries with
// completion-tracking checkboxes, same handlers, presented as a full-screen
// MobileSheet instead of a centered dialog.
export function TodayPlannerDialogMobile({ open, onClose, entries, dateLabel, onToggle }: TodayPlannerDialogMobileProps) {
  return (
    <MobileSheet
      isOpen={open}
      onClose={onClose}
      title="Today's Plan"
      subtitle={dateLabel}
      headerLeft={
        <div className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20 shrink-0">
          <Calendar className="w-4 h-4 text-brand-primary" />
        </div>
      }
    >
      <div className="space-y-2.5">
        {entries.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-9 h-9 text-zinc-200 mx-auto mb-3" />
            <p className="text-zinc-500 font-bold text-sm">No Plan For Today</p>
            <p className="text-zinc-400 text-xs mt-1">Nothing has been scheduled for today yet.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 bg-zinc-50 border border-zinc-150 rounded-2xl p-3.5">
              <button
                type="button"
                title={entry.completed ? 'Mark as not completed' : 'Mark as completed'}
                onClick={() => onToggle(entry.id)}
                className={cn(
                  "w-6 h-6 mt-0.5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer mobile-tap-target",
                  entry.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-300 bg-white hover:border-emerald-400"
                )}
              >
                {entry.completed && <Check className="w-4 h-4 stroke-[3]" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {entry.time && (
                    <span className="shrink-0 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] font-black text-emerald-700 flex items-center gap-1 uppercase tracking-wider leading-none">
                      <Clock className="w-3 h-3" />
                      {entry.time}
                    </span>
                  )}
                  <p className={cn(
                    "text-sm font-medium break-words",
                    entry.completed ? "text-zinc-400 line-through" : "text-zinc-800"
                  )}>
                    {entry.note}
                  </p>
                </div>
                {entry.completed && entry.completedBy && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">Completed by {entry.completedBy}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </MobileSheet>
  );
}
