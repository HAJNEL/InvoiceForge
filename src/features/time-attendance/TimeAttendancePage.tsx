import { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Clock, Plus, Users, Loader2, AlertCircle, Settings as SettingsIcon, BarChart3, LineChart as LineChartIcon, Search, Download, Table2, Eye } from 'lucide-react';
import { useStaff } from '../staff/hooks/useStaff';
import { useSettings } from '../settings/hooks/useSettings';
import { useRateGroups } from '../settings/hooks/useRateGroups';
import { useTimeLogs } from './hooks/useTimeLogs';
import { usePayrollAdjustments } from './hooks/usePayrollAdjustments';
import { TimeAttendanceSettings, RateSettings } from '../../types';
import { buildChartData, withAverageLine } from './chartData';
import { TimeLogModal } from './components/TimeLogModal';
import { BulkTimeLogDialog } from './components/BulkTimeLogDialog';
import { TimeAttendanceSettingsModal } from './components/TimeAttendanceSettingsModal';
import { PeriodStepper } from './components/PeriodStepper';
import { StaffPayrollTable } from './components/StaffPayrollTable';
import { AttendanceRegisterTable } from './components/AttendanceRegisterTable';
import { TimeAttendancePageMobile } from './TimeAttendancePageMobile';
import { DEFAULT_TIME_ATTENDANCE_SETTINGS } from './constants';
import { DEFAULT_RATE_SETTINGS } from '../settings/rateConstants';
import { getPeriodRange } from './utils';
import { buildPayrollRows } from './payroll';
import { printPayrollReport, printAttendanceRegisterReport, buildPayrollReportHtml, buildAttendanceRegisterReportHtml } from './printPayrollReport';
import { ExportOptionsDialog, PayrollExportType } from './components/ExportOptionsDialog';
import { ReportPreviewDialog } from './components/ReportPreviewDialog';
import { useIsMobile } from '../../hooks/useIsMobile';
import { cn } from '../../lib/utils';

const WINDOWS = [
  { key: '7', label: 'Last 7 Days', days: 7 },
  { key: '30', label: 'Last 30 Days', days: 30 },
  { key: '90', label: 'Last 90 Days', days: 90 },
] as const;

