import { useState, useMemo } from 'react';
import { X, Clock, Loader2, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import { StaffMember, TimeLog, TimeAttendanceSettings } from '../../../types';
import { cn } from '../../../lib/utils';
import { TimeLogEntry, computeHours } from '../hooks/useTimeLogs';
import { getMinutesBetween } from '../utils';

export function TimeLogModal({ staff, settings, editingLog, defaultStaffId, defaultDate, onSave, onClose }: {
  staff: StaffMember[];
  settings: TimeAttendanceSettings;
  editingLog?: TimeLog | null;
  // Pre-fill for "add an entry for this staff member/day" flows (e.g. from the payroll
  // table's per-employee timecard breakdown) where there's no existing log to edit yet.
  defaultStaffId?: string;
  defaultDate?: string;
  onSave: (entry: TimeLogEntry) => Promise<unknown>;
  onClose: () => void;
}) {
  const activeStaff = useMemo(() => staff.filter(s => s.status === 'active'), [staff]);

  const [staffId, setStaffId] = useState(editingLog?.staffId || defaultStaffId || '');
  const [staffSearch, setStaffSearch] = useState('');
  const [date, setDate] = useState(editingLog?.date || defaultDate || new Date().toISOString().slice(0, 10));
  const [clockIn, setClockIn] = useState(editingLog?.clockIn || settings.checkInTime);
  const [clockOut, setClockOut] = useState(editingLog?.clockOut || settings.checkOutTime);
  const [teaBreak, setTeaBreak] = useState(editingLog?.teaBreak ?? settings.teaBreakEnabledByDefault);
  const [teaBreakStart, setTeaBreakStart] = useState(editingLog?.teaBreakStart || settings.teaBreakStart);
  const [teaBreakEnd, setTeaBreakEnd] = useState(editingLog?.teaBreakEnd || settings.teaBreakEnd);
  const [lunchBreak, setLunchBreak] = useState(editingLog?.lunchBreak ?? settings.lunchBreakEnabledByDefault);
  const [lunchBreakStart, setLunchBreakStart] = useState(editingLog?.lunchBreakStart || settings.lunchBreakStart);
  const [lunchBreakEnd, setLunchBreakEnd] = useState(editingLog?.lunchBreakEnd || settings.lunchBreakEnd);
  const [note, setNote] = useState(editingLog?.note || '');
  const [submitting, setSubmitting] = useState(false);

  const filteredStaff = useMemo(() => {
    const q = staffSearch.toLowerCase().trim();
    if (!q) return activeStaff;
    return activeStaff.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q));
  }, [activeStaff, staffSearch]);

  const selectedStaff = activeStaff.find(s => s.id === staffId) || staff.find(s => s.id === staffId);
  const isValid = staffId && date && clockIn && clockOut;

  const breakMinutes = (teaBreak ? getMinutesBetween(teaBreakStart, teaBreakEnd) : 0)
    + (lunchBreak ? getMinutesBetween(lunchBreakStart, lunchBreakEnd) : 0);
  const previewHours = computeHours(clockIn, clockOut, breakMinutes);

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const ok = await onSave({
        staffId, date, clockIn, clockOut,
        teaBreak, teaBreakStart, teaBreakEnd,
        lunchBreak, lunchBreakStart, lunchBreakEnd,
        breakMinutes, note: note.trim() || undefined
      });
      if (ok) {
        toast.success(editingLog ? 'Time log updated' : 'Time log saved');
        onClose();
      }
    } catch (err) {
      console.error('Failed to save time log:', err);
      toast.error('Could not save time log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
              <Clock className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">
              {editingLog ? 'Edit Time Log' : 'Log Attendance'}
            </h3>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Staff Member</label>
            {selectedStaff && !staffSearch ? (
              <button
                type="button"
                title="Change staff member"
                onClick={() => setStaffSearch(' ')}
                className="w-full flex items-center justify-between px-3 py-2.5 border border-brand-accent/40 bg-brand-accent/5 rounded-xl text-sm font-bold text-zinc-800"
              >
                {selectedStaff.firstName} {selectedStaff.lastName}
                <Search className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  title="Search for staff member"
                  placeholder="Search staff by name…"
                  autoFocus
                  value={staffSearch.trim()}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                />
              </div>
            )}
            {(!selectedStaff || staffSearch) && (
              <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 max-h-40 overflow-y-auto">
                {filteredStaff.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-zinc-400 text-center">No active staff found.</p>
                ) : filteredStaff.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    title={`Select ${s.firstName} ${s.lastName}`}
                    onClick={() => { setStaffId(s.id); setStaffSearch(''); }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-zinc-50 transition-colors",
                      staffId === s.id && "bg-brand-accent/5"
                    )}
                  >
                    <span className="font-bold text-zinc-800">{s.firstName} {s.lastName}</span>
                    {staffId === s.id && <Check className="w-3.5 h-3.5 text-brand-accent" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
              <input
                type="date"
                title="Date of attendance"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>
            <div className="space-y-1 col-span-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Clock In</label>
              <input
                type="time"
                title="Clock in time"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>
            <div className="space-y-1 col-span-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Clock Out</label>
              <input
                type="time"
                title="Clock out time"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none w-24 shrink-0">
                <input
                  type="checkbox"
                  title="Include tea break"
                  checked={teaBreak}
                  onChange={(e) => setTeaBreak(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
                />
                <span className="text-xs font-bold text-zinc-700">Tea Break</span>
              </label>
              <input
                type="time"
                title="Tea break start time"
                value={teaBreakStart}
                onChange={(e) => setTeaBreakStart(e.target.value)}
                disabled={!teaBreak}
                className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 rounded-xl text-sm font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
              <input
                type="time"
                title="Tea break end time"
                value={teaBreakEnd}
                onChange={(e) => setTeaBreakEnd(e.target.value)}
                disabled={!teaBreak}
                className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 rounded-xl text-sm font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none w-24 shrink-0">
                <input
                  type="checkbox"
                  title="Include lunch break"
                  checked={lunchBreak}
                  onChange={(e) => setLunchBreak(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
                />
                <span className="text-xs font-bold text-zinc-700">Lunch Break</span>
              </label>
              <input
                type="time"
                title="Lunch break start time"
                value={lunchBreakStart}
                onChange={(e) => setLunchBreakStart(e.target.value)}
                disabled={!lunchBreak}
                className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 rounded-xl text-sm font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
              <input
                type="time"
                title="Lunch break end time"
                value={lunchBreakEnd}
                onChange={(e) => setLunchBreakEnd(e.target.value)}
                disabled={!lunchBreak}
                className="flex-1 min-w-0 px-3 py-2 border border-zinc-200 rounded-xl text-sm font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Note (optional)</label>
            <input
              type="text"
              title="Optional note"
              placeholder="e.g. left early for appointment"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <p className="text-xs font-bold text-zinc-500">Net hours: <span className="text-zinc-900 font-black">{previewHours}h</span></p>
            <button
              type="button"
              title={editingLog ? 'Save changes' : 'Save this time log'}
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              {editingLog ? 'Save Changes' : 'Save Log'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
