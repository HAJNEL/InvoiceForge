import { Calendar, X, Clock, ClipboardList, Check } from 'lucide-react';
import { DayPlannerEntry } from '../../types';
import { cn } from '../../lib/utils';

interface TodayPlannerDialogProps {
  open: boolean;
  onClose: () => void;
  entries: DayPlannerEntry[];
  dateLabel: string;
  onToggle: (entryId: string) => void;
}

// View for team members: shows just today's plan entries, in the exact order the
// owner arranged them (array order === drag order). Team members can tick/untick
// entries as completed, but can't add, edit, delete, or reorder them here.
export function TodayPlannerDialog({ open, onClose, entries, dateLabel, onToggle }: TodayPlannerDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] flex flex-col border border-zinc-200 shadow-2xl animate-scale-up text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
              <Calendar className="w-4 h-4 text-brand-primary" />
            </div>
            <div>
              <h3 className="font-black text-sm text-zinc-900 uppercase tracking-tight">Today's Plan</h3>
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">{dateLabel}</p>
            </div>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 text-zinc-400 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-2.5 flex-1">
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
                    "w-5 h-5 mt-0.5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer",
                    entry.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-300 bg-white hover:border-emerald-400"
                  )}
                >
                  {entry.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
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
      </div>
    </div>
  );
}
