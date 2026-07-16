import { X, History, Pencil, Trash2, Eye } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../../lib/utils';
import { KpiReading } from '../hooks/useKpiReadings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  readings: KpiReading[];
  selectedReadingId: string | null;
  onView: (reading: KpiReading) => void;
  onEdit: (reading: KpiReading) => void;
  onDelete: (reading: KpiReading) => void;
}

export function ReadingsHistoryDialog({
  isOpen, onClose, readings, selectedReadingId, onView, onEdit, onDelete
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-xs">
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-lg border border-zinc-200 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50/50 shrink-0 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-brand-accent/10 border border-brand-accent/20 text-brand-accent shrink-0 mt-0.5">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900">Readings History</h2>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                {readings.length} reading{readings.length !== 1 ? 's' : ''} recorded. View, edit or delete a reading.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} title="Close"
            className="p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4">
          {readings.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-zinc-400">
              No readings yet. Click “Take Reading” to record the first one.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {readings.map(r => {
                const isActive = selectedReadingId === r.id;
                return (
                  <li key={r.id}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors',
                      isActive ? 'bg-brand-accent/5 border-brand-accent/30' : 'bg-white border-zinc-100 hover:bg-zinc-50'
                    )}>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-bold truncate', isActive ? 'text-brand-accent' : 'text-zinc-700')}>
                        {r.date.slice(0, 10)}
                        {isActive && <span className="ml-2 text-[9px] font-black uppercase tracking-wider">Viewing</span>}
                      </p>
                      <p className="text-[10px] text-zinc-400">
                        {Object.keys(r.entries).length} products · {r.shiftHours}h shift · {r.workingDaysPerMonth} days/month
                      </p>
                    </div>
                    <button type="button" onClick={() => onView(r)} title="View this reading in the table"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors cursor-pointer">
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                    <button type="button" onClick={() => onEdit(r)} title="Edit this reading"
                      className="p-1.5 text-zinc-300 hover:text-brand-accent hover:bg-brand-accent/10 rounded-lg transition-colors cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => onDelete(r)} title="Delete this reading"
                      className="p-1.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex items-center justify-end shrink-0">
          <button type="button" onClick={onClose} title="Close history"
            className="px-4 py-2.5 border border-zinc-200 hover:bg-zinc-100 text-zinc-600 font-bold text-[11px] uppercase tracking-wider rounded-xl transition-all cursor-pointer">
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
