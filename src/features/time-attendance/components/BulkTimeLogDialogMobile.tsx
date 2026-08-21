import { useState } from 'react';
import { Users, Loader2, Settings, Play, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { StaffMember, TimeAttendanceSettings } from '../../../types';
import { cn } from '../../../lib/utils';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import { TimeLogEntry } from '../hooks/useTimeLogs';
import { useBulkTimeLogState } from './useBulkTimeLogState';

export function BulkTimeLogDialogMobile({ staff, settings, onSaveBulk, onClose }: {
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
    getRow, toggleChecked, setChecked, setRowTime, setRowBreak, setRowBreakTime,
    checkedCount, buildEntries,
  } = useBulkTimeLogState(staff, settings);

  const [submitting, setSubmitting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

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
    <MobileSheet
      isOpen
      onClose={onClose}
      title="Bulk Log Attendance"
      subtitle={`${checkedCount} selected`}
      footer={
        <button
          type="button"
          title="Save logs for all selected staff"
          onClick={handleSubmit}
          disabled={checkedCount === 0 || submitting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary text-white rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          Save {checkedCount > 0 ? checkedCount : ''} Log{checkedCount === 1 ? '' : 's'}
        </button>
      }
    >
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1 min-w-0">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
            <input
              type="date"
              title="Date for this batch"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
          <button
            type="button"
            title="Attendance defaults"
            onClick={() => setShowSettings(true)}
            className="p-2.5 border border-zinc-200 rounded-xl text-zinc-500 hover:bg-zinc-50 hover:text-brand-primary transition-all shrink-0 mobile-tap-target"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          title="Step through each staff member and mark present or absent"
          onClick={() => setShowWizard(true)}
          disabled={activeStaff.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-primary/5 border-2 border-dashed border-brand-primary/30 text-brand-primary rounded-xl font-black text-sm uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed mobile-tap-target"
        >
          <Play className="w-4 h-4" />
          Start
        </button>

        <div className="space-y-2 pt-1">
          {activeStaff.length === 0 ? (
            <p className="text-center text-xs text-zinc-400 py-8">No active staff members yet.</p>
          ) : activeStaff.map(s => {
            const row = getRow(s.id);
            return (
              <div
                key={s.id}
                className={cn(
                  "rounded-2xl border p-3 space-y-2 transition-all",
                  row.checked ? "bg-zinc-55 border-brand-accent/50 shadow-xs" : "border-zinc-200"
                )}
              >
                <label className="flex items-center gap-3 cursor-pointer select-none mobile-tap-target">
                  <input
                    type="checkbox"
                    title={`Include ${s.firstName} ${s.lastName}`}
                    checked={row.checked}
                    onChange={() => toggleChecked(s.id)}
                    className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
                  />
                  <span className="text-xs font-bold text-zinc-900">{s.firstName} {s.lastName}</span>
                </label>
                {row.checked && (
                  <>
                    <div className="grid grid-cols-2 gap-2 pl-7">
                      <input
                        type="time"
                        title={`Clock in time for ${s.firstName} ${s.lastName}`}
                        value={row.clockIn}
                        onChange={(e) => setRowTime(s.id, 'clockIn', e.target.value)}
                        className="w-full min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                      />
                      <input
                        type="time"
                        title={`Clock out time for ${s.firstName} ${s.lastName}`}
                        value={row.clockOut}
                        onChange={(e) => setRowTime(s.id, 'clockOut', e.target.value)}
                        className="w-full min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                      />
                    </div>
                    <div className="space-y-1.5 pl-7">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none w-14 shrink-0 mobile-tap-target">
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
                          className="flex-1 min-w-0 px-2 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                        />
                        <input
                          type="time"
                          title={`Tea break end time for ${s.firstName} ${s.lastName}`}
                          value={row.teaBreakEnd}
                          onChange={(e) => setRowBreakTime(s.id, 'teaBreakEnd', e.target.value)}
                          disabled={!row.teaBreak}
                          className="flex-1 min-w-0 px-2 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer select-none w-14 shrink-0 mobile-tap-target">
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
                          className="flex-1 min-w-0 px-2 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                        />
                        <input
                          type="time"
                          title={`Lunch break end time for ${s.firstName} ${s.lastName}`}
                          value={row.lunchBreakEnd}
                          onChange={(e) => setRowBreakTime(s.id, 'lunchBreakEnd', e.target.value)}
                          disabled={!row.lunchBreak}
                          className="flex-1 min-w-0 px-2 py-1.5 border border-zinc-200 rounded-lg text-[11px] font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showSettings && (
        <MobileSheet
          isOpen
          onClose={() => setShowSettings(false)}
          title="Attendance Defaults"
          fullHeight={false}
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Date</label>
              <input
                type="date"
                title="Date for this batch"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 min-w-0">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Default Clock In</label>
                <input
                  type="time"
                  title="Default clock-in time applied to all ticked staff"
                  value={defaultClockIn}
                  onChange={(e) => applyDefaultClockIn(e.target.value)}
                  className="w-full min-w-0 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                />
              </div>
              <div className="space-y-1 min-w-0">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Default Clock Out</label>
                <input
                  type="time"
                  title="Default clock-out time applied to all ticked staff"
                  value={defaultClockOut}
                  onChange={(e) => applyDefaultClockOut(e.target.value)}
                  className="w-full min-w-0 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer select-none w-16 shrink-0 mobile-tap-target">
                  <input
                    type="checkbox"
                    title="Default tea break, applied to all ticked staff"
                    checked={defaultTeaBreak}
                    onChange={(e) => applyDefaultTeaBreak(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
                  />
                  <span className="text-xs font-bold text-zinc-700">Tea</span>
                </label>
                <input
                  type="time"
                  title="Default tea break start time"
                  value={defaultTeaBreakStart}
                  onChange={(e) => applyDefaultTeaBreakStart(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                />
                <input
                  type="time"
                  title="Default tea break end time"
                  value={defaultTeaBreakEnd}
                  onChange={(e) => applyDefaultTeaBreakEnd(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer select-none w-16 shrink-0 mobile-tap-target">
                  <input
                    type="checkbox"
                    title="Default lunch break, applied to all ticked staff"
                    checked={defaultLunchBreak}
                    onChange={(e) => applyDefaultLunchBreak(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
                  />
                  <span className="text-xs font-bold text-zinc-700">Lunch</span>
                </label>
                <input
                  type="time"
                  title="Default lunch break start time"
                  value={defaultLunchBreakStart}
                  onChange={(e) => applyDefaultLunchBreakStart(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                />
                <input
                  type="time"
                  title="Default lunch break end time"
                  value={defaultLunchBreakEnd}
                  onChange={(e) => applyDefaultLunchBreakEnd(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                />
              </div>
            </div>

            <button
              type="button"
              title="Close attendance defaults"
              onClick={() => setShowSettings(false)}
              className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold text-sm mobile-tap-target"
            >
              Done
            </button>
          </div>
        </MobileSheet>
      )}

      {showWizard && (
        <AttendanceWizard
          staff={activeStaff}
          date={date}
          getRow={getRow}
          setChecked={setChecked}
          setRowTime={setRowTime}
          setRowBreak={setRowBreak}
          setRowBreakTime={setRowBreakTime}
          onClose={() => setShowWizard(false)}
        />
      )}
    </MobileSheet>
  );
}

function AttendanceWizard({ staff, date, getRow, setChecked, setRowTime, setRowBreak, setRowBreakTime, onClose }: {
  staff: StaffMember[];
  date: string;
  getRow: ReturnType<typeof useBulkTimeLogState>['getRow'];
  setChecked: ReturnType<typeof useBulkTimeLogState>['setChecked'];
  setRowTime: ReturnType<typeof useBulkTimeLogState>['setRowTime'];
  setRowBreak: ReturnType<typeof useBulkTimeLogState>['setRowBreak'];
  setRowBreakTime: ReturnType<typeof useBulkTimeLogState>['setRowBreakTime'];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const current = staff[index];
  const row = current ? getRow(current.id) : null;

  const advance = () => {
    if (index + 1 >= staff.length) {
      onClose();
    } else {
      setIndex(index + 1);
    }
  };

  const markPresent = () => {
    if (current) setChecked(current.id, true);
    advance();
  };

  const markAbsent = () => {
    if (current) setChecked(current.id, false);
    advance();
  };

  if (!current || !row) return null;

  return (
    <MobileSheet
      isOpen
      onClose={onClose}
      title="Mark Attendance"
      subtitle={`${new Date(date + 'T00:00:00').toLocaleDateString()} · ${index + 1} of ${staff.length}`}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            title={`Mark ${current.firstName} ${current.lastName} absent`}
            onClick={markAbsent}
            className="flex items-center justify-center gap-2 py-4 bg-red-600 text-white rounded-xl font-black text-sm uppercase tracking-wide mobile-tap-target"
          >
            <UserX className="w-5 h-5" />
            Absent
          </button>
          <button
            type="button"
            title={`Mark ${current.firstName} ${current.lastName} present`}
            onClick={markPresent}
            className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl font-black text-sm uppercase tracking-wide mobile-tap-target"
          >
            <UserCheck className="w-5 h-5" />
            Present
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="text-center py-2">
          <p className="text-lg font-black text-brand-primary">{current.firstName} {current.lastName}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 min-w-0">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Clock In</label>
            <input
              type="time"
              title={`Clock in time for ${current.firstName} ${current.lastName}`}
              value={row.clockIn}
              onChange={(e) => setRowTime(current.id, 'clockIn', e.target.value)}
              className="w-full min-w-0 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
          <div className="space-y-1 min-w-0">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Clock Out</label>
            <input
              type="time"
              title={`Clock out time for ${current.firstName} ${current.lastName}`}
              value={row.clockOut}
              onChange={(e) => setRowTime(current.id, 'clockOut', e.target.value)}
              className="w-full min-w-0 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none w-16 shrink-0 mobile-tap-target">
              <input
                type="checkbox"
                title={`Tea break for ${current.firstName} ${current.lastName}`}
                checked={row.teaBreak}
                onChange={(e) => setRowBreak(current.id, 'teaBreak', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
              />
              <span className="text-xs font-bold text-zinc-700">Tea</span>
            </label>
            <input
              type="time"
              title={`Tea break start time for ${current.firstName} ${current.lastName}`}
              value={row.teaBreakStart}
              onChange={(e) => setRowBreakTime(current.id, 'teaBreakStart', e.target.value)}
              disabled={!row.teaBreak}
              className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
            <input
              type="time"
              title={`Tea break end time for ${current.firstName} ${current.lastName}`}
              value={row.teaBreakEnd}
              onChange={(e) => setRowBreakTime(current.id, 'teaBreakEnd', e.target.value)}
              disabled={!row.teaBreak}
              className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 cursor-pointer select-none w-16 shrink-0 mobile-tap-target">
              <input
                type="checkbox"
                title={`Lunch break for ${current.firstName} ${current.lastName}`}
                checked={row.lunchBreak}
                onChange={(e) => setRowBreak(current.id, 'lunchBreak', e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-brand-primary focus:ring-brand-accent shrink-0"
              />
              <span className="text-xs font-bold text-zinc-700">Lunch</span>
            </label>
            <input
              type="time"
              title={`Lunch break start time for ${current.firstName} ${current.lastName}`}
              value={row.lunchBreakStart}
              onChange={(e) => setRowBreakTime(current.id, 'lunchBreakStart', e.target.value)}
              disabled={!row.lunchBreak}
              className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
            <input
              type="time"
              title={`Lunch break end time for ${current.firstName} ${current.lastName}`}
              value={row.lunchBreakEnd}
              onChange={(e) => setRowBreakTime(current.id, 'lunchBreakEnd', e.target.value)}
              disabled={!row.lunchBreak}
              className="flex-1 min-w-0 px-2 py-2 border border-zinc-200 rounded-lg text-xs font-medium disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
        </div>
      </div>
    </MobileSheet>
  );
}
