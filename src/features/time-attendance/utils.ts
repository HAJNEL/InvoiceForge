import { TimeLog, TimeAttendanceSettings } from '../../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function computeHours(clockIn: string, clockOut: string, breakMinutes = 0): number {
  const [inH, inM] = clockIn.split(':').map(Number);
  const [outH, outM] = clockOut.split(':').map(Number);
  if ([inH, inM, outH, outM].some(n => Number.isNaN(n))) return 0;
  const minutes = (outH * 60 + outM) - (inH * 60 + inM) - breakMinutes;
  return Math.max(0, Math.round((minutes / 60) * 100) / 100);
}

// Duration in minutes between two "HH:MM" times, e.g. a configured tea/lunch break window.
export function getMinutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return 0;
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

export function formatTimeRange(start: string, end: string): string {
  return `${start}–${end}`;
}

function weekStartDate(date: string, weekStartDay: number): Date {
  const d = new Date(`${date}T00:00:00`);
  const diff = (d.getDay() - weekStartDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  return d;
}

// Local (not UTC) week-start date key for the 7-day window containing `date`,
// anchored on weekStartDay (0=Sunday..6=Saturday).
export function getWeekKey(date: string, weekStartDay: number): string {
  return weekStartDate(date, weekStartDay).toISOString().slice(0, 10);
}

// Pairs consecutive weekStartDay-aligned weeks into a stable fortnight bucket. The pairing
// boundary is anchored to a fixed epoch (not a configurable "fortnight start date"), so it's
// deterministic but may not line up with a specific payroll calendar's actual fortnight cut.
function getFortnightKey(date: string, weekStartDay: number): string {
  const ws = weekStartDate(date, weekStartDay);
  const epoch = new Date('1970-01-01T00:00:00Z');
  const daysSinceEpoch = Math.floor((ws.getTime() - epoch.getTime()) / MS_PER_DAY);
  const fortnightIndex = Math.floor(daysSinceEpoch / 14);
  return `fn-${fortnightIndex}`;
}

function getMonthKey(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Groups a date into the bucket its overtime threshold resets on, matching the configured
// pay interval: each day for 'daily', a paired two-week window for 'fortnightly', or the
// calendar month for 'monthly'.
export function getBucketKey(date: string, payInterval: TimeAttendanceSettings['payInterval'], weekStartDay: number): string {
  if (payInterval === 'daily') return date;
  if (payInterval === 'monthly') return getMonthKey(date);
  return getFortnightKey(date, weekStartDay);
}

export interface DaySplit {
  normal: number;
  overtime: number;
}

// Allocates each day's logged hours into "normal" vs "overtime" by walking days in
// chronological order within each pay-interval bucket and crediting hours against the
// threshold as it's consumed — so a day only shows overtime once the bucket's earlier days
// have already used up the threshold.
export function splitOvertimeByDay(
  timeLogs: TimeLog[],
  payInterval: TimeAttendanceSettings['payInterval'],
  weekStartDay: number,
  overtimeThresholdHours: number
): Map<string, DaySplit> {
  const hoursByDate = new Map<string, number>();
  for (const log of timeLogs) {
    hoursByDate.set(log.date, (hoursByDate.get(log.date) || 0) + (log.hours || 0));
  }

  const dates = [...hoursByDate.keys()].sort();
  const bucketRunning = new Map<string, number>();
  const result = new Map<string, DaySplit>();

  for (const date of dates) {
    const bucketKey = getBucketKey(date, payInterval, weekStartDay);
    const dayHours = hoursByDate.get(date)!;
    const runningBefore = bucketRunning.get(bucketKey) || 0;
    const remaining = Math.max(0, overtimeThresholdHours - runningBefore);
    const normal = Math.min(dayHours, remaining);
    const overtime = dayHours - normal;
    result.set(date, {
      normal: Math.round(normal * 100) / 100,
      overtime: Math.round(overtime * 100) / 100,
    });
    bucketRunning.set(bucketKey, runningBefore + dayHours);
  }

  return result;
}
