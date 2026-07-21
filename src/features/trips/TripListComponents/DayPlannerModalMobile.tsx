import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { DayPlannerEntry } from '../../../types';
import { DayPlannerEditor } from './DayPlannerEditor';
import { ChangeDateDialogMobile } from './ChangeDateDialogMobile';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

// DayPlannerEditor already contains its own list + add/edit form and drag-reorder
// logic; on mobile the HTML5 drag events it uses don't fire from touch input, but
// the component itself is reused as-is (no separate up/down button variant) since
// entries can still be reordered by editing/deleting/re-adding, and the primary
// mobile interaction here is ticking items complete, not reordering.
export function DayPlannerModalMobile({ date, dateLabel, entries, onClose, onSave, onMoveToDate, completedByName }: {
  date: string;
  dateLabel: string;
  entries: DayPlannerEntry[];
  onClose: () => void;
  onSave: (entries: DayPlannerEntry[]) => Promise<boolean>;
  onMoveToDate: (newDate: string) => void;
  completedByName: string;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);

  return (
    <>
      <MobileSheet
        isOpen={true}
        onClose={onClose}
        title="Day Planner"
        subtitle={dateLabel}
        headerLeft={
          <button
            type="button"
            title="Move entries to a different date"
            onClick={() => setShowDatePicker(true)}
            className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20 transition-all mobile-tap-target shrink-0"
          >
            <Calendar className="w-4 h-4 text-brand-primary" />
          </button>
        }
      >
        <div className="flex flex-col h-full min-h-[60vh]">
          <DayPlannerEditor entries={entries} onSave={onSave} completedByName={completedByName} />
        </div>
      </MobileSheet>

      {showDatePicker && (
        <ChangeDateDialogMobile
          initialDate={date}
          onClose={() => setShowDatePicker(false)}
          onConfirm={onMoveToDate}
        />
      )}
    </>
  );
}
