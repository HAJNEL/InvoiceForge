import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus, Inbox } from 'lucide-react';
import { StaffMember, TimeLog, TimeAttendanceSettings, RateGroup, RateSettings, PayrollAdjustment } from '../../../types';
import { TimeLogEntry } from '../hooks/useTimeLogs';
import { PayrollAdjustmentEntry } from '../hooks/usePayrollAdjustments';
import { PeriodRange, getDatesInRange, getWeekdayShort } from '../utils';
import { buildPayrollRows } from '../payroll';
import { TimeLogModalMobile } from './TimeLogModalMobile';
import { MobileCard, MobileCardActionsMenu } from '../../../components/mobile/MobileCard';
import { cn } from '../../../lib/utils';

const currency = (n: number) => `R${n.toFixed(2)}`;

export function StaffPayrollListMobile({
  staff, timeLogs, rateGroups, rateSettings, attendanceSettings, adjustments, period,
  addTimeLog, updateTimeLog, deleteTimeLog, onSetAdjustment,
}: {
  staff: StaffMember[];
  timeLogs: TimeLog[];
  rateGroups: RateGroup[];
  rateSettings: RateSettings;
  attendanceSettings: TimeAttendanceSettings;
  adjustments: PayrollAdjustment[];
  period: PeriodRange;
  addTimeLog: (entry: TimeLogEntry) => Promise<unknown>;
  updateTimeLog: (id: string, entry: Partial<TimeLogEntry>) => Promise<boolean>;
  deleteTimeLog: (id: string) => Promise<boolean>;
  onSetAdjustment: (staffId: string, periodKey: string, entry: PayrollAdjustmentEntry) => Promise<boolean>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logModal, setLogModal] = useState<{ staffId: string; date?: string; editingLog?: TimeLog | null } | null>(null);

  const rows = useMemo(
    () => buildPayrollRows(staff, timeLogs, rateGroups, rateSettings, attendanceSettings, adjustments, period),
    [staff, timeLogs, rateGroups, rateSettings, attendanceSettings, adjustments, period]
  );

  const missingDaysFor = (periodLogs: TimeLog[]) => {
    const loggedDates = new Set(periodLogs.map(l => l.date));
    return getDatesInRange(period.start, period.end).filter(d => {
      const dow = new Date(`${d}T00:00:00`).getDay();
      return attendanceSettings.workingDays.includes(dow) && !loggedDates.has(d);
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this time log?')) {
      await deleteTimeLog(id);
    }
  };

  if (staff.length === 0) {
    return (
      <div className="p-8 text-center">
        <Inbox className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
        <p className="text-zinc-400 text-xs">No staff match your search.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {rows.map(row => {
          const isExpanded = expandedId === row.staffMember.id;
          return (
            <MobileCard key={row.staffMember.id} onClick={() => setExpandedId(isExpanded ? null : row.staffMember.id)}>
              <MobileCard.Primary>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-850 truncate">
                    <span className="text-zinc-400 font-normal mr-1">{row.staffMember.number || ''}</span>
                    {row.staffMember.firstName} {row.staffMember.lastName}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {row.split.normal}h normal · {row.split.overtime}h OT
                    {row.hourlyRate === null && <span className="text-amber-600 font-bold"> · No rate</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn("text-sm font-black", row.pay.nett < 0 ? "text-red-600" : "text-zinc-900")}>{currency(row.pay.nett)}</span>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                </div>
              </MobileCard.Primary>

              {isExpanded && (
                <div className="pt-2 border-t border-zinc-100 space-y-3" onClick={(e) => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-2">
                    <AdjustmentField
                      label="Deductions"
                      value={row.deductions}
                      onCommit={(v) => onSetAdjustment(row.staffMember.id, period.periodKey, { deductions: v, shortPayment: row.shortPayment })}
                    />
                    <AdjustmentField
                      label="Short Payment"
                      value={row.shortPayment}
                      onCommit={(v) => onSetAdjustment(row.staffMember.id, period.periodKey, { deductions: row.deductions, shortPayment: v })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Timecard</p>
                    {row.periodLogs.map(log => (
                      <div key={log.id} className="flex items-center justify-between gap-2 bg-zinc-50 rounded-lg px-2.5 py-2 text-xs">
                        <span className="font-bold text-zinc-700 w-20 shrink-0">{getWeekdayShort(log.date)} {log.date.slice(5)}</span>
                        <span className="text-zinc-500 flex-1 truncate">{log.clockIn}–{log.clockOut}</span>
                        <span className="font-black text-zinc-800 shrink-0">{log.hours}h</span>
                        <MobileCardActionsMenu
                          actions={[
                            { label: 'Edit', icon: Edit2, onClick: () => setLogModal({ staffId: row.staffMember.id, editingLog: log }) },
                            { label: 'Delete', icon: Trash2, onClick: () => handleDelete(log.id), destructive: true },
                          ]}
                        />
                      </div>
                    ))}
                    {missingDaysFor(row.periodLogs).map(date => (
                      <button
                        key={date}
                        type="button"
                        title={`Add a time log for ${date}`}
                        onClick={() => setLogModal({ staffId: row.staffMember.id, date })}
                        className="w-full flex items-center justify-between gap-2 border border-dashed border-zinc-300 rounded-lg px-2.5 py-2 text-xs text-zinc-400 mobile-tap-target"
                      >
                        <span className="font-bold">{getWeekdayShort(date)} {date.slice(5)}</span>
                        <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Add</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </MobileCard>
          );
        })}
      </div>

      {logModal && (
        <TimeLogModalMobile
          staff={staff}
          settings={attendanceSettings}
          editingLog={logModal.editingLog}
          defaultStaffId={logModal.staffId}
          defaultDate={logModal.date}
          onSave={async (entry) => {
            if (logModal.editingLog) return await updateTimeLog(logModal.editingLog.id, entry);
            return await addTimeLog(entry);
          }}
          onClose={() => setLogModal(null)}
        />
      )}
    </>
  );
}

function AdjustmentField({ label, value, onCommit }: { label: string; value: number; onCommit: (value: number) => void }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</label>
      <input
        type="number"
        min="0"
        step="0.01"
        title={`${label} amount (R)`}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const n = Math.max(0, Number(local) || 0);
          setLocal(String(n));
          if (n !== value) onCommit(n);
        }}
        className="w-full px-2.5 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
      />
    </div>
  );
}
