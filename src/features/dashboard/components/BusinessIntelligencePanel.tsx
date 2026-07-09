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
  Truck as TruckIcon
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
  | 'top_products';

export function BusinessIntelligencePanel({
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
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e4e4e7', fontSize: '10px', maxWidth: '280px', fontWeight: 'bold' }}
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
      </div>

      {/* Graph Display Canvas */}
      <div className="relative min-h-[320px] w-full mt-4 flex items-center justify-center">
        {renderSelectedChart()}
      </div>
    </div>
  );
}
