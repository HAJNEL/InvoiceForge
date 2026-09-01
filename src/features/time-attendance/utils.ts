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
// pay interval: each day for 'daily', each weekStartDay-aligned week for 'weekly', a paired
// two-week window for 'fortnightly', or the calendar month for 'monthly'.
export function getBucketKey(date: string, payInterval: TimeAttendanceSettings['payInterval'], weekStartDay: number): string {
  if (payInterval === 'daily') return date;
  if (payInterval === 'weekly') return getWeekKey(date, weekStartDay);
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

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "Mon" for a "YYYY-MM-DD" date key.
export function getWeekdayShort(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return WEEKDAY_SHORT[d.getDay()];
}

// "Mon, 2026-08-24" — the weekday name alongside a "YYYY-MM-DD" date key, for timecard
// breakdown rows where the raw date alone doesn't say which day of the week it was.
export function formatDateWithWeekday(dateKey: string): string {
  return `${getWeekdayShort(dateKey)}, ${dateKey}`;
}

// Every date (inclusive) between start and end, as "YYYY-MM-DD" local date keys.
export function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  while (cursor <= endDate) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

function addMonths(dateKey: string, months: number): string {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return toDateKey(d);
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatShort(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function formatWithYear(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

// Standard ISO 8601 week number (weeks start Monday; week 1 contains the year's first
// Thursday) for the week containing `dateKey`. Used only for display ("Week 35"),
// independent of the account's configured weekStartDay.
export function getIsoWeekNumber(dateKey: string): number {
  const d = new Date(`${dateKey}T00:00:00`);
  const dayNum = (d.getDay() + 6) % 7; // Mon=0 .. Sun=6
  d.setDate(d.getDate() - dayNum + 3); // Thursday of this ISO week
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const firstDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
}

export interface PeriodRange {
  start: string;
  end: string;
  periodKey: string;
  label: string;
  // Set for weekly periods only — the ISO week number, for a "WAGES FOR THE WEEK 35"
  // style title on the printed payroll report.
  weekNumber?: number;
}

// Computes the inclusive [start,end] date range for the pay period `offset` steps away from
// the one containing `anchor` (0 = current period, -1 = previous, +1 = next), plus a stable
// periodKey matching getBucketKey's bucketing (so a saved PayrollAdjustment survives
// navigating away and back) and a human-readable label for the period stepper.
export function getPeriodRange(
  payInterval: TimeAttendanceSettings['payInterval'],
  weekStartDay: number,
  anchor: Date,
  offset: number
): PeriodRange {
  const anchorKey = toDateKey(anchor);

  if (payInterval === 'daily') {
    const day = addDays(anchorKey, offset);
    return { start: day, end: day, periodKey: day, label: formatWithYear(day) };
  }

  if (payInterval === 'monthly') {
    const monthAnchor = addMonths(anchorKey, offset);
    const d = new Date(`${monthAnchor}T00:00:00`);
    const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    const end = toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return { start, end, periodKey: getMonthKey(start), label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}` };
  }

  if (payInterval === 'fortnightly') {
    const ws = weekStartDate(anchorKey, weekStartDay);
    const epoch = new Date('1970-01-01T00:00:00Z');
    const daysSinceEpoch = Math.floor((ws.getTime() - epoch.getTime()) / MS_PER_DAY);
    const fortnightIndex = Math.floor(daysSinceEpoch / 14) + offset;
    const start = toDateKey(new Date(epoch.getTime() + fortnightIndex * 14 * MS_PER_DAY));
    const end = addDays(start, 13);
    return { start, end, periodKey: `fn-${fortnightIndex}`, label: `${formatShort(start)} – ${formatWithYear(end)}` };
  }

  // weekly
  const start = addDays(toDateKey(weekStartDate(anchorKey, weekStartDay)), offset * 7);
  const end = addDays(start, 6);
  const weekNumber = getIsoWeekNumber(start);
  return {
    start, end,
    periodKey: getWeekKey(start, weekStartDay),
    label: `Week ${weekNumber} · ${formatShort(start)} – ${formatWithYear(end)}`,
    weekNumber,
  };
}
