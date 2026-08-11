import { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Clock, Plus, Users, Loader2, AlertCircle, Inbox, Edit2, Trash2, Check, X, Settings as SettingsIcon, BarChart3, LineChart as LineChartIcon, Search } from 'lucide-react';
import { useStaff } from '../staff/hooks/useStaff';
import { useSettings } from '../settings/hooks/useSettings';
import { useTimeLogs, TimeLogEntry } from './hooks/useTimeLogs';
import { TimeLog, TimeAttendanceSettings } from '../../types';
import { TimeLogModal } from './components/TimeLogModal';
import { BulkTimeLogDialog } from './components/BulkTimeLogDialog';
import { TimeAttendanceSettingsModal } from './components/TimeAttendanceSettingsModal';
import { TimeAttendancePageMobile } from './TimeAttendancePageMobile';
import { DEFAULT_TIME_ATTENDANCE_SETTINGS } from './constants';
import { splitOvertimeByDay, formatTimeRange } from './utils';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cn } from '../../lib/utils';

const WINDOWS = [
  { key: '7', label: 'Last 7 Days', days: 7 },
  { key: '30', label: 'Last 30 Days', days: 30 },
  { key: '90', label: 'Last 90 Days', days: 90 },
] as const;

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

export function TimeAttendancePage() {
  const { staff } = useStaff();
  const { settings: appSettings, saveSettings } = useSettings();
  const { timeLogs, loading, error, addTimeLog, addTimeLogsBulk, updateTimeLog, deleteTimeLog } = useTimeLogs();

  // Merge over defaults so a config saved before a settings-field rename/addition doesn't
  // leave newer fields undefined.
  const attendanceSettings: TimeAttendanceSettings = { ...DEFAULT_TIME_ATTENDANCE_SETTINGS, ...appSettings?.timeAttendance };

  const [windowKey, setWindowKey] = useState<typeof WINDOWS[number]['key']>('7');
  const [chartView, setChartView] = useState<'bar' | 'line'>('bar');
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logSearch, setLogSearch] = useState('');
  const [logDateFilter, setLogDateFilter] = useState('');

  const activeWindow = WINDOWS.find(w => w.key === windowKey) || WINDOWS[0];
  const chartData = useMemo(
    () => buildChartData(timeLogs, activeWindow.days, attendanceSettings.payInterval, attendanceSettings.weekStartDay, attendanceSettings.overtimeThresholdHours),
    [timeLogs, activeWindow.days, attendanceSettings.payInterval, attendanceSettings.weekStartDay, attendanceSettings.overtimeThresholdHours]
  );
  const lineChartData = useMemo(() => withAverageLine(chartData), [chartData]);

  const handleSaveSettings = async (updated: TimeAttendanceSettings) => {
    return await saveSettings({ timeAttendance: updated });
  };

  const staffNameById = useMemo(() => {
    const map = new Map<string, string>();
    staff.forEach(s => map.set(s.id, `${s.firstName} ${s.lastName}`));
    return map;
  }, [staff]);

  const filteredLogs = useMemo(() => {
    const query = logSearch.trim().toLowerCase();
    return timeLogs.filter(log => {
      if (logDateFilter && log.date !== logDateFilter) return false;
      if (query && !(staffNameById.get(log.staffId) || '').toLowerCase().includes(query)) return false;
      return true;
    });
  }, [timeLogs, logSearch, logDateFilter, staffNameById]);

  const hasLogFilters = logSearch.trim() !== '' || logDateFilter !== '';

  const handleSaveLog = async (entry: TimeLogEntry) => {
    if (editingLog) {
      return await updateTimeLog(editingLog.id, entry);
    }
    return await addTimeLog(entry);
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const ok = await deleteTimeLog(id);
      if (ok) setDeleteConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <TimeAttendancePageMobile
        staff={staff}
        timeLogs={timeLogs}
        loading={loading}
        error={error}
        attendanceSettings={attendanceSettings}
        onSaveSettings={handleSaveSettings}
        addTimeLog={addTimeLog}
        addTimeLogsBulk={addTimeLogsBulk}
        updateTimeLog={updateTimeLog}
        deleteTimeLog={deleteTimeLog}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Clock className="w-7 h-7 text-brand-accent shrink-0" />
            Time and Attendance
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Track staff clock in/out times and review logged hours.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Working Time Configuration"
            className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-all shadow-2xs cursor-pointer"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsBulkOpen(true)}
            title="Bulk Log Attendance"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-semibold text-sm transition-all shadow-2xs cursor-pointer"
          >
            <Users className="w-4 h-4 text-zinc-500" />
            Bulk Log
          </button>
          <button
            onClick={() => { setEditingLog(null); setIsLogOpen(true); }}
            title="Log Attendance"
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Log
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black text-brand-primary uppercase tracking-tight">Hours Logged</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
              <button
                type="button"
                title="Bar chart"
                onClick={() => setChartView('bar')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  chartView === 'bar' ? "bg-white text-brand-primary shadow-xs" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Line chart"
                onClick={() => setChartView('line')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  chartView === 'line' ? "bg-white text-brand-primary shadow-xs" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
              {WINDOWS.map(w => (
                <button
                  key={w.key}
                  type="button"
                  title={w.label}
                  onClick={() => setWindowKey(w.key)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-md transition-all",
                    windowKey === w.key ? "bg-white text-brand-primary shadow-xs" : "text-zinc-500 hover:text-zinc-700"
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
          </div>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                  <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}h`} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`${value} hours`, 'Hours']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="totalHours" name="totalHours" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={50} />
                </BarChart>
              ) : (
                <RLineChart data={lineChartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                  <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}h`} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [`${value} hours`, name === 'average' ? 'Average' : 'Total']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Legend
                    formatter={(value) => value === 'average' ? 'Average' : 'Total'}
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="totalHours" name="totalHours" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="average" name="average" stroke="#f43f5e" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                </RLineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-zinc-200 bg-zinc-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-400 shrink-0">Recent Logs</p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search staff member"
                title="Search logs by staff member"
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 w-48"
              />
            </div>
            <input
              type="date"
              value={logDateFilter}
              onChange={(e) => setLogDateFilter(e.target.value)}
              title="Filter logs by date"
              className="px-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
            />
            {hasLogFilters && (
              <button
                type="button"
                onClick={() => { setLogSearch(''); setLogDateFilter(''); }}
                title="Clear filters"
                className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
          </div>
        ) : error ? (
          <div className="p-16 text-center max-w-lg mx-auto">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
            <p className="text-sm text-zinc-500 mt-2">{error}</p>
          </div>
        ) : timeLogs.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No time logs yet.</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-16 text-center">
            <Inbox className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No time logs match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/70 border-b border-zinc-200">
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Staff Member</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Clock In</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Clock Out</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Breaks</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Hours</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[110px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredLogs.slice(0, 100).map(log => (
                  <tr key={log.id} className="hover:bg-zinc-50/40 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-zinc-700 whitespace-nowrap">{log.date}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-zinc-850">{staffNameById.get(log.staffId) || 'Unknown staff'}</td>
                    <td className="px-5 py-3.5 text-sm text-zinc-600">{log.clockIn}</td>
                    <td className="px-5 py-3.5 text-sm text-zinc-600">{log.clockOut}</td>
                    <td className="px-5 py-3.5 text-xs text-zinc-500">
                      {[
                        log.teaBreak && log.teaBreakStart && log.teaBreakEnd && `Tea ${formatTimeRange(log.teaBreakStart, log.teaBreakEnd)}`,
                        log.lunchBreak && log.lunchBreakStart && log.lunchBreakEnd && `Lunch ${formatTimeRange(log.lunchBreakStart, log.lunchBreakEnd)}`,
                      ].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-black text-zinc-800 text-right">{log.hours}h</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setEditingLog(log); setIsLogOpen(true); }}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                          title="Edit log"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === log.id ? (
                          <>
                            <button
                              type="button"
                              title="Confirm delete"
                              onClick={() => handleDelete(log.id)}
                              disabled={busyId === log.id}
                              className="p-1.5 text-white bg-red-500 rounded-lg border border-red-600 transition-all disabled:opacity-50"
                            >
                              {busyId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              title="Cancel delete"
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(log.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete log"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isLogOpen && (
        <TimeLogModal
          staff={staff}
          settings={attendanceSettings}
          editingLog={editingLog}
          onSave={handleSaveLog}
          onClose={() => { setIsLogOpen(false); setEditingLog(null); }}
        />
      )}
      {isBulkOpen && (
        <BulkTimeLogDialog staff={staff} settings={attendanceSettings} onSaveBulk={addTimeLogsBulk} onClose={() => setIsBulkOpen(false)} />
      )}
      {isSettingsOpen && (
        <TimeAttendanceSettingsModal
          settings={attendanceSettings}
          onSave={handleSaveSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
