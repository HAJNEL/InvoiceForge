import { useEffect, useMemo, useState } from 'react';
import { X, Send, Loader2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../../core/hooks/useAuth';
import { PayrollSubmission, SimplePaySettings, TimeAttendanceSettings } from '../../../types';
import { PeriodRange } from '../utils';
import { StaffPayrollRow } from '../payroll';
import { usePayrollSubmissions } from '../hooks/usePayrollSubmissions';
import { listSimplePayEmployeePayslips, pushPayrollToSimplePay, SimplePayPayslipSummary } from '../../../lib/simplepay';

const currency = (n: number) => `R${n.toFixed(2)}`;

interface PayslipState {
  loading: boolean;
  payslips: SimplePayPayslipSummary[];
  selectedId: string | null;
  error?: string;
}

export function PushToSimplePayDialog({ rows, period, payInterval, simplePaySettings, onClose }: {
  rows: StaffPayrollRow[];
  period: PeriodRange;
  payInterval: TimeAttendanceSettings['payInterval'];
  simplePaySettings: SimplePaySettings | undefined;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { upsertSubmission } = usePayrollSubmissions();
  const [payslipsByStaffId, setPayslipsByStaffId] = useState<Record<string, PayslipState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only rows with a linked SimplePay employee id can be pushed - everything else
  // is shown but reported as skipped so nothing silently drops off a wages run.
  const linkedRows = useMemo(() => rows.filter(r => !!r.staffMember.simplePayEmployeeId), [rows]);
  const unlinkedRows = useMemo(() => rows.filter(r => !r.staffMember.simplePayEmployeeId), [rows]);

  useEffect(() => {
    let cancelled = false;
    linkedRows.forEach(row => {
      const employeeId = row.staffMember.simplePayEmployeeId!;
      setPayslipsByStaffId(prev => ({ ...prev, [row.staffMember.id]: { loading: true, payslips: [], selectedId: null } }));
      listSimplePayEmployeePayslips(employeeId).then(result => {
        if (cancelled) return;
        if (result.success) {
          const openPayslips = result.data.filter(p => !p.finalised);
          setPayslipsByStaffId(prev => ({
            ...prev,
            [row.staffMember.id]: {
              loading: false,
              payslips: result.data,
              selectedId: openPayslips.length === 1 ? openPayslips[0].id : null,
            },
          }));
        } else {
          setPayslipsByStaffId(prev => ({ ...prev, [row.staffMember.id]: { loading: false, payslips: [], selectedId: null, error: result.error } }));
        }
      });
    });
    return () => { cancelled = true; };
    // Only re-run when the set of linked staff for this period changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedRows.map(r => r.staffMember.id).join(',')]);

  const missingMapping = !simplePaySettings?.normalPayItemId || !simplePaySettings?.overtimePayItemId;
  const readyCount = linkedRows.filter(r => payslipsByStaffId[r.staffMember.id]?.selectedId).length;
  const canPush = !missingMapping && readyCount > 0 && !isSubmitting;

  const handlePush = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const lines = linkedRows.map(row => ({
        staffId: row.staffMember.id,
        simplePayEmployeeId: row.staffMember.simplePayEmployeeId,
        payslipId: payslipsByStaffId[row.staffMember.id]?.selectedId || undefined,
        normalPay: row.pay.normalPay,
        overtimePay: row.pay.overtimePay,
      }));
      const result = await pushPayrollToSimplePay(period.periodKey, lines);
      if (!result.success) {
        toast.error('Push failed', { description: result.error });
        return;
      }
      const submission: Omit<PayrollSubmission, 'id' | 'userId' | 'periodKey' | 'createdAt' | 'updatedAt'> = {
        periodLabel: period.label,
        payInterval,
        pushedAt: new Date().toISOString(),
        pushedBy: user.uid,
        status: result.status,
        lines: result.lines,
      };
      await upsertSubmission(period.periodKey, submission);

      const pushedCount = result.lines.filter(l => l.status === 'pushed').length;
      const failedCount = result.lines.filter(l => l.status === 'failed').length;
      if (result.status === 'success') {
        toast.success(`Pushed pay for ${pushedCount} staff member${pushedCount === 1 ? '' : 's'} to SimplePay.`);
      } else if (result.status === 'partial') {
        toast.warning(`Pushed ${pushedCount}, ${failedCount} failed`, { description: 'Check the payroll table for details.' });
      } else {
        toast.error('SimplePay rejected the push', { description: 'No lines were saved - check the payroll table for details.' });
      }
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-3xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-50 rounded-xl border border-sky-200">
              <Send className="w-4 h-4 text-sky-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">Push to SimplePay</h3>
              <p className="text-xs text-zinc-400">{period.label}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {missingMapping && (
            <div className="flex items-center gap-2 text-xs font-medium px-4 py-2.5 rounded-xl border text-amber-600 bg-amber-50/50 border-amber-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Set the Normal Pay and Overtime Pay item ids in Settings → Integrations before pushing.</span>
            </div>
          )}

          {linkedRows.length === 0 ? (
            <p className="text-sm text-zinc-400 py-8 text-center">No staff in this period have a SimplePay Employee ID set. Add one from Settings → Staff Members.</p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 border-b border-zinc-200">
                  <th className="px-3 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Staff Member</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Normal Pay</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">OT Pay</th>
                  <th className="px-3 py-2.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Draft Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {linkedRows.map(row => {
                  const state = payslipsByStaffId[row.staffMember.id];
                  return (
                    <tr key={row.staffMember.id}>
                      <td className="px-3 py-2.5 text-sm font-semibold text-zinc-800">{row.staffMember.firstName} {row.staffMember.lastName}</td>
                      <td className="px-3 py-2.5 text-sm text-zinc-700 text-right">{currency(row.pay.normalPay)}</td>
                      <td className="px-3 py-2.5 text-sm text-zinc-700 text-right">{currency(row.pay.overtimePay)}</td>
                      <td className="px-3 py-2.5">
                        {state?.loading ? (
                          <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin" />
                        ) : state?.error ? (
                          <span title={state.error} className="text-xs font-bold text-red-500 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Could not load payslips</span>
                        ) : state && state.payslips.filter(p => !p.finalised).length === 0 ? (
                          <span className="text-xs font-bold text-amber-600">No open payslip in SimplePay</span>
                        ) : (
                          <select
                            title="Which draft payslip to write this staff member's pay into"
                            value={state?.selectedId || ''}
                            onChange={(e) => setPayslipsByStaffId(prev => ({ ...prev, [row.staffMember.id]: { ...prev[row.staffMember.id], selectedId: e.target.value || null } }))}
                            className="w-full px-2 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
                          >
                            <option value="">Select payslip…</option>
                            {state?.payslips.filter(p => !p.finalised).map(p => (
                              <option key={p.id} value={p.id}>{p.date || p.id}{p.nettPay !== undefined ? ` · R${p.nettPay.toFixed(2)}` : ''}</option>
                            ))}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {unlinkedRows.length > 0 && (
            <div className="flex items-start gap-2 text-xs font-medium px-4 py-2.5 rounded-xl border text-zinc-500 bg-zinc-50 border-zinc-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{unlinkedRows.length} staff member{unlinkedRows.length === 1 ? '' : 's'} skipped - no SimplePay Employee ID set: {unlinkedRows.map(r => `${r.staffMember.firstName} ${r.staffMember.lastName}`).join(', ')}.</span>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50/30 shrink-0 flex items-center justify-between gap-2">
          <p className="text-xs text-zinc-400">{readyCount} of {linkedRows.length} linked staff ready to push.</p>
          <div className="flex items-center gap-2">
            <button type="button" title="Cancel" onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button
              type="button"
              title={canPush ? `Push pay for ${readyCount} staff member(s) to SimplePay` : 'Nothing is ready to push yet'}
              onClick={handlePush}
              disabled={!canPush}
              className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Push {readyCount} to SimplePay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
