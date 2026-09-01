import { TimeLog, TimeAttendanceSettings } from '../../types';
import { splitOvertimeByDay } from './utils';

export interface ChartPoint {
  name: string;
  date: string;
  normalHours: number;
  overtimeHours: number;
  totalHours: number;
}

export function buildChartData(timeLogs: TimeLog[], days: number, payInterval: TimeAttendanceSettings['payInterval'], weekStartDay: number, overtimeThresholdHours: number): ChartPoint[] {
  const splits = splitOvertimeByDay(timeLogs, payInterval, weekStartDay, overtimeThresholdHours);
  const today = new Date();
  const points: ChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const split = splits.get(key);
    const normalHours = split?.normal || 0;
    const overtimeHours = split?.overtime || 0;
    points.push({ name: `${d.getDate()}/${d.getMonth() + 1}`, date: key, normalHours, overtimeHours, totalHours: Math.round((normalHours + overtimeHours) * 100) / 100 });
  }
  return points;
}

// Flat "average" series value repeated across every point, so it renders as a
// horizontal reference line comparing each day's total against the window's mean.
export function withAverageLine(points: ChartPoint[]) {
  const avg = points.length === 0
    ? 0
    : Math.round((points.reduce((sum, p) => sum + p.totalHours, 0) / points.length) * 100) / 100;
  return points.map(p => ({ ...p, average: avg }));
}
