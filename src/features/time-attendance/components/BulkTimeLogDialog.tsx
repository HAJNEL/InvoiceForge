import { useState } from 'react';
import { X, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { StaffMember, TimeAttendanceSettings } from '../../../types';
import { cn } from '../../../lib/utils';
import { TimeLogEntry } from '../hooks/useTimeLogs';
import { useBulkTimeLogState } from './useBulkTimeLogState';

export function BulkTimeLogDialog({ staff, settings, onSaveBulk, onClose }: {
  staff: StaffMember[];
  settings: TimeAttendanceSettings;
  onSaveBulk: (entries: TimeLogEntry[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const {
    activeStaff, date, setDate,
    defaultClockIn, applyDefaultClockIn,
    defaultClockOut, applyDefaultClockOut,
    defaultTeaBreak, applyDefaultTeaBreak,
    defaultTeaBreakStart, applyDefaultTeaBreakStart,
    defaultTeaBreakEnd, applyDefaultTeaBreakEnd,
    defaultLunchBreak, applyDefaultLunchBreak,
    defaultLunchBreakStart, applyDefaultLunchBreakStart,
    defaultLunchBreakEnd, applyDefaultLunchBreakEnd,
    getRow, toggleChecked, setRowTime, setRowBreak, setRowBreakTime,
    checkedCount, allChecked, toggleSelectAll, buildEntries,
  } = useBulkTimeLogState(staff, settings);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const entries = buildEntries();
    if (entries.length === 0) return;
    setSubmitting(true);
    try {
      const ok = await onSaveBulk(entries);
      if (ok) {
        toast.success(`Logged attendance for ${entries.length} staff member${entries.length === 1 ? '' : 's'}`);
        onClose();
      }
    } catch (err) {
      console.error('Failed to save bulk time logs:', err);
      toast.error('Could not save bulk time logs');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">Bulk Log Attendance</h3>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 border-b border-zinc-100 bg-zinc-50/30 shrink-0">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
              <input
                type="date"
                title="Date for this batch"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Default Clock In</label>
              <input
                type="time"
                title="Default clock-in time applied to all ticked staff"
                value={defaultClockIn}
                onChange={(e) => applyDefaultClockIn(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Default Clock Out</label>
              <input
                type="time"
                title="Default clock-out time applied to all ticked staff"
                value={defaultClockOut}
                onChange={(e) => applyDefaultClockOut(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white"
              />
            </div>
          </div>
          <div className="space-y-2 pt-3">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none w-32 shrink-0">
                <input
                  type="checkbox"
                  title="Default tea break, applied to all ticked staff"
                  checked={defaultTeaBreak}
                  onChange={(e) => applyDefaultTeaBreak(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
                />
                <span className="text-xs font-bold text-zinc-700">Default Tea Break</span>
              </label>
              <input
                type="time"
                title="Default tea break start time"
                value={defaultTeaBreakStart}
                onChange={(e) => applyDefaultTeaBreakStart(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white"
              />
              <input
                type="time"
                title="Default tea break end time"
                value={defaultTeaBreakEnd}
                onChange={(e) => applyDefaultTeaBreakEnd(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none w-32 shrink-0">
                <input
                  type="checkbox"
                  title="Default lunch break, applied to all ticked staff"
                  checked={defaultLunchBreak}
                  onChange={(e) => applyDefaultLunchBreak(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
                />
                <span className="text-xs font-bold text-zinc-700">Default Lunch Break</span>
              </label>
              <input
                type="time"
                title="Default lunch break start time"
                value={defaultLunchBreakStart}
                onChange={(e) => applyDefaultLunchBreakStart(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white"
              />
              <input
                type="time"
                title="Default lunch break end time"
                value={defaultLunchBreakEnd}
                onChange={(e) => applyDefaultLunchBreakEnd(e.target.value)}
                className="flex-1 min-w-0 px-2 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white"
              />
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-2">
          {activeStaff.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer select-none pb-1">
              <input
                type="checkbox"
                title="Select all staff"
                checked={allChecked}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent"
              />
              <span className="text-xs font-bold text-zinc-700">{allChecked ? 'Deselect All' : 'Select All'}</span>
            </label>
          )}
          {activeStaff.length === 0 ? (
            <p className="text-center text-xs text-zinc-400 py-8">No active staff members yet.</p>
          ) : activeStaff.map(s => {
            const row = getRow(s.id);
            return (
              <div
                key={s.id}
                className={cn(
                  "flex flex-col gap-2 p-3 rounded-2xl border transition-all",
                  row.checked ? "bg-zinc-55 border-brand-accent/50 shadow-xs" : "border-zinc-200 hover:bg-zinc-50/40"
                )}
              >
                <div className="flex items-center gap-3.5">
                  <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      title={`Include ${s.firstName} ${s.lastName}`}
                      checked={row.checked}
                      onChange={() => toggleChecked(s.id)}
                      className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
                    />
                    <span className="text-xs font-bold text-zinc-900 truncate">{s.firstName} {s.lastName}</span>
                  </label>
                  <input
                    type="time"
                    title={`Clock in time for ${s.firstName} ${s.lastName}`}
                    value={row.clockIn}
                    onChange={(e) => setRowTime(s.id, 'clockIn', e.target.value)}
                    disabled={!row.checked}
                    className="w-28 px-2 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                  />
                  <input
                    type="time"
                    title={`Clock out time for ${s.firstName} ${s.lastName}`}
                    value={row.clockOut}
                    onChange={(e) => setRowTime(s.id, 'clockOut', e.target.value)}
                    disabled={!row.checked}
                    className="w-28 px-2 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                  />
                </div>
                {row.checked && (
                  <div className="space-y-1.5 pl-7">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none w-14 shrink-0">
                        <input
                          type="checkbox"
                          title={`Tea break for ${s.firstName} ${s.lastName}`}
                          checked={row.teaBreak}
                          onChange={(e) => setRowBreak(s.id, 'teaBreak', e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
                        />
                        <span className="text-[11px] font-bold text-zinc-600">Tea</span>
                      </label>
                      <input
                        type="time"
                        title={`Tea break start time for ${s.firstName} ${s.lastName}`}
                        value={row.teaBreakStart}
                        onChange={(e) => setRowBreakTime(s.id, 'teaBreakStart', e.target.value)}
                        disabled={!row.teaBreak}
                        className="w-24 px-2 py-1 border border-zinc-200 rounded-lg text-[11px] font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                      />
                      <input
                        type="time"
                        title={`Tea break end time for ${s.firstName} ${s.lastName}`}
                        value={row.teaBreakEnd}
                        onChange={(e) => setRowBreakTime(s.id, 'teaBreakEnd', e.target.value)}
                        disabled={!row.teaBreak}
                        className="w-24 px-2 py-1 border border-zinc-200 rounded-lg text-[11px] font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none w-14 shrink-0">
                        <input
                          type="checkbox"
                          title={`Lunch break for ${s.firstName} ${s.lastName}`}
                          checked={row.lunchBreak}
                          onChange={(e) => setRowBreak(s.id, 'lunchBreak', e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
                        />
                        <span className="text-[11px] font-bold text-zinc-600">Lunch</span>
                      </label>
                      <input
                        type="time"
                        title={`Lunch break start time for ${s.firstName} ${s.lastName}`}
                        value={row.lunchBreakStart}
                        onChange={(e) => setRowBreakTime(s.id, 'lunchBreakStart', e.target.value)}
                        disabled={!row.lunchBreak}
                        className="w-24 px-2 py-1 border border-zinc-200 rounded-lg text-[11px] font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                      />
                      <input
                        type="time"
                        title={`Lunch break end time for ${s.firstName} ${s.lastName}`}
                        value={row.lunchBreakEnd}
                        onChange={(e) => setRowBreakTime(s.id, 'lunchBreakEnd', e.target.value)}
                        disabled={!row.lunchBreak}
                        className="w-24 px-2 py-1 border border-zinc-200 rounded-lg text-[11px] font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/30 shrink-0 flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-zinc-500">{checkedCount} selected</p>
          <button
            type="button"
            title="Save logs for all selected staff"
            onClick={handleSubmit}
            disabled={checkedCount === 0 || submitting}
            className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
            Save {checkedCount > 0 ? checkedCount : ''} Log{checkedCount === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}
