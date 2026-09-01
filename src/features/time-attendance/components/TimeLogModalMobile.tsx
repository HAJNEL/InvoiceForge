import { useState, useMemo } from 'react';
import { Clock, Loader2, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import { StaffMember, TimeLog, TimeAttendanceSettings } from '../../../types';
import { cn } from '../../../lib/utils';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import { TimeLogEntry, computeHours } from '../hooks/useTimeLogs';
import { getMinutesBetween } from '../utils';

export function TimeLogModalMobile({ staff, settings, editingLog, defaultStaffId, defaultDate, onSave, onClose }: {
  staff: StaffMember[];
  settings: TimeAttendanceSettings;
  editingLog?: TimeLog | null;
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
    <MobileSheet
      isOpen
      onClose={onClose}
      title={editingLog ? 'Edit Time Log' : 'Log Attendance'}
      footer={
        <button
          type="button"
          title={editingLog ? 'Save changes' : 'Save this time log'}
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
          {editingLog ? 'Save Changes' : 'Save Log'}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Staff Member</label>
          {selectedStaff && !staffSearch ? (
            <button
              type="button"
              title="Change staff member"
              onClick={() => setStaffSearch(' ')}
              className="w-full flex items-center justify-between px-3 py-2.5 border border-brand-accent/40 bg-brand-accent/5 rounded-xl text-sm font-bold text-zinc-800 mobile-tap-target"
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
                value={staffSearch.trim()}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>
          )}
          {(!selectedStaff || staffSearch) && (
            <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 max-h-48 overflow-y-auto">
              {filteredStaff.length === 0 ? (
                <p className="px-3 py-3 text-xs text-zinc-400 text-center">No active staff found.</p>
              ) : filteredStaff.map(s => (
                <button
                  key={s.id}
                  type="button"
                  title={`Select ${s.firstName} ${s.lastName}`}
                  onClick={() => { setStaffId(s.id); setStaffSearch(''); }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 text-xs text-left hover:bg-zinc-50 transition-colors mobile-tap-target",
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

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
          <input
            type="date"
            title="Date of attendance"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
          />
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Clock In</label>
            <input
              type="time"
              title="Clock in time"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
              className="block w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Clock Out</label>
            <input
              type="time"
              title="Clock out time"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
              className="block w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none w-16 shrink-0 mobile-tap-target">
              <input
                type="checkbox"
                title="Include tea break"
                checked={teaBreak}
                onChange={(e) => setTeaBreak(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
              />
              <span className="text-xs font-bold text-zinc-700">Tea</span>
            </label>
            <input
              type="time"
              title="Tea break start time"
              value={teaBreakStart}
              onChange={(e) => setTeaBreakStart(e.target.value)}
              disabled={!teaBreak}
              className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
            <input
              type="time"
              title="Tea break end time"
              value={teaBreakEnd}
              onChange={(e) => setTeaBreakEnd(e.target.value)}
              disabled={!teaBreak}
              className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none w-16 shrink-0 mobile-tap-target">
              <input
                type="checkbox"
                title="Include lunch break"
                checked={lunchBreak}
                onChange={(e) => setLunchBreak(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
              />
              <span className="text-xs font-bold text-zinc-700">Lunch</span>
            </label>
            <input
              type="time"
              title="Lunch break start time"
              value={lunchBreakStart}
              onChange={(e) => setLunchBreakStart(e.target.value)}
              disabled={!lunchBreak}
              className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
            <input
              type="time"
              title="Lunch break end time"
              value={lunchBreakEnd}
              onChange={(e) => setLunchBreakEnd(e.target.value)}
              disabled={!lunchBreak}
              className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
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

        <p className="text-xs font-bold text-zinc-500">Net hours: <span className="text-zinc-900 font-black">{previewHours}h</span></p>
      </div>
    </MobileSheet>
  );
}
