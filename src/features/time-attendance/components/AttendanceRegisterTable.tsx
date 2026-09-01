import { Inbox } from 'lucide-react';
import { StaffMember, TimeLog, TimeAttendanceSettings } from '../../../types';
import { PeriodRange, getDatesInRange, getWeekdayShort } from '../utils';

function hoursOn(timeLogs: TimeLog[], staffId: string, date: string): number {
  return timeLogs
    .filter(l => l.staffId === staffId && l.date === date)
    .reduce((sum, l) => sum + (l.hours || 0), 0);
}

// A day-by-day attendance grid (staff x working day) for the current pay period —
// the "just the register" companion to the payroll table below it, which only shows
// period totals. Columns are the period's dates that fall on a configured working day.
export function AttendanceRegisterTable({ staff, timeLogs, attendanceSettings, period }: {
  staff: StaffMember[];
  timeLogs: TimeLog[];
  attendanceSettings: TimeAttendanceSettings;
  period: PeriodRange;
}) {
  const days = getDatesInRange(period.start, period.end).filter(d => {
    const dow = new Date(`${d}T00:00:00`).getDay();
    return attendanceSettings.workingDays.includes(dow);
  });

  if (staff.length === 0) {
    return (
      <div className="p-16 text-center">
        <Inbox className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">No staff to show.</p>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="p-16 text-center">
        <Inbox className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">No working days configured for this period — set them under Working Days in the configuration.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-zinc-50/70 border-b border-zinc-200">
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap sticky left-0 bg-zinc-50 z-10">Staff Member</th>
            {days.map(d => {
              const dt = new Date(`${d}T00:00:00`);
              return (
                <th key={d} className="px-3 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-center whitespace-nowrap">
                  <div>{getWeekdayShort(d)}</div>
                  <div className="text-[10px] font-normal text-zinc-400 normal-case">{dt.getDate()}/{dt.getMonth() + 1}</div>
                </th>
              );
            })}
            <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right whitespace-nowrap">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {staff.map(s => {
            const rowTotal = Math.round(days.reduce((sum, d) => sum + hoursOn(timeLogs, s.id, d), 0) * 100) / 100;
            return (
              <tr key={s.id} className="hover:bg-zinc-50/40 transition-colors">
                <td className="px-4 py-2.5 text-sm font-semibold text-zinc-850 whitespace-nowrap sticky left-0 bg-white z-10">
                  {s.firstName} {s.lastName}
                </td>
                {days.map(d => {
                  const hrs = hoursOn(timeLogs, s.id, d);
                  return (
                    <td key={d} className="px-3 py-2.5 text-sm text-center text-zinc-700 whitespace-nowrap">
                      {hrs > 0 ? `${hrs}h` : <span className="text-zinc-300">—</span>}
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-sm font-black text-zinc-800 text-right whitespace-nowrap">{rowTotal}h</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
