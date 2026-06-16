import React, { useMemo, useState, useEffect } from 'react';
import { 
  ClipboardList,
  Package,
  FileCheck,
  Clock,
  Plus,
  Loader2,
  FileSearch,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Truck as TruckIcon,
  X,
  FileText,
  Calendar,
  BarChart3,
  TrendingUp,
  Users,
  MapPin,
  ShoppingBag
} from 'lucide-react';
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
import { Link, useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../../lib/utils';
import { useInvoices, UIInvoice } from '../invoices/hooks/useInvoices';
import { useTrucks, Truck } from '../trucks/hooks/useTrucks';
import { useTrips } from '../trips/hooks/useTrips';
import { Trip, TripStatus } from '../../types';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const STATUS_DISPLAY_MAP: Record<string, string> = {
  'partially_complete': 'Partially Complete',
  'partially complete': 'Partially Complete',
  'partiallycomplete': 'Partially Complete',
  loaded: 'Partially Complete',
  draft: 'Draft',
  darft: 'Draft',
  proposed: 'Proposed',
  assembled: 'Assembled',
  assembly: 'Assembled',
  'on-route': 'On Route',
  'on route': 'On Route',
  'on_route': 'On Route',
  delivered: 'Delivered',
  completed: 'Complete',
  complete: 'Complete',
  invoiced: 'Complete'
};
import { useAuth } from '../../core/hooks/useAuth';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      const checkTeamMember = async () => {
        try {
          const q = query(collection(db, 'team_members'), where('userId', '==', user.uid), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            navigate('/team-dashboard');
          }
        } catch (e) {
          console.error("Dashboard mount check team member error:", e);
        }
      };
      checkTeamMember();
    }
  }, [user, navigate]);

  const { invoices, loading: invoicesLoading, deleteInvoice, updateInvoice } = useInvoices();
  const { trucks, loading: trucksLoading } = useTrucks();
  const { trips, loading: tripsLoading, updateTrip } = useTrips();

  // Table Pagination States
  const [trucksPage, setTrucksPage] = useState(1);
  const trucksPerPage = 5;
  const totalTrucksPages = Math.ceil(trucks.length / trucksPerPage);
  const paginatedTrucks = useMemo(() => {
    const startIndex = (trucksPage - 1) * trucksPerPage;
    return trucks.slice(startIndex, startIndex + trucksPerPage);
  }, [trucks, trucksPage]);

  const [invoicesPage, setInvoicesPage] = useState(1);
  const invoicesPerPage = 5;
  const totalInvoicesPages = Math.ceil(invoices.length / invoicesPerPage);
  const paginatedInvoices = useMemo(() => {
    const startIndex = (invoicesPage - 1) * invoicesPerPage;
    return invoices.slice(startIndex, startIndex + invoicesPerPage);
  }, [invoices, invoicesPage]);
  
  const [showDeliveredModal, setShowDeliveredModal] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedCellInfo, setSelectedCellInfo] = useState<{
    dateString: string;
    dayName: string;
    truckId: string;
  } | null>(null);

  const loading = invoicesLoading || trucksLoading || tripsLoading;

  // Selected graph type to display in the business dashboard
  const [selectedChartType, setSelectedChartType] = useState<
    'invoice_totals' | 'top_customers' | 'delivery_pipeline' | 'truck_utilization' | 'district_distribution' | 'top_products'
  >('invoice_totals');

  // Specific graph filter states
  const [totalsTimeframe, setTotalsTimeframe] = useState<'last_7_days' | 'last_30_days' | 'last_12_months'>('last_30_days');
  const [customersMetric, setCustomersMetric] = useState<'value' | 'volume'>('value');
  const [customersLimit, setCustomersLimit] = useState<number>(5);
  const [pipelineMetric, setPipelineMetric] = useState<'count' | 'value'>('value');
  const [truckMetric, setTruckMetric] = useState<'total' | 'completed'>('total');
  const [districtMetric, setDistrictMetric] = useState<'revenue' | 'deliveries'>('revenue');
  const [productsMetric, setProductsMetric] = useState<'units' | 'revenue'>('units');
  const [productsLimit, setProductsLimit] = useState<number>(5);

  // Helper date parsing
  const getInvoiceDateObj = (dateStr?: string) => {
    if (!dateStr) return new Date(0);
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return new Date(y, m, d);
    }
    return new Date(dateStr);
  };

  // Chart 1: Invoice totals calculations
  const invoiceTotalsOverTime = useMemo(() => {
    // Last 7 days daily
    const last7DaysData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const formattedLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      const dayInvoices = invoices.filter(inv => inv.date === dateStr);
      const totalAmount = dayInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const count = dayInvoices.length;

      return { label: formattedLabel, amount: totalAmount, count };
    });

    // Last 30 days daily
    const last30DaysData = Array.from({ length: 30 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const formattedLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const dayInvoices = invoices.filter(inv => inv.date === dateStr);
      const totalAmount = dayInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const count = dayInvoices.length;

      return { label: formattedLabel, amount: totalAmount, count };
    });

    // Last 12 months monthly
    const last12MonthsData = Array.from({ length: 12 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (11 - i));
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const targetYear = d.getFullYear();
      const targetMonth = d.getMonth();

      const monthInvoices = invoices.filter(inv => {
        const invDate = getInvoiceDateObj(inv.date);
        return invDate.getFullYear() === targetYear && invDate.getMonth() === targetMonth;
      });

      const totalAmount = monthInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      const count = monthInvoices.length;

      return { label, amount: totalAmount, count };
    });

    return {
      last_7_days: last7DaysData,
      last_30_days: last30DaysData,
      last_12_months: last12MonthsData
    };
  }, [invoices]);

  // Chart 2: Top Customers
  const topCustomersData = useMemo(() => {
    const clientTotals: Record<string, { totalAmount: number; count: number }> = {};
    invoices.forEach(inv => {
      const clientName = inv.client || 'Unknown Customer';
      if (!clientTotals[clientName]) {
        clientTotals[clientName] = { totalAmount: 0, count: 0 };
      }
      clientTotals[clientName].totalAmount += (inv.amount || 0);
      clientTotals[clientName].count += 1;
    });

    return Object.entries(clientTotals).map(([name, stats]) => ({
      name,
      amount: stats.totalAmount,
      count: stats.count
    })).sort((a, b) => b.amount - a.amount);
  }, [invoices]);

  // Chart 3: Delivery Pipeline
  const pipelineData = useMemo(() => {
    const statusSums: Record<string, { count: number; value: number }> = {
      'draft': { count: 0, value: 0 },
      'assembly': { count: 0, value: 0 },
      'loaded': { count: 0, value: 0 },
      'delivered': { count: 0, value: 0 },
      'invoiced': { count: 0, value: 0 }
    };

    invoices.forEach(inv => {
      let s = (inv.status || 'draft').toLowerCase();
      if (s === 'assembled') s = 'assembly';
      if (s === 'partially_complete' || s === 'partially complete') s = 'loaded';
      if (s === 'completed' || s === 'complete') s = 'delivered';
      if (s === 'darft') s = 'draft';

      if (statusSums[s]) {
        statusSums[s].count += 1;
        statusSums[s].value += (inv.amount || 0);
      } else {
        statusSums[s] = { count: 1, value: (inv.amount || 0) };
      }
    });

    return Object.entries(statusSums).map(([status, d]) => ({
      status: STATUS_DISPLAY_MAP[status] || status.toUpperCase(),
      count: d.count,
      value: d.value
    }));
  }, [invoices]);

  // Chart 4: Truck Dispatch Engagement
  const truckUtilizationData = useMemo(() => {
    return trucks.map(truck => {
      const truckTrips = trips.filter(t => t.truckId === truck.id);
      const completedTrips = truckTrips.filter(t => (t.status || '').toLowerCase() === 'completed' || (t.status || '').toLowerCase() === 'delivered');
      const pendingTrips = truckTrips.filter(t => (t.status || '').toLowerCase() !== 'completed' && (t.status || '').toLowerCase() !== 'delivered');
      return {
        name: truck.name,
        licensePlate: truck.licensePlate,
        total: truckTrips.length,
        completed: completedTrips.length,
        pending: pendingTrips.length
      };
    }).sort((a, b) => b.total - a.total);
  }, [trucks, trips]);

  // Chart 5: Geographic / District distribution
  const districtData = useMemo(() => {
    const districtSums: Record<string, { count: number; value: number }> = {};
    invoices.forEach(inv => {
      const dStr = inv.district || 'Local Area';
      if (!districtSums[dStr]) {
        districtSums[dStr] = { count: 0, value: 0 };
      }
      districtSums[dStr].value += (inv.amount || 0);
      districtSums[dStr].count += 1;
    });

    return Object.entries(districtSums).map(([district, stats]) => ({
      district,
      revenue: stats.value,
      deliveries: stats.count
    })).sort((a, b) => b.revenue - a.revenue);
  }, [invoices]);

  // Chart 6: Top Selling Products
  const productData = useMemo(() => {
    const prodSums: Record<string, { qty: number; value: number; name: string }> = {};
    invoices.forEach(inv => {
      if (inv.lineItems && Array.isArray(inv.lineItems)) {
        inv.lineItems.forEach(item => {
          const rawCode = item.stockCode || item.stock_code || 'MISC';
          const rawDesc = item.description || 'Misc Product';
          const rawQty = Number(item.qty || item.quantity || 0);
          const rawValue = Number(item.value || item.line_item_value || 0);

          const key = `${rawCode}::${rawDesc}`;
          if (!prodSums[key]) {
            prodSums[key] = { qty: 0, value: 0, name: rawDesc };
          }
          prodSums[key].qty += rawQty;
          prodSums[key].value += rawValue;
        });
      }
    });

    return Object.entries(prodSums).map(([key, stats]) => {
      const [code] = key.split('::');
      return {
        code,
        name: stats.name,
        units: stats.qty,
        revenue: stats.value
      };
    }).sort((a, b) => b.units - a.units);
  }, [invoices]);

  const weekDays = useMemo(() => {
    const dates = [];
    const today = new Date();
    const currentDay = today.getDay();
    // Monday is index 1, Sunday is 0. If currentDay is 0, we seek -6 index offset for Monday of current week.
    const distanceToMonday = (currentDay === 0 ? -6 : 1 - currentDay) + (weekOffset * 7);

    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);

      const yyyy = day.getFullYear();
      const mm = String(day.getMonth() + 1).padStart(2, '0');
      const dd = String(day.getDate()).padStart(2, '0');
      const dateString = `${yyyy}-${mm}-${dd}`;

      const label = day.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      dates.push({
        dateString,
        label,
        dayName: DAYS[i]
      });
    }
    return dates;
  }, [weekOffset]);

  const stats = useMemo(() => {
    if (!invoices.length) return {
      total: 0,
      assembly: 0,
      loaded: 0,
      delivered: 0,
      invoicedAmt: 0
    };

    let startOfWeek: Date | null = null;
    let endOfWeek: Date | null = null;
    if (weekDays.length > 0) {
      startOfWeek = new Date(weekDays[0].dateString + 'T00:00:00');
      endOfWeek = new Date(weekDays[6].dateString + 'T23:59:59');
    }

    return invoices.reduce((acc, inv) => {
      acc.total += 1;
      const status = inv.status.toLowerCase();
      if (status === 'assembly' || status === 'assembled') acc.assembly += 1;
      if (status === 'loaded' || status === 'partially_complete' || status === 'partially complete') acc.loaded += 1;
      // DELIVERED KPI card based on the count of invoices on a "DELIVERED", "COMPLETED", or "COMPLETE" status
      if (status === 'completed' || status === 'delivered' || status === 'complete') acc.delivered += 1;
      
      // INVOICED KPI card based on the amount of invoices in an "INVOICED" status for the selected week
      if (status === 'invoiced') {
        const isDirectMatch = weekDays.some(day => day.dateString === inv.date);
        let isWithinWeekRange = isDirectMatch;
        
        if (!isWithinWeekRange && inv.date && startOfWeek && endOfWeek) {
          try {
            let invDateObj = new Date(inv.date + 'T00:00:00');
            if (isNaN(invDateObj.getTime())) {
              invDateObj = new Date(inv.date);
            }
            if (!isNaN(invDateObj.getTime()) && invDateObj >= startOfWeek && invDateObj <= endOfWeek) {
              isWithinWeekRange = true;
            }
          } catch {
            // ignore parse errors
          }
        }

        if (isWithinWeekRange) {
          acc.invoicedAmt += (inv.amount || 0);
        }
      }
      return acc;
    }, { total: 0, assembly: 0, loaded: 0, delivered: 0, invoicedAmt: 0 });
  }, [invoices, weekDays]);

  const completedInvoices = useMemo(() => {
    return invoices.filter(inv => inv.status.toLowerCase() === 'completed' || inv.status.toLowerCase() === 'delivered');
  }, [invoices]);

  const recentActivity = useMemo(() => {
    return invoices.slice(0, 5).map(inv => ({
      id: inv.id,
      title: `Invoice ${inv.number}`,
      desc: `For ${inv.client} • ${inv.date}`,
      status: inv.status
    }));
  }, [invoices]);

  const weekNumber = useMemo(() => {
    const today = new Date();
    const currentDay = today.getDay();
    const distanceToMonday = (currentDay === 0 ? -6 : 1 - currentDay) + (weekOffset * 7);
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    
    const target = new Date(monday);
    const dayNr = (monday.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  }, [weekOffset]);

  const getTripsForCell = (truckId: string, dateString: string) => {
    return trips.filter(trip => trip.truckId === truckId && trip.date === dateString);
  };

  // Render filters based on selected graph type
  const renderChartFilters = () => {
    switch (selectedChartType) {
      case 'invoice_totals':
        return (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Timeframe:</span>
            <select
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
              <select
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
              <select
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
    if (invoices.length === 0) {
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        <p className="text-zinc-500 text-sm">Synchronizing dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financial Overview</h1>
          <p className="text-zinc-500 text-sm mt-1">Monitor your business performance and invoice status.</p>
        </div>
        <div className="flex gap-3">
          <Link 
            to="/invoices/import"
            className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold hover:bg-zinc-50 transition-colors"
          >
            <Clock className="w-4 h-4" />
            Bulk Import
          </Link>
          <Link 
            to="/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Invoice
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="ASSEMBLY" 
          value={stats.assembly.toString()} 
          icon={ClipboardList} 
          color="bg-blue-50 text-blue-600"
          subtitle="Picking & Packing"
        />
        <StatCard 
          title="PARTIALLY COMPLETE" 
          value={stats.loaded.toString()} 
          icon={Package} 
          color="bg-amber-50 text-amber-600"
          subtitle="Ready for Transit"
        />
        <StatCard 
          title="DELIVERED" 
          value={stats.delivered.toString()} 
          icon={TruckIcon} 
          color="bg-indigo-50 text-indigo-600"
          subtitle="Click to view & bill"
          onClick={() => setShowDeliveredModal(true)}
        />
        <StatCard 
          title="INVOICED" 
          value={formatCurrency(stats.invoicedAmt)} 
          icon={FileCheck} 
          color="bg-emerald-50 text-emerald-600"
          subtitle="Invoiced Subtotal"
        />
      </div>

      {/* Weekly Dispatch Schedule */}
      <div className="saas-card overflow-hidden">
        <div className="bg-[#e0f2f1]/50 py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-[#2d3748] tracking-tight">Weekly Dispatch Schedule</h2>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-white text-[#2a7a72] border border-[#b2dfdb] shadow-xs select-none transition-all">
              <Calendar className="w-3.5 h-3.5 text-[#2a7a72]" />
              Week {weekNumber}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="px-3 py-1 bg-white border border-zinc-200 text-xs font-bold rounded-lg text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              ← Prev Week
            </button>
            <button 
              onClick={() => setWeekOffset(0)}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                weekOffset === 0 
                  ? "bg-brand-primary text-white" 
                  : "bg-white border border-zinc-200 text-zinc-650 hover:bg-zinc-50 shadow-sm"
              )}
            >
              Current
            </button>
            <button 
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="px-3 py-1 bg-white border border-zinc-200 text-xs font-bold rounded-lg text-zinc-600 hover:bg-zinc-50 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              Next Week →
            </button>
          </div>
        </div>
        <div className="p-6 overflow-x-auto">
          {trucks.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
              <TruckIcon className="w-10 h-10 text-zinc-300 mb-4" />
              <p className="text-sm font-medium text-zinc-900">No trucks in fleet</p>
              <p className="text-xs text-zinc-500 mt-1 mb-6">Add vehicles to manage your weekly dispatch schedule.</p>
              <Link 
                to="/trucks"
                className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all"
              >
                Add Truck
              </Link>
            </div>
          ) : (
            <>
              <table className="w-full min-w-[600px] border-collapse relative">
                <thead>
                  <tr>
                    <th className="w-40 bg-zinc-50 border border-zinc-100 py-4 px-4 text-left text-[10px] font-black text-zinc-400 uppercase tracking-widest">Truck Name</th>
                    {weekDays.map((day, idx) => (
                      <th key={idx} className="bg-zinc-50 border border-zinc-100 py-3 text-center min-w-[80px]">
                        <div className="text-xs font-black text-zinc-600">{day.dayName.substring(0, 3).toUpperCase()}</div>
                        <div className="text-[9px] font-bold text-zinc-400 font-mono mt-0.5">{day.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrucks.map((truck) => (
                    <tr key={truck.id}>
                      <td className="bg-white border border-zinc-100 py-4 px-4 text-xs font-bold text-zinc-700">
                        {truck.name}
                        <p className="text-[10px] text-zinc-400 font-mono font-normal">{truck.licensePlate}</p>
                      </td>
                      {weekDays.map((day, colIdx) => {
                        const cellTrips = getTripsForCell(truck.id, day.dateString);
                        const tripCount = cellTrips.length;
                        
                        return (
                          <td key={colIdx} className="border border-zinc-100 p-2">
                            <div 
                              onClick={() => setSelectedCellInfo({
                                dateString: day.dateString,
                                dayName: day.dayName,
                                truckId: truck.id
                              })}
                              className={cn(
                                "aspect-[4/3] w-full rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer",
                                tripCount > 0 
                                  ? "bg-brand-primary/5 border-brand-primary/20 hover:bg-brand-primary hover:border-brand-primary hover:shadow-lg hover:shadow-brand-primary/20 group" 
                                  : "bg-zinc-50/50 border-zinc-100 opacity-60 hover:opacity-100 hover:border-zinc-300 hover:bg-white"
                              )}
                            >
                              {tripCount > 0 ? (
                                <>
                                  <span className="text-sm font-black text-brand-primary group-hover:text-white">{tripCount}</span>
                                  <span className="text-[8px] font-bold uppercase tracking-tighter text-brand-primary/60 group-hover:text-white/80">
                                    {tripCount === 1 ? 'Trip' : 'Trips'}
                                  </span>
                                </>
                              ) : (
                                <Plus className="w-3.5 h-3.5 text-zinc-300 transition-colors" />
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalTrucksPages > 1 && (
                <div className="flex items-center justify-between px-2 py-3 border-t border-zinc-150 mt-4 bg-zinc-50/50 rounded-xl">
                  <span className="text-xs text-zinc-500 font-medium">
                    Showing <span className="font-bold text-zinc-800">{((trucksPage - 1) * trucksPerPage) + 1}</span> to <span className="font-bold text-zinc-800">{Math.min(trucksPage * trucksPerPage, trucks.length)}</span> of <span className="font-bold text-zinc-800">{trucks.length}</span> trucks
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTrucksPage(prev => Math.max(1, prev - 1))}
                      disabled={trucksPage === 1}
                      className="p-1 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                      title="Previous Page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalTrucksPages }).map((_, i) => {
                        const pNum = i + 1;
                        return (
                          <button
                            key={pNum}
                            onClick={() => setTrucksPage(pNum)}
                            className={cn(
                              "w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg border transition",
                              trucksPage === pNum 
                                ? "bg-brand-primary border-brand-primary text-white" 
                                : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                            )}
                          >
                            {pNum}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setTrucksPage(prev => Math.min(totalTrucksPages, prev + 1))}
                      disabled={trucksPage === totalTrucksPages}
                      className="p-1 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                      title="Next Page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                <p>Click on grid cells to view, change, or schedule trips on that day</p>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-brand-primary"></div> Scheduled Trips</span>
                  <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-zinc-200"></div> No Trips</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedCellInfo && (
        <DispatchTripsModal
          dateString={selectedCellInfo.dateString}
          truck={trucks.find(t => t.id === selectedCellInfo.truckId)}
          trips={getTripsForCell(selectedCellInfo.truckId, selectedCellInfo.dateString)}
          onClose={() => setSelectedCellInfo(null)}
          onUpdateStatus={updateTrip}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 saas-card p-6">
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

        <div className="saas-card p-6">
          <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500 mb-8">Recent Activity</h3>
          {recentActivity.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-xs text-zinc-400 font-bold uppercase tracking-widest">No recent activity</div>
            </div>
          ) : (
            <div className="space-y-6">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activity.title}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{activity.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Link to="/invoices" className="w-full inline-block mt-8 text-sm font-bold text-brand-accent hover:underline text-center">
            View all invoices
          </Link>
        </div>
      </div>

      <div className="saas-card p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-sm uppercase tracking-widest text-zinc-500">Recent Invoices</h3>
          <Link to="/invoices" className="text-xs font-bold text-zinc-400 hover:text-brand-accent flex items-center gap-1 transition-colors">
            View All <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        
        {invoices.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center border border-dashed border-zinc-100 rounded-xl">
            <FileSearch className="w-10 h-10 text-zinc-200 mb-4" />
            <p className="text-sm font-medium text-zinc-900">Your invoice list is empty</p>
            <p className="text-xs text-zinc-500 mt-1 mb-6">Start by uploading a PDF invoice for AI extraction.</p>
            <Link 
              to="/invoices/import"
              className="px-6 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all"
            >
              Get Started
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 italic font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                  <th className="pb-4 font-normal">Invoice</th>
                  <th className="pb-4 font-normal">Client</th>
                  <th className="pb-4 font-normal">Date</th>
                  <th className="pb-4 font-normal">Amount</th>
                  <th className="pb-4 font-normal">Status</th>
                  <th className="pb-4 font-normal"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {paginatedInvoices.map((invoice) => (
                  <tr key={invoice.id} className="group hover:bg-zinc-50/50 transition-colors">
                    <td className="py-4">
                      <Link to={`/invoices/${invoice.id}`} className="font-mono text-xs font-medium hover:text-brand-accent">
                        {invoice.number}
                      </Link>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{invoice.client}</span>
                        <span className="text-[10px] text-zinc-500">{invoice.clientEmail}</span>
                      </div>
                    </td>
                    <td className="py-4 text-sm text-zinc-600 font-mono italic">{invoice.date}</td>
                    <td className="py-4 text-sm font-bold tabular-nums">R {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-4">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="py-4 text-right">
                      <button 
                        onClick={() => deleteInvoice(invoice.id)}
                        className="p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 rounded-lg text-red-500"
                        title="Delete Invoice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalInvoicesPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4 border-t border-zinc-150 mt-4 bg-zinc-50/50 rounded-xl">
              <span className="text-xs text-zinc-500 font-medium">
                Showing <span className="font-bold text-zinc-800">{((invoicesPage - 1) * invoicesPerPage) + 1}</span> to <span className="font-bold text-zinc-800">{Math.min(invoicesPage * invoicesPerPage, invoices.length)}</span> of <span className="font-bold text-zinc-800">{invoices.length}</span> invoices
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setInvoicesPage(prev => Math.max(1, prev - 1))}
                  disabled={invoicesPage === 1}
                  className="p-1 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalInvoicesPages }).map((_, i) => {
                    const pNum = i + 1;
                    if (totalInvoicesPages > 5 && Math.abs(invoicesPage - pNum) > 1 && pNum !== 1 && pNum !== totalInvoicesPages) {
                      if (Math.abs(invoicesPage - pNum) === 2) {
                        return <span key={pNum} className="text-xs text-zinc-400 font-bold px-0.5">...</span>;
                      }
                      return null;
                    }
                    return (
                      <button
                        key={pNum}
                        onClick={() => setInvoicesPage(pNum)}
                        className={cn(
                          "w-6 h-6 flex items-center justify-center text-xs font-bold rounded-lg border transition",
                          invoicesPage === pNum 
                            ? "bg-brand-primary border-brand-primary text-white" 
                            : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                        )}
                      >
                        {pNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setInvoicesPage(prev => Math.min(totalInvoicesPages, prev + 1))}
                  disabled={invoicesPage === totalInvoicesPages}
                  className="p-1 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {showDeliveredModal && (
        <DeliveredInvoicesModal
          invoices={completedInvoices}
          onClose={() => setShowDeliveredModal(false)}
          onUpdateStatus={updateInvoice}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const norm = status.toLowerCase();
  const styles: Record<string, string> = {
    invoiced: "bg-emerald-50 text-emerald-600 border-emerald-100",
    delivered: "bg-indigo-50 text-indigo-600 border-indigo-100",
    completed: "bg-indigo-50 text-indigo-600 border-indigo-100",
    complete: "bg-indigo-50 text-indigo-600 border-indigo-100",
    loaded: "bg-amber-50 text-amber-600 border-amber-100",
    'partially_complete': "bg-amber-50 text-amber-600 border-amber-100",
    'partially complete': "bg-amber-50 text-amber-600 border-amber-100",
    assembly: "bg-blue-50 text-blue-600 border-blue-100",
    draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
    darft: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };

  const label = STATUS_DISPLAY_MAP[norm] || status;

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
      styles[norm] || styles.draft
    )}>
      {label}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle, onClick }: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "saas-card p-6 group transition-all relative overflow-hidden",
        onClick 
          ? "cursor-pointer hover:border-brand-primary hover:shadow-xl hover:shadow-zinc-100 active:scale-[0.98]" 
          : "hover:translate-y-[-2px] hover:shadow-xl hover:shadow-zinc-100"
      )}
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-50 rounded-full -mr-12 -mt-12 opacity-50 group-hover:scale-110 transition-transform" />
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className={cn("p-2.5 rounded-xl transition-all group-hover:scale-110", color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="h-1 w-8 bg-zinc-100 rounded-full" />
      </div>
      <div className="relative z-10">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">{title}</p>
        <p className="text-3xl font-black mt-1 tracking-tight tabular-nums text-zinc-900">{value}</p>
        {subtitle && (
          <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-tight">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function DeliveredInvoicesModal({ invoices, onClose, onUpdateStatus }: {
  invoices: UIInvoice[];
  onClose: () => void;
  onUpdateStatus: (id: string, data: Partial<Record<string, unknown>>) => Promise<boolean>;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<UIInvoice | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleMarkAsInvoiced = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await onUpdateStatus(invoiceId, { status: 'invoiced' });
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(prev => prev ? { ...prev, status: 'invoiced' } : null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-zinc-900">
      <div className="absolute inset-0 bg-zinc-900/45 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className={cn(
        "bg-white rounded-2xl w-full relative z-10 shadow-2xl overflow-hidden transition-all duration-300 flex flex-col max-h-[85vh] md:flex-row",
        selectedInvoice ? "max-w-4xl" : "max-w-xl"
      )}>
        {/* Left Side: Invoice List */}
        <div className={cn("flex flex-col flex-1 border-r border-zinc-100 max-h-[85vh]", selectedInvoice ? "md:max-w-md" : "w-full")}>
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div>
              <h2 className="text-lg font-bold">Delivered Invoices</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">In Completed Status ({invoices.length})</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {invoices.length === 0 ? (
              <div className="py-12 text-center">
                <FileCheck className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Completed Invoices</p>
                <p className="text-zinc-400 text-[10px] mt-1">When trip deliveries are finalized, invoices appear here.</p>
              </div>
            ) : (
              invoices.map((inv) => (
                <div 
                  key={inv.id}
                  className={cn(
                    "p-4 border rounded-xl transition-all flex flex-col gap-3 relative overflow-hidden group",
                    selectedInvoice?.id === inv.id 
                      ? "border-brand-primary bg-brand-primary/5 shadow-sm" 
                      : "border-zinc-100 hover:border-zinc-200 bg-white"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div 
                      className="cursor-pointer flex-1"
                      onClick={() => setSelectedInvoice(inv.id === selectedInvoice?.id ? null : inv)}
                    >
                      <p className="text-sm font-black text-zinc-900 flex items-center gap-1.5 hover:text-brand-primary">
                        {inv.number}
                        <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold tracking-widest uppercase rounded">
                          {inv.status}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">{inv.client}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs font-black text-zinc-800">R {inv.amount.toLocaleString()}</span>
                        <span className="text-[10px] text-zinc-400">{inv.date}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 justify-center">
                      <button
                        onClick={() => setSelectedInvoice(inv.id === selectedInvoice?.id ? null : inv)}
                        className="px-2.5 py-1 text-[10px] font-bold border border-zinc-200 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-all flex items-center gap-1 self-end"
                        title="View Info"
                      >
                        <FileText className="w-3 h-3 text-zinc-500" />
                        Info
                      </button>
                      <button
                        onClick={() => handleMarkAsInvoiced(inv.id)}
                        disabled={updatingId === inv.id}
                        className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                      >
                        {updatingId === inv.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileCheck className="w-3.5 h-3.5" />
                        )}
                        Invoice
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Invoice Detail Pane */}
        {selectedInvoice && (
          <div className="flex-1 flex flex-col max-h-[85vh] bg-zinc-50/50 w-full md:w-[480px] animate-in slide-in-from-right duration-250">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="font-bold text-sm">Invoice Information</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{selectedInvoice.number}</p>
              </div>
              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="p-1 hover:bg-zinc-250 rounded text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Client and Metadata Info */}
              <div className="bg-white border border-zinc-100 p-4 rounded-xl space-y-3 shadow-inner">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">School / Client Name</span>
                  <p className="text-sm font-bold text-zinc-800">{selectedInvoice.client}</p>
                </div>
                {selectedInvoice.clientEmail && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Client Email</span>
                    <p className="text-xs text-zinc-650 font-mono">{selectedInvoice.clientEmail}</p>
                  </div>
                )}
                {selectedInvoice.district && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Delivery District</span>
                    <p className="text-xs text-zinc-650 font-bold">{selectedInvoice.district}</p>
                  </div>
                )}
                {(selectedInvoice.deliveryAddressLine1 || selectedInvoice.deliveryAddressLine2) && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Delivery Address</span>
                    <p className="text-xs text-zinc-650 leading-relaxed">
                      {selectedInvoice.deliveryAddressLine1} {selectedInvoice.deliveryAddressLine2}
                    </p>
                  </div>
                )}
              </div>

              {/* Financials Summary */}
              <div className="bg-white border border-zinc-100 p-4 rounded-xl space-y-3.5 shadow-inner">
                <div className="flex justify-between items-center pb-2.5 border-b border-zinc-100">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Invoice Subtotal</span>
                  <span className="text-sm font-black text-zinc-900">R {selectedInvoice.amount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Invoice Issue Date</span>
                  <p className="text-xs text-zinc-700">{selectedInvoice.date}</p>
                </div>
              </div>

              {/* Line Items checklist */}
              {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Product Line Items</h4>
                  <div className="bg-white border border-zinc-100 rounded-xl divide-y divide-zinc-50 overflow-hidden">
                    {selectedInvoice.lineItems.map((item, idx) => (
                      <div key={idx} className="p-3 flex justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-zinc-800">{item.description}</p>
                          <span className="text-[10px] font-mono text-zinc-400">Code: {item.stockCode || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-zinc-850">Qty: {item.qty}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">Value: R {item.value?.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-4">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-100 text-zinc-600"
              >
                Clear Selection
              </button>
              {selectedInvoice.status.toLowerCase() !== 'invoiced' && (
                <button
                  onClick={() => handleMarkAsInvoiced(selectedInvoice.id)}
                  disabled={updatingId === selectedInvoice.id}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                >
                  {updatingId === selectedInvoice.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileCheck className="w-3.5 h-3.5" />
                  )}
                  Mark Invoiced
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DispatchTripsModal({ 
  dateString, 
  truck, 
  trips, 
  onClose,
  onUpdateStatus
}: {
  dateString: string;
  truck?: Truck;
  trips: Trip[];
  onClose: () => void;
  onUpdateStatus: (id: string, tripData: Partial<Trip>) => Promise<boolean>;
}) {
  const navigate = useNavigate();

  // Format readable date
  const dateFormatted = new Date(dateString + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-zinc-900">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="bg-white rounded-2xl w-full max-w-xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h2 className="text-lg font-bold">Trips for {truck?.name || 'Truck'}</h2>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{dateFormatted}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {trips.length === 0 ? (
            <div className="py-12 text-center">
              <Calendar className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
              <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Trips Scheduled</p>
              <p className="text-zinc-400 text-[10px] mt-1 mb-6">There are no trips created for this truck on this day.</p>
              <button
                onClick={() => {
                  onClose();
                  navigate(`/trips/new?date=${dateString}&truckId=${truck?.id}`);
                }}
                className="px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all flex items-center gap-1.5 mx-auto shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Schedule a Trip
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {trips.map((trip) => (
                <div key={trip.id} className="p-4 border border-zinc-100 bg-zinc-50/20 rounded-xl space-y-3 hover:border-zinc-200 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-sm text-zinc-900">{trip.name || 'Unnamed Trip'}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Invoices: <span className="font-bold font-mono">{trip.invoiceIds?.length || 0}</span>
                      </p>
                    </div>
                    {/* Status Select inside dialog to edit status immediately! */}
                    <div className="flex flex-col items-end gap-1.5">
                      <select
                        value={trip.status}
                        onChange={async (e) => {
                          const nextStatus = e.target.value as TripStatus;
                          await onUpdateStatus(trip.id, { status: nextStatus });
                        }}
                        className="text-xs font-bold bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-none text-zinc-700 shadow-sm"
                      >
                        <option value="proposed">Proposed</option>
                        <option value="assembled">Assembled</option>
                        <option value="on-route">On Route</option>
                        <option value="partially-completed">Partially Completed</option>
                        <option value="completed">Completed</option>
                        <option value="invoiced">Invoiced</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-zinc-100">
                    <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest bg-zinc-100 px-2 py-0.5 rounded">
                      Status: {trip.status}
                    </span>
                    <button
                      onClick={() => {
                        onClose();
                        navigate(`/trips/edit/${trip.id}`);
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold bg-brand-primary text-white rounded-lg hover:bg-zinc-800 transition-all shadow-sm flex items-center gap-1"
                    >
                      Edit Trip Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-4">
          <button
            onClick={() => {
              onClose();
              navigate(`/trips/new?date=${dateString}&truckId=${truck?.id}`);
            }}
            className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 rounded-lg text-xs font-bold hover:bg-zinc-50 transition-all flex items-center gap-1 shadow-sm"
          >
            <Plus className="w-4 h-4 text-zinc-500" />
            Add Another Trip
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

