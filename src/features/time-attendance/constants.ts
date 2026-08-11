import { TimeAttendanceSettings } from '../../types';

export const DEFAULT_TIME_ATTENDANCE_SETTINGS: TimeAttendanceSettings = {
  checkInTime: '08:00',
  checkOutTime: '17:00',
  teaBreakStart: '10:00',
  teaBreakEnd: '10:15',
  teaBreakEnabledByDefault: false,
  lunchBreakStart: '13:00',
  lunchBreakEnd: '14:00',
  lunchBreakEnabledByDefault: false,
  weekStartDay: 1, // Monday
  weekEndDay: 5,   // Friday
  payInterval: 'monthly',
  overtimeThresholdHours: 45,
};

export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const PAY_INTERVAL_OPTIONS: { value: TimeAttendanceSettings['payInterval']; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
];

// Unit shown next to the overtime threshold input/label, matching the selected pay interval.
export const OVERTIME_UNIT_LABEL: Record<TimeAttendanceSettings['payInterval'], string> = {
  daily: 'hrs/day',
  fortnightly: 'hrs/fortnight',
  monthly: 'hrs/month',
};
