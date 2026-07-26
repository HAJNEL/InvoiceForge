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
import {
  ClipboardList,
  BarChart3,
  TrendingUp,
  Users,
  MapPin,
  ShoppingBag,
  Truck as TruckIcon,
  Fuel,
  Gauge,
  PackageCheck,
  AlertTriangle,
  Route
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics';

type Analytics = ReturnType<typeof useDashboardAnalytics>;

type ChartType =
  | 'invoice_totals'
  | 'top_customers'
  | 'delivery_pipeline'
  | 'truck_utilization'
  | 'district_distribution'
  | 'top_products'
  | 'fuel_efficiency'
  | 'utilization_rate'
  | 'load_efficiency'
  | 'shortage_analysis'
  | 'route_profitability';

export function BusinessIntelligencePanel({
  invoiceCount,
  invoiceTotalsOverTime,
  topCustomersData,
  pipelineData,
  truckUtilizationData,
  districtData,
  productData,
  fuelAnalyticsData,
  utilizationRateData,
  loadEfficiencyData,
  shortageData,
  routeProfitData
}: {
  invoiceCount: number;
  invoiceTotalsOverTime: Analytics['invoiceTotalsOverTime'];
  topCustomersData: Analytics['topCustomersData'];
  pipelineData: Analytics['pipelineData'];
  truckUtilizationData: Analytics['truckUtilizationData'];
  districtData: Analytics['districtData'];
  productData: Analytics['productData'];
  fuelAnalyticsData: Analytics['fuelAnalyticsData'];
  utilizationRateData: Analytics['utilizationRateData'];
  loadEfficiencyData: Analytics['loadEfficiencyData'];
  shortageData: Analytics['shortageData'];
  routeProfitData: Analytics['routeProfitData'];
}) {
  // Selected graph type to display in the business dashboard
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('invoice_totals');

  // Specific graph filter states
  const [totalsTimeframe, setTotalsTimeframe] = useState<'last_7_days' | 'last_30_days' | 'last_12_months'>('last_30_days');
  const [customersMetric, setCustomersMetric] = useState<'value' | 'volume'>('value');
  const [customersLimit, setCustomersLimit] = useState<number>(5);
  const [pipelineMetric, setPipelineMetric] = useState<'count' | 'value'>('value');
  const [truckMetric, setTruckMetric] = useState<'total' | 'completed'>('total');
  const [districtMetric, setDistrictMetric] = useState<'revenue' | 'deliveries'>('revenue');
  const [productsMetric, setProductsMetric] = useState<'units' | 'revenue'>('units');
  const [productsLimit, setProductsLimit] = useState<number>(5);
  const [fuelMetric, setFuelMetric] = useState<'costPerKm' | 'kmPerLiter'>('costPerKm');
  const [utilizationWindow, setUtilizationWindow] = useState<'30' | '90'>('30');
  const [loadFilter, setLoadFilter] = useState<'all' | 'completed'>('all');
  const [shortageView, setShortageView] = useState<'reason' | 'product'>('reason');
  const [routeSort, setRouteSort] = useState<'worst' | 'best'>('worst');
  const [routeLimit, setRouteLimit] = useState<number>(8);

  // Render filters based on selected graph type
  const renderChartFilters = () => {
    switch (selectedChartType) {
      case 'invoice_totals':
        return (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Timeframe:</span>
            <select aria-label="Timeframe"
              value={totalsTimeframe}
              onChange={(e) => setTotalsTimeframe(e.target.value as 'last_7_days' | 'last_30_days' | 'last_12_months')}
              className="text-xs bg-zinc-50 border border-zinc-200 rounded px-2.5 py-1 font-bold text-zinc-700 outline-none hover:bg-zinc-100 cursor-pointer transition-all"
            >
              <option value="last_7_days">Last 7 Days (Daily)</option>
              <option value="last_30_days">Last 30 Days (Daily)</option>
              <option value="last_12_months">Last 12 Months (Monthly)</option>
            </select>
          </div>
        );
      case 'top_customers':
        return (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Metric:</span>
              <div className="inline-flex rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
                <button
                  type="button"
                  onClick={() => setCustomersMetric('value')}
                  className={cn(
                    "px-2 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                    customersMetric === 'value' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  VALUE (R)
                </button>
                <button
                  type="button"
                  onClick={() => setCustomersMetric('volume')}
                  className={cn(
                    "px-2 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                    customersMetric === 'volume' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  VOLUME
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Limit:</span>
              <select aria-label="Top customers limit"
                value={customersLimit}
                onChange={(e) => setCustomersLimit(Number(e.target.value))}
                className="text-xs bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5 font-bold text-zinc-700 outline-none cursor-pointer hover:bg-zinc-100 transition-all"
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
            </div>
          </div>
        );
      case 'delivery_pipeline':
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Select Metric:</span>
            <div className="inline-flex rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
              <button
                type="button"
                onClick={() => setPipelineMetric('value')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  pipelineMetric === 'value' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                VALUE (R)
              </button>
              <button
                type="button"
                onClick={() => setPipelineMetric('count')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  pipelineMetric === 'count' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                COUNTS
              </button>
            </div>
          </div>
        );
      case 'truck_utilization':
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Sort Metric:</span>
            <div className="inline-flex rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
              <button
                type="button"
                onClick={() => setTruckMetric('total')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  truckMetric === 'total' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                ALL TRIPS
              </button>
              <button
                type="button"
                onClick={() => setTruckMetric('completed')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  truckMetric === 'completed' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                COMPLETED
              </button>
            </div>
          </div>
        );
      case 'district_distribution':
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Metric:</span>
            <div className="inline-flex rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
              <button
                type="button"
                onClick={() => setDistrictMetric('revenue')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  districtMetric === 'revenue' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                REVENUE
              </button>
              <button
                type="button"
                onClick={() => setDistrictMetric('deliveries')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  districtMetric === 'deliveries' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                DELIVERIES
              </button>
            </div>
          </div>
        );
      case 'top_products':
        return (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Select Metric:</span>
              <div className="inline-flex rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
                <button
                  type="button"
                  onClick={() => setProductsMetric('units')}
                  className={cn(
                    "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                    productsMetric === 'units' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  UNITS SOLD
                </button>
                <button
                  type="button"
                  onClick={() => setProductsMetric('revenue')}
                  className={cn(
                    "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                    productsMetric === 'revenue' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  REVENUE VALUE
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Limit:</span>
              <select aria-label="Top products limit"
                value={productsLimit}
                onChange={(e) => setProductsLimit(Number(e.target.value))}
                className="text-xs bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5 font-bold text-zinc-700 outline-none cursor-pointer hover:bg-zinc-100 transition-all font-sans"
              >
                <option value={3}>Top 3</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
              </select>
            </div>
          </div>
        );
      case 'fuel_efficiency':
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Metric:</span>
            <div className="inline-flex rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
              <button
                type="button"
                title="Show cost per kilometer"
                onClick={() => setFuelMetric('costPerKm')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  fuelMetric === 'costPerKm' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                COST/KM
              </button>
              <button
                type="button"
                title="Show kilometers per liter"
                onClick={() => setFuelMetric('kmPerLiter')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  fuelMetric === 'kmPerLiter' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                KM/LITER
              </button>
            </div>
          </div>
        );
      case 'utilization_rate':
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Window:</span>
            <div className="inline-flex rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
              <button
                type="button"
                title="Show the last 30 days"
                onClick={() => setUtilizationWindow('30')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  utilizationWindow === '30' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                LAST 30 DAYS
              </button>
              <button
                type="button"
                title="Show the last 90 days"
                onClick={() => setUtilizationWindow('90')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  utilizationWindow === '90' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                LAST 90 DAYS
              </button>
            </div>
          </div>
        );
      case 'load_efficiency':
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Trips:</span>
            <div className="inline-flex rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
              <button
                type="button"
                title="Include all trips"
                onClick={() => setLoadFilter('all')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  loadFilter === 'all' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                ALL TRIPS
              </button>
              <button
                type="button"
                title="Only include completed trips"
                onClick={() => setLoadFilter('completed')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  loadFilter === 'completed' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                COMPLETED
              </button>
            </div>
          </div>
        );
      case 'shortage_analysis':
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">View:</span>
            <div className="inline-flex rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
              <button
                type="button"
                title="Group by reason"
                onClick={() => setShortageView('reason')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  shortageView === 'reason' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                BY REASON
              </button>
              <button
                type="button"
                title="Group by product"
                onClick={() => setShortageView('product')}
                className={cn(
                  "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                  shortageView === 'product' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                )}
              >
                BY PRODUCT
              </button>
            </div>
          </div>
        );
      case 'route_profitability':
        return (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Sort:</span>
              <div className="inline-flex rounded-md shadow-3xs p-0.5 bg-zinc-100 border border-zinc-200">
                <button
                  type="button"
                  title="Show worst value routes first"
                  onClick={() => setRouteSort('worst')}
                  className={cn(
                    "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                    routeSort === 'worst' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  WORST VALUE
                </button>
                <button
                  type="button"
                  title="Show best value routes first"
                  onClick={() => setRouteSort('best')}
                  className={cn(
                    "px-2.5 py-0.5 text-[9px] font-black rounded-sm transition-all cursor-pointer",
                    routeSort === 'best' ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  BEST VALUE
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Limit:</span>
              <select aria-label="Route profitability limit" title="Route profitability limit"
                value={routeLimit}
                onChange={(e) => setRouteLimit(Number(e.target.value))}
                className="text-xs bg-zinc-50 border border-zinc-200 rounded px-2 py-0.5 font-bold text-zinc-700 outline-none cursor-pointer hover:bg-zinc-100 transition-all"
              >
                <option value={5}>Top 5</option>
                <option value={8}>Top 8</option>
                <option value={15}>Top 15</option>
              </select>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Render the actual recharts component inside the container
  const renderSelectedChart = () => {
    // If no invoices exist
    if (invoiceCount === 0) {
      return (
        <div className="h-[300px] w-full flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
          <div className="text-center p-6">
            <BarChart3 className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">Upload invoices to generate dynamic charts and business intelligence metrics.</p>
          </div>
        </div>
      );
    }

    switch (selectedChartType) {
      case 'invoice_totals': {
        const dataset = invoiceTotalsOverTime[totalsTimeframe] || [];
        return (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataset} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="label"
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R${val.toLocaleString()}`}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`R ${Number(value).toLocaleString(undefined, {minimumFractionDigits: 2})}`, 'Total Value']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorAmount)"
                />
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
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sliced} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="name"
                  stroke="#a1a1aa"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                  dy={8}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => customersMetric === 'value' ? `R${val.toLocaleString()}` : val}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    customersMetric === 'value' ? `R ${Number(value).toLocaleString()}` : `${value} Invoices`,
                    customersMetric === 'value' ? 'Total Spent' : 'Invoice Count'
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar
                  dataKey={customersMetric === 'value' ? 'amount' : 'count'}
                  fill="#4f46e5"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'delivery_pipeline': {
        return (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="status"
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => pipelineMetric === 'value' ? `R${val.toLocaleString()}` : val}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    pipelineMetric === 'value' ? `R ${Number(value).toLocaleString()}` : `${value} Invoices`,
                    pipelineMetric === 'value' ? 'Total Value' : 'Item Count'
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar
                  dataKey={pipelineMetric === 'value' ? 'value' : 'count'}
                  fill="#0284c7"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={55}
                >
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
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="name"
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Bar dataKey="completed" name="Completed Trips" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={45} />
                <Bar dataKey="pending" name="Scheduled/Pending" stackId="a" fill="#eab308" radius={[6, 6, 0, 0]} maxBarSize={45} />
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
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                <XAxis
                  type="number"
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => districtMetric === 'revenue' ? `R${val.toLocaleString()}` : val}
                />
                <YAxis
                  type="category"
                  dataKey="district"
                  stroke="#71717a"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    districtMetric === 'revenue' ? `R ${Number(value).toLocaleString()}` : `${value} Deliveries`,
                    districtMetric === 'revenue' ? 'Revenue' : 'Deliveries Count'
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar
                  dataKey={districtMetric === 'revenue' ? 'revenue' : 'deliveries'}
                  fill="#ec4899"
                  radius={[0, 6, 6, 0]}
                  maxBarSize={20}
                />
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
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sliced} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="code"
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => productsMetric === 'revenue' ? `R${val.toLocaleString()}` : val}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, name: any, props: any) => [
                    productsMetric === 'revenue' ? `R ${Number(value).toLocaleString()}` : `${value} Units`,
                    `${props.payload.name || 'Product'} (${productsMetric === 'revenue' ? 'Revenue' : 'Units Sold'})`
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '10px', maxWidth: '280px', whiteSpace: 'normal', fontWeight: 'bold' }}
                />
                <Bar
                  dataKey={productsMetric === 'revenue' ? 'revenue' : 'units'}
                  fill="#8b5cf6"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'fuel_efficiency': {
        const sorted = [...fuelAnalyticsData].sort((a, b) => b[fuelMetric] - a[fuelMetric]);

        if (sorted.length === 0) {
          return (
            <div className="h-[320px] w-full flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
              <div className="text-center p-6">
                <Fuel className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">Log fuel refuels (with odometer readings) to see fleet cost & efficiency.</p>
              </div>
            </div>
          );
        }

        return (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                <YAxis
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => fuelMetric === 'costPerKm' ? `R${val}` : `${val}km`}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    fuelMetric === 'costPerKm' ? `R ${Number(value).toFixed(2)} / km` : `${Number(value).toFixed(1)} km / liter`,
                    fuelMetric === 'costPerKm' ? 'Cost per KM' : 'Fuel Efficiency'
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey={fuelMetric} fill="#ea580c" radius={[6, 6, 0, 0]} maxBarSize={55} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'utilization_rate': {
        const activeKey = utilizationWindow === '30' ? 'active30' : 'active90';
        const pctKey = utilizationWindow === '30' ? 'pct30' : 'pct90';
        const totalDays = utilizationWindow === '30' ? 30 : 90;
        const sorted = [...utilizationRateData].sort((a, b) => b[pctKey] - a[pctKey]);

        return (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                <Tooltip
                  formatter={(value, _name, props) => [
                    `${props.payload[activeKey]} / ${totalDays} days active`,
                    'Utilization'
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey={pctKey} fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={55} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'load_efficiency': {
        const avgKey = loadFilter === 'all' ? 'avgUtilizationAll' : 'avgUtilizationCompleted';
        const sorted = [...loadEfficiencyData]
          .filter(row => row[avgKey] !== null)
          .sort((a, b) => (b[avgKey] as number) - (a[avgKey] as number));

        if (sorted.length === 0) {
          return (
            <div className="h-[320px] w-full flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
              <div className="text-center p-6">
                <PackageCheck className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">Set up truck max capacities on the KPI page to see load efficiency here.</p>
              </div>
            </div>
          );
        }

        return (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sorted} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} domain={[0, 100]} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`${value}%`, 'Avg. Capacity Used']}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey={avgKey} radius={[6, 6, 0, 0]} maxBarSize={55}>
                  {sorted.map((row, index) => {
                    const val = (row[avgKey] as number) ?? 0;
                    const color = val >= 80 ? '#10b981' : val >= 50 ? '#f59e0b' : '#ef4444';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'shortage_analysis': {
        const hasData = shortageData.byReason.length > 0;

        if (!hasData) {
          return (
            <div className="h-[320px] w-full flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
              <div className="text-center p-6">
                <AlertTriangle className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No partial or short deliveries recorded — nothing to report yet.</p>
              </div>
            </div>
          );
        }

        const dataset = shortageView === 'reason'
          ? shortageData.byReason.map(r => ({ label: r.reason, value: r.count }))
          : shortageData.byProduct.map(p => ({ label: p.code, value: p.shortfallQty }));

        return (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataset} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis
                  dataKey="label"
                  stroke="#a1a1aa"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => val.length > 14 ? val.substring(0, 14) + '...' : val}
                  dy={8}
                />
                <YAxis stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [
                    shortageView === 'reason' ? `${value} incident${value === 1 ? '' : 's'}` : `${value} units short`,
                    shortageView === 'reason' ? 'Incidents' : 'Shortfall Qty'
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', fontWeight: 'bold' }}
                />
                <Bar dataKey="value" fill="#dc2626" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      case 'route_profitability': {
        const sorted = [...routeProfitData].sort((a, b) =>
          routeSort === 'worst' ? a.revenuePerKm - b.revenuePerKm : b.revenuePerKm - a.revenuePerKm
        );
        const sliced = sorted.slice(0, routeLimit);

        if (sliced.length === 0) {
          return (
            <div className="h-[320px] w-full flex items-center justify-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
              <div className="text-center p-6">
                <Route className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">Add delivery distances (km) on invoices to see revenue-per-km by client.</p>
              </div>
            </div>
          );
        }

        return (
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sliced} layout="vertical" margin={{ top: 10, right: 10, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                <XAxis
                  type="number"
                  stroke="#a1a1aa"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `R${val}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#71717a"
                  fontSize={9}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                  tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                />
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, _name: any, props: any) => [
                    `R ${Number(value).toFixed(2)} / km (R${Number(props.payload.totalRevenue).toLocaleString()} over ${props.payload.totalDistance}km, ${props.payload.invoiceCount} jobs)`,
                    'Revenue per KM'
                  ]}
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '11px', maxWidth: '260px', whiteSpace: 'normal', fontWeight: 'bold' }}
                />
                <Bar dataKey="revenuePerKm" fill="#7c3aed" radius={[0, 6, 6, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="saas-card p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="font-black text-xs uppercase tracking-widest text-zinc-400">Business Intelligence & History</h3>
          <h4 className="text-lg font-bold text-zinc-800 mt-1">
            {selectedChartType === 'invoice_totals' && 'Financial Performance History'}
            {selectedChartType === 'top_customers' && 'Client Spend Analysis'}
            {selectedChartType === 'delivery_pipeline' && 'Operations Delivery pipeline'}
            {selectedChartType === 'truck_utilization' && 'Fleet Trip Frequencies'}
            {selectedChartType === 'district_distribution' && 'Geographic Market Footprint'}
            {selectedChartType === 'top_products' && 'Best Selling Inventory Analytics'}
            {selectedChartType === 'fuel_efficiency' && 'Fleet Fuel Cost & Efficiency'}
            {selectedChartType === 'utilization_rate' && 'Truck Utilization Rate'}
            {selectedChartType === 'load_efficiency' && 'Truck Load Capacity Efficiency'}
            {selectedChartType === 'shortage_analysis' && 'Delivery Shortage & Damage Analysis'}
            {selectedChartType === 'route_profitability' && 'Client Route Profitability (Revenue/KM)'}
          </h4>
        </div>

        {/* Dynamic Graph Filters */}
        <div className="shrink-0">
          {renderChartFilters()}
        </div>
      </div>

      {/* Graph Type Selection Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-zinc-100 pb-4">
        <button
          onClick={() => setSelectedChartType('invoice_totals')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'invoice_totals'
              ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/10"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          Invoice Totals
        </button>

        <button
          onClick={() => setSelectedChartType('top_customers')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'top_customers'
              ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/10"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <Users className="w-3.5 h-3.5" />
          Top Customers
        </button>

        <button
          onClick={() => setSelectedChartType('delivery_pipeline')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'delivery_pipeline'
              ? "bg-teal-600 border-teal-600 text-white shadow-sm shadow-[#0d9488]/10"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Delivery Pipeline
        </button>

        <button
          onClick={() => setSelectedChartType('truck_utilization')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'truck_utilization'
              ? "bg-amber-600 border-amber-600 text-white shadow-sm"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <TruckIcon className="w-3.5 h-3.5" />
          Fleet Dispatch
        </button>

        <button
          onClick={() => setSelectedChartType('district_distribution')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'district_distribution'
              ? "bg-pink-600 border-pink-600 text-white shadow-sm shadow-pink-600/10"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <MapPin className="w-3.5 h-3.5" />
          District Coverage
        </button>

        <button
          onClick={() => setSelectedChartType('top_products')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'top_products'
              ? "bg-purple-600 border-purple-600 text-white shadow-sm shadow-purple-600/10"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Best Sellers
        </button>

        <button
          type="button"
          title="Show fleet fuel cost & efficiency"
          onClick={() => setSelectedChartType('fuel_efficiency')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'fuel_efficiency'
              ? "bg-orange-600 border-orange-600 text-white shadow-sm shadow-orange-600/10"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <Fuel className="w-3.5 h-3.5" />
          Fuel Efficiency
        </button>

        <button
          type="button"
          title="Show truck utilization rate"
          onClick={() => setSelectedChartType('utilization_rate')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'utilization_rate'
              ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/10"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <Gauge className="w-3.5 h-3.5" />
          Utilization Rate
        </button>

        <button
          type="button"
          title="Show truck load capacity efficiency"
          onClick={() => setSelectedChartType('load_efficiency')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'load_efficiency'
              ? "bg-cyan-600 border-cyan-600 text-white shadow-sm shadow-cyan-600/10"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <PackageCheck className="w-3.5 h-3.5" />
          Load Efficiency
        </button>

        <button
          type="button"
          title="Show delivery shortage & damage analysis"
          onClick={() => setSelectedChartType('shortage_analysis')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'shortage_analysis'
              ? "bg-red-600 border-red-600 text-white shadow-sm shadow-red-600/10"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Shortage Analysis
        </button>

        <button
          type="button"
          title="Show client route profitability"
          onClick={() => setSelectedChartType('route_profitability')}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border",
            selectedChartType === 'route_profitability'
              ? "bg-violet-600 border-violet-600 text-white shadow-sm shadow-violet-600/10"
              : "bg-white border-zinc-200 text-zinc-650 hover:bg-zinc-50 hover:text-zinc-900"
          )}
        >
          <Route className="w-3.5 h-3.5" />
          Route Profit
        </button>
      </div>

      {/* Graph Display Canvas */}
      <div className="relative min-h-[320px] w-full mt-4 flex items-center justify-center">
        {renderSelectedChart()}
      </div>
    </div>
  );
}