export function TimeAttendancePage() {
  const { staff } = useStaff();
  const { settings: appSettings, saveSettings } = useSettings();
  const { timeLogs, loading, error, addTimeLog, addTimeLogsBulk, updateTimeLog, deleteTimeLog } = useTimeLogs();
  const { rateGroups, loading: rateGroupsLoading, addRateGroup, updateRateGroup, deleteRateGroup } = useRateGroups();
  const { adjustments, setAdjustment } = usePayrollAdjustments();

  // Merge over defaults so a config saved before a settings-field rename/addition doesn't
  // leave newer fields undefined.
  const attendanceSettings: TimeAttendanceSettings = { ...DEFAULT_TIME_ATTENDANCE_SETTINGS, ...appSettings?.timeAttendance };
  const rateSettings: RateSettings = { ...DEFAULT_RATE_SETTINGS, ...appSettings?.rateSettings };

  const [windowKey, setWindowKey] = useState<typeof WINDOWS[number]['key']>('7');
  const [chartView, setChartView] = useState<'register' | 'bar' | 'line'>('bar');
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isPreviewChooserOpen, setIsPreviewChooserOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<{ title: string; html: string } | null>(null);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [staffSearch, setStaffSearch] = useState('');

  const activeWindow = WINDOWS.find(w => w.key === windowKey) || WINDOWS[0];
  const chartData = useMemo(
    () => buildChartData(timeLogs, activeWindow.days, attendanceSettings.payInterval, attendanceSettings.weekStartDay, attendanceSettings.overtimeThresholdHours),
    [timeLogs, activeWindow.days, attendanceSettings.payInterval, attendanceSettings.weekStartDay, attendanceSettings.overtimeThresholdHours]
  );
  const lineChartData = useMemo(() => withAverageLine(chartData), [chartData]);

  const handleSaveSettings = async (updated: TimeAttendanceSettings) => {
    return await saveSettings({ timeAttendance: updated });
  };

  const handleSaveRateSettings = async (updated: RateSettings) => {
    return await saveSettings({ rateSettings: updated });
  };

  const period = useMemo(
    () => getPeriodRange(attendanceSettings.payInterval, attendanceSettings.weekStartDay, new Date(), periodOffset),
    [attendanceSettings.payInterval, attendanceSettings.weekStartDay, periodOffset]
  );

  const activeStaff = useMemo(() => staff.filter(s => s.status === 'active'), [staff]);

  const filteredStaff = useMemo(() => {
    const query = staffSearch.trim().toLowerCase();
    if (!query) return activeStaff;
    return activeStaff.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(query));
  }, [activeStaff, staffSearch]);

  // Exports every active staff member for the visible period, not just what the on-screen
  // search happens to be filtered to — a formal wages report shouldn't silently drop people.
  const handleExportSelect = (type: PayrollExportType) => {
    const rows = buildPayrollRows(activeStaff, timeLogs, rateGroups, rateSettings, attendanceSettings, adjustments, period);
    if (type === 'detailed') {
      printPayrollReport(rows, period, attendanceSettings.payInterval);
    } else {
      printAttendanceRegisterReport(rows, period, attendanceSettings.payInterval, attendanceSettings.workingDays);
    }
    setIsExportDialogOpen(false);
  };

  // Same choice, but shown in-app instead of printing straight away — the user decides
  // whether to actually print from the preview dialog itself.
  const handlePreviewSelect = (type: PayrollExportType) => {
    const rows = buildPayrollRows(activeStaff, timeLogs, rateGroups, rateSettings, attendanceSettings, adjustments, period);
    if (type === 'detailed') {
      setPreviewReport({ title: 'Wages Report', html: buildPayrollReportHtml(rows, period, attendanceSettings.payInterval) });
    } else {
      setPreviewReport({ title: 'Attendance Register', html: buildAttendanceRegisterReportHtml(rows, period, attendanceSettings.payInterval, attendanceSettings.workingDays) });
    }
    setIsPreviewChooserOpen(false);
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
        rateSettings={rateSettings}
        onSaveRateSettings={handleSaveRateSettings}
        rateGroups={rateGroups}
        rateGroupsLoading={rateGroupsLoading}
        addRateGroup={addRateGroup}
        updateRateGroup={updateRateGroup}
        deleteRateGroup={deleteRateGroup}
        adjustments={adjustments}
        onSetAdjustment={setAdjustment}
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
            onClick={() => setIsLogOpen(true)}
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
          <h2 className="text-sm font-black text-brand-primary uppercase tracking-tight">
            {chartView === 'register' ? 'Attendance Register' : 'Hours Logged'}
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
              <button
                type="button"
                title="Attendance register"
                onClick={() => setChartView('register')}
                className={cn(
                  "p-1.5 rounded-md transition-all",
                  chartView === 'register' ? "bg-white text-brand-primary shadow-xs" : "text-zinc-500 hover:text-zinc-700"
                )}
              >
                <Table2 className="w-4 h-4" />
              </button>
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
            {chartView === 'register' ? (
              <PeriodStepper
                payInterval={attendanceSettings.payInterval}
                weekStartDay={attendanceSettings.weekStartDay}
                offset={periodOffset}
                onOffsetChange={setPeriodOffset}
              />
            ) : (
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
            )}
          </div>
        </div>
        {loading ? (
          <div className="h-[280px] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
          </div>
        ) : chartView === 'register' ? (
          <AttendanceRegisterTable
            staff={activeStaff}
            timeLogs={timeLogs}
            attendanceSettings={attendanceSettings}
            period={period}
          />
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
          <p className="text-xs font-black uppercase tracking-widest text-zinc-400 shrink-0">Payroll</p>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="Search staff member"
                title="Search staff member"
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 w-48"
              />
            </div>
            <PeriodStepper
              payInterval={attendanceSettings.payInterval}
              weekStartDay={attendanceSettings.weekStartDay}
              offset={periodOffset}
              onOffsetChange={setPeriodOffset}
            />
            <button
              type="button"
              title="Preview this period's report before printing"
              onClick={() => setIsPreviewChooserOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-semibold text-xs transition-all shadow-2xs cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-zinc-500" />
              Preview
            </button>
            <button
              type="button"
              title="Export this period's report for printing"
              onClick={() => setIsExportDialogOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-semibold text-xs transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-zinc-500" />
              Export
            </button>
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
        ) : (
          <StaffPayrollTable
            staff={filteredStaff}
            timeLogs={timeLogs}
            rateGroups={rateGroups}
            rateSettings={rateSettings}
            attendanceSettings={attendanceSettings}
            adjustments={adjustments}
            period={period}
            addTimeLog={addTimeLog}
            updateTimeLog={updateTimeLog}
            deleteTimeLog={deleteTimeLog}
            onSetAdjustment={setAdjustment}
          />
        )}
      </div>

      {isLogOpen && (
        <TimeLogModal
          staff={staff}
          settings={attendanceSettings}
          onSave={addTimeLog}
          onClose={() => setIsLogOpen(false)}
        />
      )}
      {isBulkOpen && (
        <BulkTimeLogDialog staff={staff} settings={attendanceSettings} onSaveBulk={addTimeLogsBulk} onClose={() => setIsBulkOpen(false)} />
      )}
      {isSettingsOpen && (
        <TimeAttendanceSettingsModal
          settings={attendanceSettings}
          onSave={handleSaveSettings}
          rateSettings={rateSettings}
          onSaveRateSettings={handleSaveRateSettings}
          rateGroups={rateGroups}
          rateGroupsLoading={rateGroupsLoading}
          addRateGroup={addRateGroup}
          updateRateGroup={updateRateGroup}
          deleteRateGroup={deleteRateGroup}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
      {isExportDialogOpen && (
        <ExportOptionsDialog title="Export Report" onSelect={handleExportSelect} onClose={() => setIsExportDialogOpen(false)} />
      )}
      {isPreviewChooserOpen && (
        <ExportOptionsDialog title="Preview Report" onSelect={handlePreviewSelect} onClose={() => setIsPreviewChooserOpen(false)} />
      )}
      {previewReport && (
        <ReportPreviewDialog title={previewReport.title} html={previewReport.html} onClose={() => setPreviewReport(null)} />
      )}
    </div>
  );
}
