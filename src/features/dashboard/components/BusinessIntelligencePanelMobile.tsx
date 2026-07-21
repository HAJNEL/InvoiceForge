import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics';

type Analytics = ReturnType<typeof useDashboardAnalytics>;

type ChartType =
  | 'invoice_totals'
  | 'top_customers'
  | 'delivery_pipeline'
  | 'truck_utilization'
  | 'district_distribution'
  | 'top_products';

const CHART_TYPE_OPTIONS: { value: ChartType; label: string }[] = [
  { value: 'invoice_totals', label: 'Invoice Totals' },
  { value: 'top_customers', label: 'Top Customers' },
  { value: 'delivery_pipeline', label: 'Delivery Pipeline' },
  { value: 'truck_utilization', label: 'Fleet Dispatch' },
  { value: 'district_distribution', label: 'District Coverage' },
  { value: 'top_products', label: 'Best Sellers' },
];

/**
 * Mobile variant of BusinessIntelligencePanel. The desktop version already
 * renders one chart at a time (tab-selected), so the "stack to single column"
 * requirement here is really: swap the wrapped button-tab row for a single
 * <select> (saves vertical space) and stack each chart-type's filter row
 * full-width underneath instead of beside the title. The chart canvas itself
 * (recharts ResponsiveContainer) is untouched - it already fills its parent.
 */
