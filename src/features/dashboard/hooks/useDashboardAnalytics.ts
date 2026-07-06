import { useMemo } from 'react';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { Truck } from '../../trucks/hooks/useTrucks';
import { Trip } from '../../../types';
import { STATUS_DISPLAY_MAP, DAYS } from '../constants';

interface UseDashboardAnalyticsArgs {
  invoices: UIInvoice[];
  trucks: Truck[];
  trips: Trip[];
  weekOffset: number;
}

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

export function useDashboardAnalytics({ invoices, trucks, trips, weekOffset }: UseDashboardAnalyticsArgs) {
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

    return invoices.reduce((acc, inv) => {
      acc.total += 1;
      const status = inv.status.toLowerCase();
      if (status === 'assembly' || status === 'assembled') acc.assembly += 1;
      if (status === 'partially_complete' || status === 'partially complete' || status === 'partially-completed') acc.loaded += 1;
      if (status === 'completed' || status === 'delivered' || status === 'complete') acc.delivered += 1;
      if (status === 'invoiced') acc.invoicedAmt += (inv.amount || 0);
      return acc;
    }, { total: 0, assembly: 0, loaded: 0, delivered: 0, invoicedAmt: 0 });
  }, [invoices]);

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

  return {
    invoiceTotalsOverTime,
    topCustomersData,
    pipelineData,
    truckUtilizationData,
    districtData,
    productData,
    weekDays,
    stats,
    completedInvoices,
    partiallyCompletedInvoices,
    recentActivity,
    weekNumber,
    getTripsForCell
  };
}
