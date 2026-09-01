import { useState } from 'react';
import { X, Download, FileText, Table2, ChevronRight } from 'lucide-react';

export type PayrollExportType = 'detailed' | 'register';

export function ExportOptionsDialog({ title = 'Export Report', onSelect, onClose }: {
  title?: string;
  onSelect: (type: PayrollExportType) => void;
  onClose: () => void;
}) {
  // Guards against a second export firing from this same dialog instance — e.g. a
  // double-click landing before the dialog has unmounted, since each export opens its
  // own browser print window and a second one would look like "two dialogs" to the user.
  const [dispatched, setDispatched] = useState(false);

  const handleSelect = (type: PayrollExportType) => {
    if (dispatched) return;
    setDispatched(true);
    onSelect(type);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 rounded-xl border border-zinc-200">
              <Download className="w-4 h-4 text-zinc-600" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">{title}</h3>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          <button
            type="button"
            title="Export the detailed wages report"
            onClick={() => handleSelect('detailed')}
            disabled={dispatched}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 hover:border-brand-accent/40 hover:bg-brand-accent/5 transition-all text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-zinc-200 disabled:hover:bg-transparent"
          >
            <div className="p-2 bg-zinc-100 rounded-xl border border-zinc-200 shrink-0">
              <FileText className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-900">Detailed</p>
              <p className="text-xs text-zinc-500 mt-0.5">Hours, rates, deductions and nett total per staff member for the period.</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>

          <button
            type="button"
            title="Export the attendance register"
            onClick={() => handleSelect('register')}
            disabled={dispatched}
            className="w-full flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 hover:border-brand-accent/40 hover:bg-brand-accent/5 transition-all text-left cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-zinc-200 disabled:hover:bg-transparent"
          >
            <div className="p-2 bg-zinc-100 rounded-xl border border-zinc-200 shrink-0">
              <Table2 className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-900">Attendance Register</p>
              <p className="text-xs text-zinc-500 mt-0.5">Just the hours logged each working day, per staff member, in the same document style.</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
