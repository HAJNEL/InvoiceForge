import { useState } from 'react';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

export function ChangeDateDialogMobile({ initialDate, onClose, onConfirm }: {
  initialDate: string;
  onClose: () => void;
  onConfirm: (newDate: string) => void;
}) {
  const [date, setDate] = useState(initialDate);

  const handleConfirm = () => {
    if (!date || date === initialDate) return;
    onConfirm(date);
    onClose();
  };

  return (
    <MobileSheet
      isOpen={true}
      onClose={onClose}
      title="Move Entries"
      fullHeight={false}
      footer={
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Cancel"
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-zinc-200 text-zinc-650 font-extrabold text-xs uppercase tracking-wider rounded-xl mobile-tap-target"
          >
            Cancel
          </button>
          <button
            type="button"
            title="Move all entries to the selected date"
            onClick={handleConfirm}
            disabled={!date || date === initialDate}
            className="flex-1 px-4 py-3 bg-brand-primary text-white rounded-xl font-black text-xs uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
          >
            Move
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-zinc-500">
          All entries in this planner will be moved to the date you pick here.
        </p>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Move To Date</label>
          <input
            type="date"
            title="Select the date to move all entries to"
            autoFocus
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
          />
        </div>
      </div>
    </MobileSheet>
  );
}
