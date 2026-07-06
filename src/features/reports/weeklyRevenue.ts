import { getAssemblyRate } from './assemblyRates';

// Commission & diesel surcharge rates — update here when pricing changes.
export const REGIONAL_DISTANCE_THRESHOLD_KM = 50;
export const LOCAL_COMMISSION_RATE = 0.06; // distance < 50km
export const LOCAL_DIESEL_SURCHARGE_RATE = 0.015;
export const REGIONAL_COMMISSION_RATE = 0.08; // distance >= 50km
export const REGIONAL_DIESEL_SURCHARGE_RATE = 0.02;

// Invoice statuses that count as revenue-earning jobs.
export const REVENUE_EARNING_STATUSES = ['delivered', 'complete', 'completed', 'invoiced'];

export interface RevenueJob {
  date: Date;
  // Delivery distance in km. Jobs without a recorded distance are treated as Local.
  distanceKm: number | null;
  deliveryValue: number; // invoice subtotal (Rand, excl. VAT)
  items: { stockCode: string; qty: number }[];
}

export interface JobRevenue {
  travelRevenue: number;
  assemblyRevenue: number;
  totalRevenue: number;
  isRegional: boolean;
}

export interface WeeklyRevenuePoint {
  weekStart: string; // ISO date of the Monday
  weekEnd: string; // ISO date of the Sunday
  travelRevenue: number;
  assemblyRevenue: number;
  totalRevenue: number;
  jobCount: number;
}

export function calculateJobRevenue(job: RevenueJob): JobRevenue {
  const isRegional = (job.distanceKm ?? 0) >= REGIONAL_DISTANCE_THRESHOLD_KM;
  const commissionRate = isRegional ? REGIONAL_COMMISSION_RATE : LOCAL_COMMISSION_RATE;
  const surchargeRate = isRegional ? REGIONAL_DIESEL_SURCHARGE_RATE : LOCAL_DIESEL_SURCHARGE_RATE;

  const travelRevenue = job.deliveryValue * (commissionRate + surchargeRate);
  const assemblyRevenue = job.items.reduce(
    (sum, item) => sum + item.qty * getAssemblyRate(item.stockCode),
    0
  );

  return {
    travelRevenue,
    assemblyRevenue,
    totalRevenue: travelRevenue + assemblyRevenue,
    isRegional,
  };
}

// Shared UIInvoice -> RevenueJob mapping, used by both the Client Invoice picker
// (SelfInvoiceModal) and its Excel export, so the two never compute a total
// differently. Duck-typed (not importing UIInvoice) to keep this module feature-
// agnostic. `distanceOverrideKm` lets a caller feed in an unsaved draft value
// (e.g. mid-edit in a table row) instead of the invoice's persisted distanceKm.
export function invoiceToRevenueJob(
  inv: { amount: number; distanceKm?: number; lineItems?: { stockCode: string; qty: number }[] },
  distanceOverrideKm?: number | null
): RevenueJob {
  return {
    date: new Date(), // unused by calculateJobRevenue's math
    distanceKm: distanceOverrideKm !== undefined ? distanceOverrideKm : (inv.distanceKm ?? null),
    deliveryValue: inv.amount || 0,
    items: (inv.lineItems || []).map(li => ({ stockCode: li.stockCode, qty: li.qty })),
  };
}

// Invoice dates appear in mixed formats in Firestore: "2026-07-02" and "30/06/26".
export function parseJobDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    return new Date(year, Number(dmy[2]) - 1, Number(dmy[1]));
  }

  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function startOfWeekMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Groups jobs into Monday–Sunday calendar weeks and sums revenue per week.
 * Returns a continuous series of the last `weeksCount` weeks ending with the
 * current week — weeks with no jobs are included with zero values so the
 * chart has no gaps.
 */
export function buildWeeklyRevenueSeries(jobs: RevenueJob[], weeksCount: number): WeeklyRevenuePoint[] {
  const currentWeekStart = startOfWeekMonday(new Date());
  const points: WeeklyRevenuePoint[] = [];
  const buckets = new Map<number, WeeklyRevenuePoint>();

  for (let i = weeksCount - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const point: WeeklyRevenuePoint = {
      weekStart: toIsoDate(weekStart),
      weekEnd: toIsoDate(weekEnd),
      travelRevenue: 0,
      assemblyRevenue: 0,
      totalRevenue: 0,
      jobCount: 0,
    };
    points.push(point);
    buckets.set(weekStart.getTime(), point);
  }

  for (const job of jobs) {
    const bucket = buckets.get(startOfWeekMonday(job.date).getTime());
    if (!bucket) continue; // outside the selected range

    const revenue = calculateJobRevenue(job);
    bucket.travelRevenue += revenue.travelRevenue;
    bucket.assemblyRevenue += revenue.assemblyRevenue;
    bucket.totalRevenue += revenue.totalRevenue;
    bucket.jobCount += 1;
  }

  for (const point of points) {
    point.travelRevenue = round2(point.travelRevenue);
    point.assemblyRevenue = round2(point.assemblyRevenue);
    point.totalRevenue = round2(point.totalRevenue);
  }

  return points;
}
