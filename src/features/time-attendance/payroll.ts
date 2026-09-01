import { PayrollAdjustment, RateGroup, RateSettings, StaffMember, TimeAttendanceSettings, TimeLog } from '../../types';
import { PeriodRange } from './utils';

// A staff member's hourly rate, derived from their assigned rate group/tier
// (RateTier.ratePerQuarterHour * 4). Returns null when unassigned, so callers can
// distinguish "no rate configured" from "rate is zero".
export function getStaffHourlyRate(staff: StaffMember, rateGroups: RateGroup[]): number | null {
  if (!staff.rateGroupId || !staff.rateTierId) return null;
  const group = rateGroups.find(g => g.id === staff.rateGroupId);
  const tier = group?.tiers.find(t => t.id === staff.rateTierId);
  if (!tier) return null;
  return tier.ratePerQuarterHour * 4;
}

export interface PeriodHoursSplit {
  normal: number;
  overtime: number;
  total: number;
}

// Splits one staff member's logged hours for a single pay period into normal vs
// overtime against the configured threshold. Unlike splitOvertimeByDay (which walks
// day-by-day within a bucket for the chart), this operates on a single already-scoped
// period's logs directly, since the payroll table shows one period at a time.
export function splitPeriodHours(periodLogs: TimeLog[], overtimeThresholdHours: number): PeriodHoursSplit {
  const total = Math.round(periodLogs.reduce((sum, log) => sum + (log.hours || 0), 0) * 100) / 100;
  const normal = Math.min(total, overtimeThresholdHours);
  const overtime = Math.round((total - normal) * 100) / 100;
  return { normal: Math.round(normal * 100) / 100, overtime, total };
}

export interface StaffPeriodPay {
  normalPay: number;
  overtimePay: number;
  gross: number;
  nett: number;
}

// Deductions reduce the calculated salary (e.g. a stop order); shortPayment adds back
// on top of it (a correction for wages the staff member was previously short-paid).
export function calculateStaffPeriodPay(params: {
  normalHours: number;
  overtimeHours: number;
  hourlyRate: number;
  overtimeMultiplier: RateSettings['overtimeMultiplier'];
  deductions: number;
  shortPayment: number;
}): StaffPeriodPay {
  const { normalHours, overtimeHours, hourlyRate, overtimeMultiplier, deductions, shortPayment } = params;
  const normalPay = Math.round(normalHours * hourlyRate * 100) / 100;
  const overtimePay = Math.round(overtimeHours * hourlyRate * overtimeMultiplier * 100) / 100;
  const gross = Math.round((normalPay + overtimePay) * 100) / 100;
  const nett = Math.round((gross - deductions + shortPayment) * 100) / 100;
  return { normalPay, overtimePay, gross, nett };
}

export interface StaffPayrollRow {
  staffMember: StaffMember;
  periodLogs: TimeLog[];
  split: PeriodHoursSplit;
  hourlyRate: number | null;
  overtimeRate: number | null;
  deductions: number;
  shortPayment: number;
  pay: StaffPeriodPay;
}

// One row per staff member for a single pay period — the single source of truth behind
// both the interactive payroll table/list (desktop + mobile) and the printed report, so
// they can never drift apart on what a given period's numbers actually are.
export function buildPayrollRows(
  staff: StaffMember[],
  timeLogs: TimeLog[],
  rateGroups: RateGroup[],
  rateSettings: RateSettings,
  attendanceSettings: TimeAttendanceSettings,
  adjustments: PayrollAdjustment[],
  period: PeriodRange
): StaffPayrollRow[] {
  const adjustmentByKey = new Map<string, PayrollAdjustment>();
  adjustments.forEach(a => adjustmentByKey.set(`${a.staffId}_${a.periodKey}`, a));

  return staff.map(s => {
    const periodLogs = timeLogs
      .filter(l => l.staffId === s.id && l.date >= period.start && l.date <= period.end)
      .sort((a, b) => a.date.localeCompare(b.date));
    const split = splitPeriodHours(periodLogs, attendanceSettings.overtimeThresholdHours);
    const hourlyRate = getStaffHourlyRate(s, rateGroups);
    const overtimeRate = hourlyRate !== null ? Math.round(hourlyRate * rateSettings.overtimeMultiplier * 100) / 100 : null;
    const adjustment = adjustmentByKey.get(`${s.id}_${period.periodKey}`);
    const deductions = adjustment?.deductions ?? 0;
    const shortPayment = adjustment?.shortPayment ?? 0;
    const pay = calculateStaffPeriodPay({
      normalHours: split.normal,
      overtimeHours: split.overtime,
      hourlyRate: hourlyRate ?? 0,
      overtimeMultiplier: rateSettings.overtimeMultiplier,
      deductions,
      shortPayment,
    });
    return { staffMember: s, periodLogs, split, hourlyRate, overtimeRate, deductions, shortPayment, pay };
  });
}
