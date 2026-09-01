import { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Clock, Plus, Users, Loader2, AlertCircle, Settings as SettingsIcon, BarChart3, LineChart as LineChartIcon, Search, ChevronLeft, ChevronRight, Download, Table2, Eye } from 'lucide-react';
import { StaffMember, TimeLog, TimeAttendanceSettings, RateGroup, RateSettings, RateTier, PayrollAdjustment } from '../../types';
import { TimeLogEntry } from './hooks/useTimeLogs';
import { PayrollAdjustmentEntry } from './hooks/usePayrollAdjustments';
import { TimeLogModalMobile } from './components/TimeLogModalMobile';
import { BulkTimeLogDialogMobile } from './components/BulkTimeLogDialogMobile';
import { TimeAttendanceSettingsModalMobile } from './components/TimeAttendanceSettingsModalMobile';
import { StaffPayrollListMobile } from './components/StaffPayrollListMobile';
import { AttendanceRegisterTable } from './components/AttendanceRegisterTable';
import { buildChartData, withAverageLine } from './chartData';
import { getPeriodRange } from './utils';
import { buildPayrollRows } from './payroll';
import { printPayrollReport, printAttendanceRegisterReport, buildPayrollReportHtml, buildAttendanceRegisterReportHtml } from './printPayrollReport';
import { ExportOptionsDialog, PayrollExportType } from './components/ExportOptionsDialog';
import { ReportPreviewDialogMobile } from './components/ReportPreviewDialogMobile';
import { cn } from '../../lib/utils';

const WINDOWS = [
  { key: '7', label: '7D', days: 7 },
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 },
] as const;

