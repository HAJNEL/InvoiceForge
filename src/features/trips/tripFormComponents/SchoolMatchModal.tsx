import { useEffect, useState } from 'react';
import { X, School, CheckCircle2 } from 'lucide-react';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { STATUS_DISPLAY_MAP } from '../../dashboard/constants';

interface SchoolMatchModalProps {
  isOpen: boolean;
  schoolName: string;
  candidates: UIInvoice[];
  onConfirm: (selectedIds: string[]) => void;
  onClose: () => void;
}

// Prompts the user, right after adding an invoice to a trip, to also bundle
// in any other still-open invoices for the same school so they don't end up
// scattered across separate trips.
export function SchoolMatchModal({ isOpen, schoolName, candidates, onConfirm, onClose }: SchoolMatchModalProps) {
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // Default every candidate to selected each time the dialog opens.
  useEffect(() => {
    if (isOpen) {
      const next: Record<string, boolean> = {};
      candidates.forEach(inv => { next[inv.id] = true; });
      setSelected(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedIds = candidates.filter(inv => selected[inv.id]).map(inv => inv.id);
  const allSelected = candidates.length > 0 && selectedIds.length === candidates.length;

  const toggleAll = () => {
    const next: Record<string, boolean> = {};
    if (!allSelected) candidates.forEach(inv => { next[inv.id] = true; });
    setSelected(next);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] text-zinc-900 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-zinc-200 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50 shrink-0">
          <div className="min-w-0">
            <h3 className="font-sans font-black text-xs uppercase tracking-wider text-brand-primary flex items-center gap-1.5">
              <School className="w-3.5 h-3.5 shrink-0" />
              Other Invoices For This School
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase truncate">{schoolName}</p>
          </div>
          <button
            type="button"
            title="Close without adding more invoices"
            onClick={onClose}
            className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs text-left overflow-y-auto">
          <p className="text-zinc-500 leading-relaxed">
            These invoices are also for <span className="font-bold text-zinc-700">{schoolName}</span> and aren't completed yet. Tick the ones you'd like to add to this same trip.
          </p>

          <div className="flex items-center justify-between px-0.5">
            <button
              type="button"
              title={allSelected ? 'Deselect all invoices' : 'Select all invoices'}
              onClick={toggleAll}
              className="text-[11px] font-black uppercase tracking-wider text-brand-primary hover:underline"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-[11px] font-bold text-zinc-400">{selectedIds.length} selected</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
            {candidates.map(inv => {
              const isChecked = Boolean(selected[inv.id]);
              const statusLabel = STATUS_DISPLAY_MAP[(inv.status || '').toLowerCase()] || inv.status || 'Unknown';
              return (
                <label
                  key={inv.id}
                  className="flex items-center gap-3 p-3 border border-zinc-200 rounded-xl hover:border-zinc-300 hover:bg-zinc-50/50 transition-all cursor-pointer"
                >
                  <input
                    type="checkbox"
                    title={`Include invoice #${inv.number}`}
                    checked={isChecked}
                    onChange={() => setSelected(prev => ({ ...prev, [inv.id]: !prev[inv.id] }))}
                    className="w-4 h-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent/30"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-zinc-900 truncate">#{inv.number} — {inv.client}</p>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-medium mt-0.5">
                      <span>R {(inv.amount || 0).toLocaleString()}</span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500 font-black uppercase tracking-wider text-[9px]">
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-zinc-150 shrink-0 flex items-center gap-3">
          <button
            type="button"
            title="Close without adding more invoices"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl font-bold text-sm text-zinc-500 hover:bg-zinc-100 transition-all border border-zinc-200"
          >
            Skip
          </button>
          <button
            type="button"
            title="Add the ticked invoices to this trip"
            disabled={selectedIds.length === 0}
            onClick={() => onConfirm(selectedIds)}
            className="flex-[2] bg-brand-primary text-white py-3 rounded-2xl font-black text-sm uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            Add Selected {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
