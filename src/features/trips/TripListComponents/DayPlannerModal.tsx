import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { DayPlannerEntry } from '../../../types';
import { DayPlannerEditor } from './DayPlannerEditor';
import { ChangeDateDialog } from './ChangeDateDialog';

export function DayPlannerModal({ date, dateLabel, entries, onClose, onSave, onMoveToDate, completedByName }: {
  date: string;
  dateLabel: string;
  entries: DayPlannerEntry[];
  onClose: () => void;
  onSave: (entries: DayPlannerEntry[]) => Promise<boolean>;
  // Moves all entries currently shown here to a different date (does not just
  // change which date's planner is being viewed).
  onMoveToDate: (newDate: string) => void;
  completedByName: string;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              title="Move entries to a different date"
              onClick={() => setShowDatePicker(true)}
              className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20 hover:bg-brand-primary/20 transition-all cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-brand-primary" />
            </button>
            <div>
              <h3 className="text-lg font-black text-brand-primary uppercase tracking-tight">Day Planner</h3>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-0.5">{dateLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-hidden flex-1 flex flex-col">
          <DayPlannerEditor entries={entries} onSave={onSave} completedByName={completedByName} />
        </div>
      </div>

      {showDatePicker && (
        <ChangeDateDialog
          initialDate={date}
          onClose={() => setShowDatePicker(false)}
          onConfirm={onMoveToDate}
        />
      )}
    </div>
  );
}
