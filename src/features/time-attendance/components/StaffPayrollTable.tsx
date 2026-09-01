import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus, Check, X, Loader2, Inbox } from 'lucide-react';
import { StaffMember, TimeLog, TimeAttendanceSettings, RateGroup, RateSettings, PayrollAdjustment } from '../../../types';
import { TimeLogEntry } from '../hooks/useTimeLogs';
import { PayrollAdjustmentEntry } from '../hooks/usePayrollAdjustments';
import { PeriodRange, getDatesInRange, formatDateWithWeekday } from '../utils';
import { buildPayrollRows } from '../payroll';
import { TimeLogModal } from './TimeLogModal';
import { cn } from '../../../lib/utils';

const currency = (n: number) => `R${n.toFixed(2)}`;

export function StaffPayrollTable({
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const rows = useMemo(
    () => buildPayrollRows(staff, timeLogs, rateGroups, rateSettings, attendanceSettings, adjustments, period),
    [staff, timeLogs, rateGroups, rateSettings, attendanceSettings, adjustments, period]
  );

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    normal: acc.normal + r.split.normal,
    overtime: acc.overtime + r.split.overtime,
    total: acc.total + r.split.total,
    deductions: acc.deductions + r.deductions,
    shortPayment: acc.shortPayment + r.shortPayment,
    nett: acc.nett + r.pay.nett,
  }), { normal: 0, overtime: 0, total: 0, deductions: 0, shortPayment: 0, nett: 0 }), [rows]);

  const commitAdjustment = (staffId: string, field: 'deductions' | 'shortPayment', value: number, current: { deductions: number; shortPayment: number }) => {
    onSetAdjustment(staffId, period.periodKey, { ...current, [field]: value });
  };

  const handleDeleteLog = async (id: string) => {
    setBusyId(id);
    try {
      const ok = await deleteTimeLog(id);
      if (ok) setDeleteConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

  const missingDaysFor = (periodLogs: TimeLog[]) => {
    const loggedDates = new Set(periodLogs.map(l => l.date));
    return getDatesInRange(period.start, period.end).filter(d => {
      const dow = new Date(`${d}T00:00:00`).getDay();
      return attendanceSettings.workingDays.includes(dow) && !loggedDates.has(d);
    });
  };

  if (staff.length === 0) {
    return (
      <div className="p-16 text-center">
        <Inbox className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
        <p className="text-zinc-400 text-sm">No staff match your search.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50/70 border-b border-zinc-200">
              <th className="px-3 py-3.5 w-8"></th>
              <th className="px-3 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Staff Member</th>
              <th className="px-3 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Normal Hrs</th>
              <th className="px-3 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">OT Hrs</th>
              <th className="px-3 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Total Hrs</th>
              <th className="px-3 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Rate</th>
              <th className="px-3 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">OT Rate</th>
              <th className="px-3 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Deductions</th>
              <th className="px-3 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Short Payment</th>
              <th className="px-3 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Nett Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row, idx) => {
              const isExpanded = expandedId === row.staffMember.id;
              return (
                <Fragment key={row.staffMember.id}>
                  <tr className="hover:bg-zinc-50/40 transition-colors">
                    <td className="px-3 py-3.5">
                      <button
                        type="button"
                        title={isExpanded ? 'Collapse timecard' : 'Expand timecard'}
                        onClick={() => setExpandedId(isExpanded ? null : row.staffMember.id)}
                        className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-3.5 text-sm font-semibold text-zinc-850">
                      <span className="text-zinc-400 font-normal mr-1.5">{row.staffMember.number || idx + 1}</span>
                      {row.staffMember.firstName} {row.staffMember.lastName}
                    </td>
                    <td className="px-3 py-3.5 text-sm text-zinc-700 text-right">{row.split.normal}h</td>
                    <td className="px-3 py-3.5 text-sm text-zinc-700 text-right">{row.split.overtime}h</td>
                    <td className="px-3 py-3.5 text-sm font-black text-zinc-800 text-right">{row.split.total}h</td>
                    <td className="px-3 py-3.5 text-sm text-zinc-600 text-right">
                      {row.hourlyRate !== null ? currency(row.hourlyRate) : <span title="Assign a rate group/tier to this staff member" className="text-amber-600 text-xs font-bold">No rate</span>}
                    </td>
                    <td className="px-3 py-3.5 text-sm text-zinc-600 text-right">{row.overtimeRate !== null ? currency(row.overtimeRate) : '—'}</td>
                    <td className="px-3 py-3.5 text-right">
                      <AdjustmentInput
                        value={row.deductions}
                        onCommit={(v) => commitAdjustment(row.staffMember.id, 'deductions', v, { deductions: row.deductions, shortPayment: row.shortPayment })}
                      />
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <AdjustmentInput
                        value={row.shortPayment}
                        onCommit={(v) => commitAdjustment(row.staffMember.id, 'shortPayment', v, { deductions: row.deductions, shortPayment: row.shortPayment })}
                      />
                    </td>
                    <td className={cn("px-3 py-3.5 text-sm font-black text-right", row.pay.nett < 0 ? "text-red-600" : "text-zinc-900")}>{currency(row.pay.nett)}</td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={10} className="bg-zinc-50/60 px-8 py-4">
                        <TimecardBreakdown
                          logs={row.periodLogs}
                          missingDays={missingDaysFor(row.periodLogs)}
                          deleteConfirmId={deleteConfirmId}
                          busyId={busyId}
                          onEdit={(log) => setLogModal({ staffId: row.staffMember.id, editingLog: log })}
                          onAdd={(date) => setLogModal({ staffId: row.staffMember.id, date })}
                          onDeleteRequest={setDeleteConfirmId}
                          onDeleteCancel={() => setDeleteConfirmId(null)}
                          onDeleteConfirm={handleDeleteLog}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-50 border-t-2 border-zinc-200 font-black text-zinc-800">
              <td></td>
              <td className="px-3 py-3.5 text-xs uppercase tracking-wider">Totals</td>
              <td className="px-3 py-3.5 text-sm text-right">{Math.round(totals.normal * 100) / 100}h</td>
              <td className="px-3 py-3.5 text-sm text-right">{Math.round(totals.overtime * 100) / 100}h</td>
              <td className="px-3 py-3.5 text-sm text-right">{Math.round(totals.total * 100) / 100}h</td>
              <td></td>
              <td></td>
              <td className="px-3 py-3.5 text-sm text-right">{currency(totals.deductions)}</td>
              <td className="px-3 py-3.5 text-sm text-right">{currency(totals.shortPayment)}</td>
              <td className={cn("px-3 py-3.5 text-sm text-right", totals.nett < 0 ? "text-red-600" : "text-zinc-900")}>{currency(totals.nett)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {logModal && (
        <TimeLogModal
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

// Debounced-on-blur currency input: keeps a local editable string so the field doesn't
// re-render (and jump the cursor) on every keystroke, only committing on blur/change.
function AdjustmentInput({ value, onCommit }: { value: number; onCommit: (value: number) => void }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);

  return (
    <input
      type="number"
      min="0"
      step="0.01"
      title="Amount (R)"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        const n = Math.max(0, Number(local) || 0);
        setLocal(String(n));
        if (n !== value) onCommit(n);
      }}
      className="w-24 px-2 py-1.5 text-sm text-right border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
    />
  );
}

function TimecardBreakdown({ logs, missingDays, deleteConfirmId, busyId, onEdit, onAdd, onDeleteRequest, onDeleteCancel, onDeleteConfirm }: {
  logs: TimeLog[];
  missingDays: string[];
  deleteConfirmId: string | null;
  busyId: string | null;
  onEdit: (log: TimeLog) => void;
  onAdd: (date: string) => void;
  onDeleteRequest: (id: string) => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: (id: string) => void;
}) {
  if (logs.length === 0 && missingDays.length === 0) {
    return <p className="text-xs text-zinc-400 py-2">No working days in this period.</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Timecard</p>
      {logs.map(log => (
        <div key={log.id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-zinc-200 px-3 py-2 text-xs">
          <span className="font-bold text-zinc-700 w-32 shrink-0">{formatDateWithWeekday(log.date)}</span>
          <span className="text-zinc-500 flex-1">{log.clockIn} – {log.clockOut}</span>
          <span className="font-black text-zinc-800 w-12 text-right shrink-0">{log.hours}h</span>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" title="Edit entry" onClick={() => onEdit(log)} className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {deleteConfirmId === log.id ? (
              <>
                <button type="button" title="Confirm delete" onClick={() => onDeleteConfirm(log.id)} disabled={busyId === log.id} className="p-1 text-white bg-red-500 rounded-md border border-red-600 disabled:opacity-50">
                  {busyId === log.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </button>
                <button type="button" title="Cancel delete" onClick={onDeleteCancel} className="p-1 text-zinc-400 hover:text-zinc-600 rounded-md border border-transparent hover:border-zinc-200">
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <button type="button" title="Delete entry" onClick={() => onDeleteRequest(log.id)} className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
      {missingDays.map(date => (
        <button
          key={date}
          type="button"
          title={`Add a time log for ${date}`}
          onClick={() => onAdd(date)}
          className="w-full flex items-center justify-between gap-3 border border-dashed border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-400 hover:text-brand-accent hover:border-brand-accent/40 transition-colors cursor-pointer"
        >
          <span className="font-bold">{formatDateWithWeekday(date)}</span>
          <span className="flex items-center gap-1"><Plus className="w-3 h-3" /> Add entry</span>
        </button>
      ))}
    </div>
  );
}
