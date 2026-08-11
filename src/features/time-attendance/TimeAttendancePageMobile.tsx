import { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Clock, Plus, Users, Loader2, AlertCircle, Inbox, Edit2, Trash2, Settings as SettingsIcon, BarChart3, LineChart as LineChartIcon, Search, X } from 'lucide-react';
import { StaffMember, TimeLog, TimeAttendanceSettings } from '../../types';
import { TimeLogEntry } from './hooks/useTimeLogs';
import { TimeLogModalMobile } from './components/TimeLogModalMobile';
import { BulkTimeLogDialogMobile } from './components/BulkTimeLogDialogMobile';
import { TimeAttendanceSettingsModalMobile } from './components/TimeAttendanceSettingsModalMobile';
import { MobileCard, MobileCardActionsMenu } from '../../components/mobile/MobileCard';
import { buildChartData, withAverageLine } from './TimeAttendancePage';
import { formatTimeRange } from './utils';
import { cn } from '../../lib/utils';

const WINDOWS = [
  { key: '7', label: '7D', days: 7 },
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 },
] as const;

export function TimeAttendancePageMobile({ staff, timeLogs, loading, error, attendanceSettings, onSaveSettings, addTimeLog, addTimeLogsBulk, updateTimeLog, deleteTimeLog }: {
  staff: StaffMember[];
  timeLogs: TimeLog[];
  loading: boolean;
  error: string | null;
  attendanceSettings: TimeAttendanceSettings;
  onSaveSettings: (settings: TimeAttendanceSettings) => Promise<boolean>;
  addTimeLog: (entry: TimeLogEntry) => Promise<unknown>;
  addTimeLogsBulk: (entries: TimeLogEntry[]) => Promise<boolean>;
  updateTimeLog: (id: string, entry: Partial<TimeLogEntry>) => Promise<boolean>;
  deleteTimeLog: (id: string) => Promise<boolean>;
}) {
  const [windowKey, setWindowKey] = useState<typeof WINDOWS[number]['key']>('7');
  const [chartView, setChartView] = useState<'bar' | 'line'>('bar');
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<TimeLog | null>(null);
  const [logSearch, setLogSearch] = useState('');
  const [logDateFilter, setLogDateFilter] = useState('');

  const activeWindow = WINDOWS.find(w => w.key === windowKey) || WINDOWS[0];
  const chartData = useMemo(
    () => buildChartData(timeLogs, activeWindow.days, attendanceSettings.payInterval, attendanceSettings.weekStartDay, attendanceSettings.overtimeThresholdHours),
    [timeLogs, activeWindow.days, attendanceSettings.payInterval, attendanceSettings.weekStartDay, attendanceSettings.overtimeThresholdHours]
  );
  const lineChartData = useMemo(() => withAverageLine(chartData), [chartData]);

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
    if (editingLog) return await updateTimeLog(editingLog.id, entry);
    return await addTimeLog(entry);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this time log?')) {
      await deleteTimeLog(id);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
          <Clock className="w-6 h-6 text-brand-accent shrink-0" />
          Time and Attendance
        </h1>
        <p className="text-xs text-zinc-500">Track staff clock in/out times and review logged hours.</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="Working Time Configuration"
          className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 transition-all shadow-2xs mobile-tap-target"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setIsBulkOpen(true)}
          title="Bulk Log Attendance"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-xs transition-all shadow-2xs mobile-tap-target"
        >
          <Users className="w-3.5 h-3.5 text-zinc-500" />
          Bulk Log
        </button>
        <button
          onClick={() => { setEditingLog(null); setIsLogOpen(true); }}
          title="Log Attendance"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs mobile-tap-target"
        >
          <Plus className="w-3.5 h-3.5" />
          Log
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black text-brand-primary uppercase tracking-tight">Hours Logged</p>
          <div className="flex items-center gap-1.5">
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
              <button
                type="button"
                title="Bar chart"
                onClick={() => setChartView('bar')}
                className={cn(
                  "p-1 rounded-md transition-all mobile-tap-target",
                  chartView === 'bar' ? "bg-white text-brand-primary shadow-xs" : "text-zinc-500"
                )}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                title="Line chart"
                onClick={() => setChartView('line')}
                className={cn(
                  "p-1 rounded-md transition-all mobile-tap-target",
                  chartView === 'line' ? "bg-white text-brand-primary shadow-xs" : "text-zinc-500"
                )}
              >
                <LineChartIcon className="w-3.5 h-3.5" />
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
                    "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all mobile-tap-target",
                    windowKey === w.key ? "bg-white text-brand-primary shadow-xs" : "text-zinc-500"
                  )}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {loading ? (
          <div className="h-[180px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
          </div>
        ) : (
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartView === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={9} tickLine={false} axisLine={false} dy={6} interval="preserveStartEnd" />
                  <YAxis stroke="#a1a1aa" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}h`} width={28} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [`${value} hours`, 'Hours']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="totalHours" name="totalHours" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              ) : (
                <RLineChart data={lineChartData} margin={{ top: 10, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={9} tickLine={false} axisLine={false} dy={6} interval="preserveStartEnd" />
                  <YAxis stroke="#a1a1aa" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}h`} width={28} />
                  <Tooltip
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name: any) => [`${value} hours`, name === 'average' ? 'Average' : 'Total']}
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                  />
                  <Legend
                    formatter={(value) => value === 'average' ? 'Average' : 'Total'}
                    wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                  />
                  <Line type="monotone" dataKey="totalHours" name="totalHours" stroke="#4f46e5" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="average" name="average" stroke="#f43f5e" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                </RLineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 shrink-0">Recent Logs</p>
          {hasLogFilters && (
            <button
              type="button"
              onClick={() => { setLogSearch(''); setLogDateFilter(''); }}
              title="Clear filters"
              className="p-1 text-zinc-400 mobile-tap-target"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 px-1">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder="Search staff member"
              title="Search logs by staff member"
              className="w-full pl-7 pr-2 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mobile-tap-target"
            />
          </div>
          <input
            type="date"
            value={logDateFilter}
            onChange={(e) => setLogDateFilter(e.target.value)}
            title="Filter logs by date"
            className="px-2 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mobile-tap-target"
          />
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <p className="text-xs text-zinc-500 mt-2">{error}</p>
          </div>
        ) : timeLogs.length === 0 ? (
          <div className="p-8 text-center">
            <Inbox className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
            <p className="text-zinc-400 text-xs">No time logs yet.</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center">
            <Inbox className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
            <p className="text-zinc-400 text-xs">No time logs match your filters.</p>
          </div>
        ) : (
          filteredLogs.slice(0, 50).map(log => (
            <MobileCard key={log.id}>
              <MobileCard.Primary>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-850">{staffNameById.get(log.staffId) || 'Unknown staff'}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{log.date}</p>
                </div>
                <MobileCard.Actions>
                  <MobileCardActionsMenu
                    actions={[
                      { label: 'Edit', icon: Edit2, onClick: () => { setEditingLog(log); setIsLogOpen(true); } },
                      { label: 'Delete', icon: Trash2, onClick: () => handleDelete(log.id), destructive: true },
                    ]}
                  />
                </MobileCard.Actions>
              </MobileCard.Primary>
              <MobileCard.Secondary>
                <span>{log.clockIn} – {log.clockOut}</span>
                {(log.teaBreak || log.lunchBreak) && (
                  <span>{[
                    log.teaBreak && log.teaBreakStart && log.teaBreakEnd && `Tea ${formatTimeRange(log.teaBreakStart, log.teaBreakEnd)}`,
                    log.lunchBreak && log.lunchBreakStart && log.lunchBreakEnd && `Lunch ${formatTimeRange(log.lunchBreakStart, log.lunchBreakEnd)}`,
                  ].filter(Boolean).join(', ')}</span>
                )}
                <span className="font-black text-zinc-700">{log.hours}h</span>
              </MobileCard.Secondary>
            </MobileCard>
          ))
        )}
      </div>

      {isLogOpen && (
        <TimeLogModalMobile
          staff={staff}
          settings={attendanceSettings}
          editingLog={editingLog}
          onSave={handleSaveLog}
          onClose={() => { setIsLogOpen(false); setEditingLog(null); }}
        />
      )}
      {isBulkOpen && (
        <BulkTimeLogDialogMobile staff={staff} settings={attendanceSettings} onSaveBulk={addTimeLogsBulk} onClose={() => setIsBulkOpen(false)} />
      )}
      {isSettingsOpen && (
        <TimeAttendanceSettingsModalMobile
          settings={attendanceSettings}
          onSave={onSaveSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