export function BusinessIntelligencePanelMobile({
  invoiceCount,
  invoiceTotalsOverTime,
  topCustomersData,
  pipelineData,
  truckUtilizationData,
  districtData,
  productData
}: {
  invoiceCount: number;
  invoiceTotalsOverTime: Analytics['invoiceTotalsOverTime'];
  topCustomersData: Analytics['topCustomersData'];
  pipelineData: Analytics['pipelineData'];
  truckUtilizationData: Analytics['truckUtilizationData'];
  districtData: Analytics['districtData'];
  productData: Analytics['productData'];
}) {
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('invoice_totals');

  const [totalsTimeframe, setTotalsTimeframe] = useState<'last_7_days' | 'last_30_days' | 'last_12_months'>('last_30_days');
  const [customersMetric, setCustomersMetric] = useState<'value' | 'volume'>('value');
  const [customersLimit, setCustomersLimit] = useState<number>(5);
  const [pipelineMetric, setPipelineMetric] = useState<'count' | 'value'>('value');
  const [truckMetric, setTruckMetric] = useState<'total' | 'completed'>('total');
  const [districtMetric, setDistrictMetric] = useState<'revenue' | 'deliveries'>('revenue');
  const [productsMetric, setProductsMetric] = useState<'units' | 'revenue'>('units');
  const [productsLimit, setProductsLimit] = useState<number>(5);

  const renderChartFilters = () => {
    switch (selectedChartType) {
      case 'invoice_totals':
        return (
          <select
            title="Timeframe"
            value={totalsTimeframe}
            onChange={(e) => setTotalsTimeframe(e.target.value as 'last_7_days' | 'last_30_days' | 'last_12_months')}
            className="w-full text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 font-bold text-zinc-700 outline-none"
          >
            <option value="last_7_days">Last 7 Days (Daily)</option>
            <option value="last_30_days">Last 30 Days (Daily)</option>
            <option value="last_12_months">Last 12 Months (Monthly)</option>
          </select>
        );
      case 'top_customers':
        return (
          <div className="flex items-center gap-2">
            <div className="inline-flex flex-1 rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
              <button
                type="button"
                title="Show value in Rand"
                onClick={() => setCustomersMetric('value')}
                className={cn(
                  "flex-1 px-2 py-1 text-[10px] font-black rounded-sm transition-all",
                  customersMetric === 'value' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
                )}
              >
                VALUE (R)
              </button>
              <button
                type="button"
                title="Show volume"
                onClick={() => setCustomersMetric('volume')}
                className={cn(
                  "flex-1 px-2 py-1 text-[10px] font-black rounded-sm transition-all",
                  customersMetric === 'volume' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
                )}
              >
                VOLUME
              </button>
            </div>
            <select
              title="Top customers limit"
              value={customersLimit}
              onChange={(e) => setCustomersLimit(Number(e.target.value))}
              className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 font-bold text-zinc-700 outline-none shrink-0"
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
            </select>
          </div>
        );
      case 'delivery_pipeline':
        return (
          <div className="inline-flex w-full rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
            <button
              type="button"
              title="Show value in Rand"
              onClick={() => setPipelineMetric('value')}
              className={cn(
                "flex-1 px-2.5 py-1 text-[10px] font-black rounded-sm transition-all",
                pipelineMetric === 'value' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
              )}
            >
              VALUE (R)
            </button>
            <button
              type="button"
              title="Show counts"
              onClick={() => setPipelineMetric('count')}
              className={cn(
                "flex-1 px-2.5 py-1 text-[10px] font-black rounded-sm transition-all",
                pipelineMetric === 'count' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
              )}
            >
              COUNTS
            </button>
          </div>
        );
      case 'truck_utilization':
        return (
          <div className="inline-flex w-full rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
            <button
              type="button"
              title="Show all trips"
              onClick={() => setTruckMetric('total')}
              className={cn(
                "flex-1 px-2.5 py-1 text-[10px] font-black rounded-sm transition-all",
                truckMetric === 'total' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
              )}
            >
              ALL TRIPS
            </button>
            <button
              type="button"
              title="Show completed trips"
              onClick={() => setTruckMetric('completed')}
              className={cn(
                "flex-1 px-2.5 py-1 text-[10px] font-black rounded-sm transition-all",
                truckMetric === 'completed' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
              )}
            >
              COMPLETED
            </button>
          </div>
        );
      case 'district_distribution':
        return (
          <div className="inline-flex w-full rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
            <button
              type="button"
              title="Show revenue"
              onClick={() => setDistrictMetric('revenue')}
              className={cn(
                "flex-1 px-2.5 py-1 text-[10px] font-black rounded-sm transition-all",
                districtMetric === 'revenue' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
              )}
            >
              REVENUE
            </button>
            <button
              type="button"
              title="Show deliveries"
              onClick={() => setDistrictMetric('deliveries')}
              className={cn(
                "flex-1 px-2.5 py-1 text-[10px] font-black rounded-sm transition-all",
                districtMetric === 'deliveries' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
              )}
            >
              DELIVERIES
            </button>
          </div>
        );
      case 'top_products':
        return (
          <div className="flex items-center gap-2">
            <div className="inline-flex flex-1 rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
              <button
                type="button"
                title="Show units"
                onClick={() => setProductsMetric('units')}
                className={cn(
                  "flex-1 px-2 py-1 text-[10px] font-black rounded-sm transition-all",
                  productsMetric === 'units' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
                )}
              >
                UNITS
              </button>
              <button
                type="button"
                title="Show revenue"
                onClick={() => setProductsMetric('revenue')}
                className={cn(
                  "flex-1 px-2 py-1 text-[10px] font-black rounded-sm transition-all",
                  productsMetric === 'revenue' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
                )}
              >
                REVENUE
              </button>
            </div>
            <select
              title="Top products limit"
              value={productsLimit}
              onChange={(e) => setProductsLimit(Number(e.target.value))}
              className="text-xs bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5 font-bold text-zinc-700 outline-none shrink-0"
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
            </select>
          </div>
        );
      default:
        return null;
    }
  };

  const renderSelectedChart = () => {
    if (invoiceCount === 0) {
      return (
        <div className="h-[260px] w-full flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
          <div className="text-center p-6">
            <BarChart3 className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-zinc-500 text-xs">Upload invoices to generate dynamic charts and business intelligence metrics.</p>
          </div>
        </div>
      );
    }

    switch (selectedChartType) {
      case 'invoice_totals': {
        const dataset = invoiceTotalsOverTime[totalsTimeframe] || [];
        return (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataset} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmountMobile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="label" stroke="#a1a1aa" fontSize={9} tickLine={false} axisLine={false} dy={10} />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R${val.toLocaleString()}`}
                  width={44}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`R ${Number(value).toLocaleString(undefined, {minimumFractionDigits: 2})}`, 'Total Value']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAmountMobile)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'top_customers': {
        const sortedData = [...topCustomersData];
        if (customersMetric === 'volume') {
          sortedData.sort((a, b) => b.count - a.count);
        } else {
          sortedData.sort((a, b) => b.amount - a.amount);
        }
        const sliced = sortedData.slice(0, customersLimit);

        return (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sliced} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="name"
                  stroke="#a1a1aa"
                  fontSize={8}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val.length > 10 ? val.substring(0, 10) + '...' : val}
                  dy={8}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => customersMetric === 'value' ? `R${val.toLocaleString()}` : val}
                  width={44}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    customersMetric === 'value' ? `R ${Number(value).toLocaleString()}` : `${value} Invoices`,
                    customersMetric === 'value' ? 'Total Spent' : 'Invoice Count'
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey={customersMetric === 'value' ? 'amount' : 'count'} fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'delivery_pipeline': {
        return (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="status" stroke="#a1a1aa" fontSize={9} tickLine={false} axisLine={false} dy={8} />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => pipelineMetric === 'value' ? `R${val.toLocaleString()}` : val}
                  width={44}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    pipelineMetric === 'value' ? `R ${Number(value).toLocaleString()}` : `${value} Invoices`,
                    pipelineMetric === 'value' ? 'Total Value' : 'Item Count'
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey={pipelineMetric === 'value' ? 'value' : 'count'} fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {pipelineData.map((entry, index) => {
                    const colors = ['#71717a', '#3b82f6', '#f59e0b', '#6366f1', '#10b981'];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'truck_utilization': {
        const sorted = [...truckUtilizationData];
        if (truckMetric === 'completed') {
          sorted.sort((a, b) => b.completed - a.completed);
        }

        return (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={9} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke="#a1a1aa" fontSize={9} tickLine={false} axisLine={false} width={28} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '8px' }} />
                <Bar dataKey="completed" name="Completed Trips" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={40} />
                <Bar dataKey="pending" name="Scheduled/Pending" stackId="a" fill="#eab308" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'district_distribution': {
        const sorted = [...districtData];
        if (districtMetric === 'deliveries') {
          sorted.sort((a, b) => b.deliveries - a.deliveries);
        }

        return (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                <XAxis
                  type="number"
                  stroke="#a1a1aa"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => districtMetric === 'revenue' ? `R${val.toLocaleString()}` : val}
                />
                <YAxis type="category" dataKey="district" stroke="#71717a" fontSize={8} tickLine={false} axisLine={false} width={70} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    districtMetric === 'revenue' ? `R ${Number(value).toLocaleString()}` : `${value} Deliveries`,
                    districtMetric === 'revenue' ? 'Revenue' : 'Deliveries Count'
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey={districtMetric === 'revenue' ? 'revenue' : 'deliveries'} fill="#ec4899" radius={[0, 6, 6, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'top_products': {
        const sorted = [...productData];
        if (productsMetric === 'revenue') {
          sorted.sort((a, b) => b.revenue - a.revenue);
        }
        const sliced = sorted.slice(0, productsLimit);

        return (
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sliced} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="code" stroke="#a1a1aa" fontSize={9} tickLine={false} axisLine={false} dy={8} />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => productsMetric === 'revenue' ? `R${val.toLocaleString()}` : val}
                  width={44}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any, props: any) => [
                    productsMetric === 'revenue' ? `R ${Number(value).toLocaleString()}` : `${value} Units`,
                    `${props.payload.name || 'Product'} (${productsMetric === 'revenue' ? 'Revenue' : 'Units Sold'})`
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '10px', maxWidth: '240px', fontWeight: 'bold' }}
                />
                <Bar dataKey={productsMetric === 'revenue' ? 'revenue' : 'units'} fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const currentTitle = () => {
    switch (selectedChartType) {
      case 'invoice_totals': return 'Financial Performance History';
      case 'top_customers': return 'Client Spend Analysis';
      case 'delivery_pipeline': return 'Operations Delivery pipeline';
      case 'truck_utilization': return 'Fleet Trip Frequencies';
      case 'district_distribution': return 'Geographic Market Footprint';
      case 'top_products': return 'Best Selling Inventory Analytics';
    }
  };

  return (
    <div className="saas-card p-4 space-y-4">
      <div>
        <h3 className="font-black text-[10px] uppercase tracking-widest text-zinc-400">Business Intelligence & History</h3>
        <h4 className="text-base font-bold text-zinc-800 mt-1">{currentTitle()}</h4>
      </div>

      <select
        title="Select chart type"
        value={selectedChartType}
        onChange={(e) => setSelectedChartType(e.target.value as ChartType)}
        className="w-full text-xs font-bold bg-white border border-zinc-200 rounded-xl px-3 py-2.5 outline-none"
      >
        {CHART_TYPE_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <div>{renderChartFilters()}</div>

      <div className="relative min-h-[260px] w-full flex items-center justify-center">
        {renderSelectedChart()}
      </div>
    </div>
  );
}
