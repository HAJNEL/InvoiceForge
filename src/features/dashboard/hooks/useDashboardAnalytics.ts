import { useMemo } from 'react';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { Truck } from '../../trucks/hooks/useTrucks';
import { Trip } from '../../../types';
import { STATUS_DISPLAY_MAP, DAYS } from '../constants';
import { FuelLog } from './useFuelLogs';
import { Product } from '../../products/hooks/useProducts';
import { KpiTruckCapacity } from '../../kpi/hooks/useKpiTruckCapacity';

interface UseDashboardAnalyticsArgs {
  invoices: UIInvoice[];
  trucks: Truck[];
  trips: Trip[];
  weekOffset: number;
  fuelLogs: FuelLog[];
  products: Product[];
  capacityDoc: KpiTruckCapacity | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const COMPLETED_TRIP_STATUSES = ['completed', 'delivered', 'invoiced'];

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

export function useDashboardAnalytics({ invoices, trucks, trips, weekOffset, fuelLogs, products, capacityDoc }: UseDashboardAnalyticsArgs) {
  // Chart 1: Invoice totals calculations
  const invoiceTotalsOverTime = useMemo(() => {
    // Financial performance is plotted by delivery date (set when an invoice is
    // marked Delivered), not the invoice's own date - falls back to `date` for
    // invoices that haven't been delivered yet, matching ReportsPage.tsx.
    const getFinancialDateStr = (inv: UIInvoice) => inv.deliveredDate || inv.date;

    // Last 7 days daily
    const last7DaysData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const formattedLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const dayInvoices = invoices.filter(inv => getFinancialDateStr(inv) === dateStr);
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

      const dayInvoices = invoices.filter(inv => getFinancialDateStr(inv) === dateStr);
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
        const invDate = getInvoiceDateObj(getFinancialDateStr(inv));
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
          const raw = item as {
            stockCode?: string; stock_code?: string;
            description?: string;
            qty?: number; quantity?: number;
            value?: number; line_item_value?: number;
          };
          const rawCode = raw.stockCode || raw.stock_code || 'MISC';
          const rawDesc = raw.description || 'Misc Product';
          const rawQty = Number(raw.qty || raw.quantity || 0);
          const rawValue = Number(raw.value || raw.line_item_value || 0);

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

  // Chart 7: Fleet Fuel Cost & Efficiency - cost/km and km/liter per truck, derived
  // from the spread between each truck's lowest and highest logged odometer reading.
  const fuelAnalyticsData = useMemo(() => {
    return trucks.map(truck => {
      const logs = fuelLogs
        .filter(l => l.truckId === truck.id)
        .slice()
        .sort((a, b) => a.odometerReading - b.odometerReading);

      const totalCost = logs.reduce((sum, l) => sum + (l.cost || 0), 0);
      const totalLiters = logs.reduce((sum, l) => sum + (l.liters || 0), 0);
      const distanceKm = logs.length >= 2
        ? Math.max(0, logs[logs.length - 1].odometerReading - logs[0].odometerReading)
        : 0;

      return {
        name: truck.name,
        licensePlate: truck.licensePlate,
        totalCost,
        totalLiters,
        distanceKm,
        costPerKm: distanceKm > 0 ? round2(totalCost / distanceKm) : 0,
        kmPerLiter: distanceKm > 0 && totalLiters > 0 ? round2(distanceKm / totalLiters) : 0
      };
    }).filter(row => row.totalLiters > 0);
  }, [trucks, fuelLogs]);

  // Chart 8: Truck Utilization Rate - share of the last 30/90 days each truck had at least one trip.
  const utilizationRateData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff30 = new Date(today);
    cutoff30.setDate(cutoff30.getDate() - 29);
    const cutoff90 = new Date(today);
    cutoff90.setDate(cutoff90.getDate() - 89);

    return trucks.map(truck => {
      const dates30 = new Set<string>();
      const dates90 = new Set<string>();

      trips.filter(t => t.truckId === truck.id).forEach(t => {
        const d = getInvoiceDateObj(t.date);
        if (d >= cutoff90 && d <= today) dates90.add(t.date);
        if (d >= cutoff30 && d <= today) dates30.add(t.date);
      });

      return {
        name: truck.name,
        licensePlate: truck.licensePlate,
        active30: dates30.size,
        pct30: Math.round((dates30.size / 30) * 100),
        active90: dates90.size,
        pct90: Math.round((dates90.size / 90) * 100)
      };
    });
  }, [trucks, trips]);

  // Chart 9: Truck Load Efficiency - actual manifest qty vs the KPI truck-capacity
  // template's max units for that product/truck pair, weighted by qty and averaged per truck.
  const loadEfficiencyData = useMemo(() => {
    const stockCodeToProductId = new Map<string, string>();
    products.forEach(p => stockCodeToProductId.set(p.stockCode, p.id));
    const capacities = capacityDoc?.capacities || {};

    return trucks.map(truck => {
      let weightedAll = 0, weightAll = 0, itemsWithDataAll = 0;
      let weightedCompleted = 0, weightCompleted = 0, itemsWithDataCompleted = 0;

      trips
        .filter(t => t.truckId === truck.id && t.manifestItems && t.manifestItems.length > 0)
        .forEach(trip => {
          const isCompleted = COMPLETED_TRIP_STATUSES.includes((trip.status || '').toLowerCase());
          trip.manifestItems!.forEach(item => {
            const productId = stockCodeToProductId.get(item.stockCode);
            const maxCap = productId ? capacities[productId]?.[truck.id] : undefined;
            if (typeof maxCap === 'number' && maxCap > 0 && item.qty > 0) {
              const pct = Math.min(item.qty / maxCap, 1) * 100;
              weightedAll += pct * item.qty;
              weightAll += item.qty;
              itemsWithDataAll += 1;
              if (isCompleted) {
                weightedCompleted += pct * item.qty;
                weightCompleted += item.qty;
                itemsWithDataCompleted += 1;
              }
            }
          });
        });

      return {
        name: truck.name,
        licensePlate: truck.licensePlate,
        avgUtilizationAll: weightAll > 0 ? Math.round(weightedAll / weightAll) : null,
        itemsWithDataAll,
        avgUtilizationCompleted: weightCompleted > 0 ? Math.round(weightedCompleted / weightCompleted) : null,
        itemsWithDataCompleted
      };
    }).filter(row => row.itemsWithDataAll > 0);
  }, [trucks, trips, products, capacityDoc]);

  // Chart 10: Delivery Shortage & Damage Analysis, grouped by reason and by product.
  // `partialItems` is written under two keys (unified + legacy) for the same logical
  // flag - dedupe per-trip by content so a single short-delivery isn't counted twice.
  const shortageData = useMemo(() => {
    const byReason: Record<string, number> = {};
    const byProduct: Record<string, { name: string; shortfallQty: number }> = {};

    trips.forEach(trip => {
      if (!trip.partialItems) return;
      const seen = new Set<string>();

      Object.values(trip.partialItems).forEach(pi => {
        if (!pi?.isPartial) return;
        const dedupeKey = `${pi.stockCode || ''}|${pi.description || ''}|${pi.actualQty}|${pi.expectedQty}|${pi.reason || ''}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);

        const reason = (pi.reason || '').trim() || 'Unspecified';
        byReason[reason] = (byReason[reason] || 0) + 1;

        const shortfall = (pi.expectedQty || 0) - (pi.actualQty || 0);
        if (shortfall > 0) {
          const code = pi.stockCode || 'MISC';
          if (!byProduct[code]) byProduct[code] = { name: pi.description || code, shortfallQty: 0 };
          byProduct[code].shortfallQty += shortfall;
        }
      });
    });

    return {
      byReason: Object.entries(byReason)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      byProduct: Object.entries(byProduct)
        .map(([code, d]) => ({ code, name: d.name, shortfallQty: d.shortfallQty }))
        .sort((a, b) => b.shortfallQty - a.shortfallQty)
    };
  }, [trips]);

  // Chart 11: Client / Route Profitability - revenue per km, using each invoice's
  // manually-entered distanceKm (see useClientDistances) to flag low-value routes.
  const routeProfitData = useMemo(() => {
    const byClient: Record<string, { revenue: number; distance: number; count: number }> = {};
    invoices.forEach(inv => {
      if (!inv.distanceKm || inv.distanceKm <= 0) return;
      const name = inv.client || 'Unknown Customer';
      if (!byClient[name]) byClient[name] = { revenue: 0, distance: 0, count: 0 };
      byClient[name].revenue += (inv.amount || 0);
      byClient[name].distance += inv.distanceKm;
      byClient[name].count += 1;
    });

    return Object.entries(byClient).map(([name, d]) => ({
      name,
      revenuePerKm: d.distance > 0 ? round2(d.revenue / d.distance) : 0,
      totalRevenue: d.revenue,
      totalDistance: d.distance,
      invoiceCount: d.count
    })).sort((a, b) => b.revenuePerKm - a.revenuePerKm);
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
    // Scoped to the currently selected week (same Monday-Sunday range shown in the
    // Weekly Dispatch Schedule) so the KPI cards move in lockstep with weekOffset.
    const weekStart = weekDays[0]?.dateString;
    const weekEnd = weekDays[weekDays.length - 1]?.dateString;
    const getFinancialDateStr = (inv: UIInvoice) => inv.deliveredDate || inv.date;
    const weekInvoices = weekStart && weekEnd
      ? invoices.filter(inv => {
          const d = getFinancialDateStr(inv);
          return d >= weekStart && d <= weekEnd;
        })
      : invoices;

    if (!weekInvoices.length) return {
      total: 0,
      assembly: 0,
      loaded: 0,
      delivered: 0,
      invoicedAmt: 0
    };

    return weekInvoices.reduce((acc, inv) => {
      acc.total += 1;
      const status = inv.status.toLowerCase();
      if (status === 'assembly' || status === 'assembled') acc.assembly += 1;
      if (status === 'partially_complete' || status === 'partially complete' || status === 'partially-completed') acc.loaded += 1;
      if (status === 'completed' || status === 'delivered' || status === 'complete') acc.delivered += 1;
      if (status === 'invoiced') acc.invoicedAmt += (inv.amount || 0);
      return acc;
    }, { total: 0, assembly: 0, loaded: 0, delivered: 0, invoicedAmt: 0 });
  }, [invoices, weekDays]);

  const completedInvoices = useMemo(() => {
    // Includes partially-completed invoices so they remain visible alongside fully completed ones.
    return invoices.filter(inv => {
      const s = inv.status.toLowerCase();
      return s === 'completed' || s === 'delivered' ||
        s === 'partially_complete' || s === 'partially-completed' || s === 'partially complete';
    });
  }, [invoices]);

  const partiallyCompletedInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const s = inv.status.toLowerCase();
      return s === 'partially_complete' || s === 'partially-completed' || s === 'partially complete';
    });
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

  return {
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
    routeProfitData,
    weekDays,
    stats,
    completedInvoices,
    partiallyCompletedInvoices,
    weekNumber,
    getTripsForCell
  };
}
