import { useState, useMemo } from 'react';
import { Clock, Plus, Users, Loader2, Inbox } from 'lucide-react';
import { StaffMember, TimeAttendanceSettings } from '../../../types';
import { useTimeLogs } from '../hooks/useTimeLogs';
import { DEFAULT_TIME_ATTENDANCE_SETTINGS } from '../constants';
import { TimeLogModal } from './TimeLogModal';
import { BulkTimeLogDialog } from './BulkTimeLogDialog';

// Slimmed-down Team Dashboard surface for the "Time and Attendance" role: Log / Bulk Log
// only — no staff CRUD, no graph (those stay owner-only on the main Time and Attendance page).
export function TeamAttendancePanel({ staff, ownerId, teamMemberId, attendanceSettings }: {
  staff: StaffMember[];
  ownerId: string;
  teamMemberId: string;
  attendanceSettings?: TimeAttendanceSettings;
}) {
  const settings = { ...DEFAULT_TIME_ATTENDANCE_SETTINGS, ...attendanceSettings };
  const { timeLogs, loading, addTimeLog, addTimeLogsBulk } = useTimeLogs(ownerId, teamMemberId);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysLogs = useMemo(() => timeLogs.filter(l => l.date === todayKey), [timeLogs, todayKey]);

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach(s => map.set(s.id, `${s.firstName} ${s.lastName}`));
    return map;
  }, [staff]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm relative text-left space-y-4">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-zinc-900">
          <Clock className="w-5 h-5 text-teal-600" />
          <h3 className="font-bold text-sm text-zinc-900">Time and Attendance</h3>
        </div>
        <p className="text-[11px] text-zinc-500 leading-snug">
          Log or bulk-log staff clock in/out times for today.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsBulkOpen(true)}
          title="Bulk Log Attendance"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-xs transition-all shadow-2xs cursor-pointer"
        >
          <Users className="w-3.5 h-3.5 text-zinc-500" />
          Bulk Log
        </button>
        <button
          onClick={() => setIsLogOpen(true)}
          title="Log Attendance"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Log
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Today's Logs</p>
        {loading ? (
          <div className="py-6 flex justify-center">
            <Loader2 className="w-5 h-5 text-brand-accent animate-spin" />
          </div>
        ) : todaysLogs.length === 0 ? (
          <div className="py-6 text-center">
            <Inbox className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
            <p className="text-zinc-400 text-xs">No logs recorded today yet.</p>
          </div>
        ) : (
          <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 max-h-56 overflow-y-auto">
            {todaysLogs.map(log => (
              <div key={log.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-zinc-800 truncate">{staffNameById.get(log.staffId) || 'Unknown staff'}</span>
                <span className="text-zinc-500 shrink-0">{log.clockIn} – {log.clockOut} · {log.hours}h</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLogOpen && (
        <TimeLogModal staff={staff} settings={settings} onSave={addTimeLog} onClose={() => setIsLogOpen(false)} />
      )}
      {isBulkOpen && (
        <BulkTimeLogDialog staff={staff} settings={settings} onSaveBulk={addTimeLogsBulk} onClose={() => setIsBulkOpen(false)} />
      )}
    </div>
  );
}
