import { useState } from 'react';
import { X, Calendar as CalendarIcon } from 'lucide-react';

export function ChangeDateDialog({ initialDate, onClose, onConfirm }: {
  initialDate: string;
  onClose: () => void;
  onConfirm: (newDate: string) => void;
}) {
  const [date, setDate] = useState(initialDate);

  const handleConfirm = () => {
    if (!date) return;
    onConfirm(date);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
              <CalendarIcon className="w-4 h-4 text-brand-primary" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">Change Date</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
            <input
              type="date"
              title="Select date"
              autoFocus
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleConfirm();
                }
              }}
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              title="Cancel"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              title="Go to date"
              onClick={handleConfirm}
              disabled={!date}
              className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