export function TimeAttendancePageMobile({
  staff, timeLogs, loading, error, attendanceSettings, onSaveSettings,
  rateSettings, onSaveRateSettings, rateGroups, rateGroupsLoading, addRateGroup, updateRateGroup, deleteRateGroup,
  adjustments, onSetAdjustment,
  addTimeLog, addTimeLogsBulk, updateTimeLog, deleteTimeLog,
}: {
  staff: StaffMember[];
  timeLogs: TimeLog[];
  loading: boolean;
  error: string | null;
  attendanceSettings: TimeAttendanceSettings;
  onSaveSettings: (settings: TimeAttendanceSettings) => Promise<boolean>;
  rateSettings: RateSettings;
  onSaveRateSettings: (settings: RateSettings) => Promise<boolean>;
  rateGroups: RateGroup[];
  rateGroupsLoading: boolean;
  addRateGroup: (name: string, tiers: RateTier[]) => Promise<string | null>;
  updateRateGroup: (id: string, data: Partial<Pick<RateGroup, 'name' | 'tiers'>>) => Promise<boolean>;
  deleteRateGroup: (id: string) => Promise<boolean>;
  adjustments: PayrollAdjustment[];
  onSetAdjustment: (staffId: string, periodKey: string, entry: PayrollAdjustmentEntry) => Promise<boolean>;
  addTimeLog: (entry: TimeLogEntry) => Promise<unknown>;
  addTimeLogsBulk: (entries: TimeLogEntry[]) => Promise<boolean>;
  updateTimeLog: (id: string, entry: Partial<TimeLogEntry>) => Promise<boolean>;
  deleteTimeLog: (id: string) => Promise<boolean>;
}) {
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

  const handleExportSelect = (type: PayrollExportType) => {
    const rows = buildPayrollRows(activeStaff, timeLogs, rateGroups, rateSettings, attendanceSettings, adjustments, period);
    if (type === 'detailed') {
      printPayrollReport(rows, period, attendanceSettings.payInterval);
    } else {
      printAttendanceRegisterReport(rows, period, attendanceSettings.payInterval, attendanceSettings.workingDays);
    }
    setIsExportDialogOpen(false);
  };

  const handlePreviewSelect = (type: PayrollExportType) => {
    const rows = buildPayrollRows(activeStaff, timeLogs, rateGroups, rateSettings, attendanceSettings, adjustments, period);
    if (type === 'detailed') {
      setPreviewReport({ title: 'Wages Report', html: buildPayrollReportHtml(rows, period, attendanceSettings.payInterval) });
    } else {
      setPreviewReport({ title: 'Attendance Register', html: buildAttendanceRegisterReportHtml(rows, period, attendanceSettings.payInterval, attendanceSettings.workingDays) });
    }
    setIsPreviewChooserOpen(false);
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
          onClick={() => setIsLogOpen(true)}
          title="Log Attendance"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs mobile-tap-target"
        >
          <Plus className="w-3.5 h-3.5" />
          Log
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <p className="text-xs font-black text-brand-primary uppercase tracking-tight shrink-0">
            {chartView === 'register' ? 'Register' : 'Hours Logged'}
          </p>
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 shrink-0">
              <button
                type="button"
                title="Attendance register"
                onClick={() => setChartView('register')}
                className={cn(
                  "p-1 rounded-md transition-all mobile-tap-target",
                  chartView === 'register' ? "bg-white text-brand-primary shadow-xs" : "text-zinc-500"
                )}
              >
                <Table2 className="w-3.5 h-3.5" />
              </button>
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
            {chartView === 'register' ? (
              <PeriodStepperMobile
                payInterval={attendanceSettings.payInterval}
                weekStartDay={attendanceSettings.weekStartDay}
                offset={periodOffset}
                onOffsetChange={setPeriodOffset}
              />
            ) : (
              <div className="flex gap-1 bg-zinc-100 rounded-lg p-1 shrink-0">
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
            )}
          </div>
        </div>
        {loading ? (
          <div className="h-[180px] flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
          </div>
        ) : chartView === 'register' ? (
          <AttendanceRegisterTable
            staff={activeStaff}
            timeLogs={timeLogs}
            attendanceSettings={attendanceSettings}
            period={period}
          />
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
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 shrink-0">Payroll</p>
          <PeriodStepperMobile
            payInterval={attendanceSettings.payInterval}
            weekStartDay={attendanceSettings.weekStartDay}
            offset={periodOffset}
            onOffsetChange={setPeriodOffset}
          />
        </div>
        <div className="flex items-center gap-2 px-1">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              placeholder="Search staff member"
              title="Search staff member"
              className="w-full pl-7 pr-2 py-2 text-xs rounded-xl border border-zinc-200 bg-white text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 mobile-tap-target"
            />
          </div>
          <button
            type="button"
            title="Preview this period's report before printing"
            onClick={() => setIsPreviewChooserOpen(true)}
            className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-500 shrink-0 shadow-2xs mobile-tap-target"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Export this period's report for printing"
            onClick={() => setIsExportDialogOpen(true)}
            className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-500 shrink-0 shadow-2xs mobile-tap-target"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
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
        ) : (
          <StaffPayrollListMobile
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
            onSetAdjustment={onSetAdjustment}
          />
        )}
      </div>

      {isLogOpen && (
        <TimeLogModalMobile
          staff={staff}
          settings={attendanceSettings}
          onSave={addTimeLog}
          onClose={() => setIsLogOpen(false)}
        />
      )}
      {isBulkOpen && (
        <BulkTimeLogDialogMobile staff={staff} settings={attendanceSettings} onSaveBulk={addTimeLogsBulk} onClose={() => setIsBulkOpen(false)} />
      )}
      {isSettingsOpen && (
        <TimeAttendanceSettingsModalMobile
          settings={attendanceSettings}
          onSave={onSaveSettings}
          rateSettings={rateSettings}
          onSaveRateSettings={onSaveRateSettings}
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
        <ReportPreviewDialogMobile title={previewReport.title} html={previewReport.html} onClose={() => setPreviewReport(null)} />
      )}
    </div>
  );
}

function PeriodStepperMobile({ payInterval, weekStartDay, offset, onOffsetChange }: {
  payInterval: TimeAttendanceSettings['payInterval'];
  weekStartDay: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
}) {
  const period = getPeriodRange(payInterval, weekStartDay, new Date(), offset);
  return (
    <div className="flex items-center gap-1">
      <button type="button" title="Previous period" onClick={() => onOffsetChange(offset - 1)} className="p-1.5 text-zinc-400 hover:text-zinc-700 mobile-tap-target">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="text-[10px] font-bold text-zinc-600 whitespace-nowrap">{period.label}</span>
      <button type="button" title="Next period" onClick={() => onOffsetChange(offset + 1)} className="p-1.5 text-zinc-400 hover:text-zinc-700 mobile-tap-target">
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
