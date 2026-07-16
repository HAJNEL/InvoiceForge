import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { BarChart3, TrendingUp, Route, Wrench, Package, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../lib/utils';

interface WeeklyRevenuePoint {
  weekStart: string;
  weekEnd: string;
  travelRevenue: number;
  assemblyRevenue: number;
  totalRevenue: number;
  jobCount: number;
  label: string;
}

interface ReportsPageMobileProps {
  weeksRange: number;
  setWeeksRange: (weeks: number) => void;
  chartData: WeeklyRevenuePoint[];
  totals: { travel: number; assembly: number; total: number; jobs: number };
  missingDistanceCount: number;
}

export function ReportsPageMobile({
  weeksRange,
  setWeeksRange,
  chartData,
  totals,
  missingDistanceCount,
}: ReportsPageMobileProps) {
  const summaryCards = [
    { label: 'Total Revenue', value: formatCurrency(totals.total), icon: TrendingUp, accent: 'text-brand-accent' },
    { label: 'Travel Revenue', value: formatCurrency(totals.travel), icon: Route, accent: 'text-indigo-600' },
    { label: 'Assembly Revenue', value: formatCurrency(totals.assembly), icon: Wrench, accent: 'text-emerald-600' },
    { label: 'Completed Jobs', value: String(totals.jobs), icon: Package, accent: 'text-zinc-900' },
  ];

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-brand-accent" />
          Reports
        </h1>
        <p className="text-zinc-500 text-xs mt-1">Revenue earned per calendar week (Monday – Sunday)</p>
      </div>

      <div>
        <label className="block text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1.5">Range</label>
        <select
          title="Number of weeks to display"
          aria-label="Number of weeks to display"
          value={weeksRange}
          onChange={(e) => setWeeksRange(Number(e.target.value))}
          className="w-full text-sm bg-white border border-zinc-200 rounded-xl px-3 py-2.5 font-bold text-zinc-700 outline-none transition-all"
        >
          <option value={8}>Last 8 Weeks</option>
          <option value={12}>Last 12 Weeks</option>
          <option value={26}>Last 26 Weeks</option>
          <option value={52}>Last 52 Weeks</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {summaryCards.map((card) => (
          <div key={card.label} className="saas-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.accent}`} />
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest leading-none">{card.label}</p>
            </div>
            <p className="text-lg font-black text-zinc-900 tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      {missingDistanceCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p className="text-xs font-semibold">
            {missingDistanceCount} completed {missingDistanceCount === 1 ? 'job has' : 'jobs have'} no delivery
            distance recorded and {missingDistanceCount === 1 ? 'is' : 'are'} treated as Local (6% + 1.5%). Set the
            distance on each invoice's detail page for accurate Regional (8% + 2%) rates.
          </p>
        </div>
      )}

      <div className="saas-card p-4">
        <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-400 flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4" />
          Total Revenue Per Week
        </h3>

        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
              <XAxis
                dataKey="label"
                stroke="#a1a1aa"
                fontSize={8}
                tickLine={false}
                axisLine={false}
                dy={8}
                interval="preserveStartEnd"
              />
              <YAxis
                stroke="#a1a1aa"
                fontSize={9}
                tickLine={false}
                axisLine={false}
                width={38}
                tickFormatter={(val) => `R${Number(val).toLocaleString()}`}
              />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => [`R ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name]}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(label: any, payload: any) => {
                  const jobCount = payload?.[0]?.payload?.jobCount;
                  return jobCount !== undefined ? `${label} · ${jobCount} ${jobCount === 1 ? 'job' : 'jobs'}` : label;
                }}
                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '10px' }} />
              <Bar dataKey="travelRevenue" name="Travel Revenue" stackId="revenue" fill="#4f46e5" radius={[0, 0, 0, 0]} maxBarSize={32} />
              <Bar dataKey="assemblyRevenue" name="Assembly Revenue" stackId="revenue" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[10px] text-zinc-400 font-medium mt-4 leading-relaxed">
          Travel revenue = delivery value × (commission + diesel surcharge): Local &lt;50km at 6% + 1.5%, Regional
          ≥50km at 8% + 2%. Assembly revenue = line item quantities × Reboni assembly rates. Only delivered, complete
          and invoiced jobs are counted, placed in the week they were delivered (falling back to the invoice date).
        </p>
      </div>
    </div>
  );
}
