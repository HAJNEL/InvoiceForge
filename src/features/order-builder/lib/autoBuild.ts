/// <reference types="google.maps" />
import { orderNumberSortValue, buildSchoolGroups } from '../utils';
import { schoolKeyFor } from '../../../lib/geocoding';
import { computeRoute, isOnTheWay, straightLineDistanceMeters, type RouteStop } from './routing';
import type { Order } from '../../orders/hooks/useOrders';
import type { OrderBuildSchoolGroup } from '../types';

// A candidate school and everything the 5 allocation strategies need to decide
// whether/where to place it. Built once per Auto-Build run (see
// buildCandidatePool), then handed to each strategy unchanged - the strategies
// themselves are pure/synchronous and never call the Directions API.
export interface CandidateSchool {
  schoolKey: string;
  schoolName: string;
  orders: Order[];
  position: { lat: number; lng: number };
  totalWeightKg: number;
  distanceFromWarehouseMeters: number;
  detourRatio: number; // 0 for the anchor school itself
  isAnchorSchool: boolean;
}

export interface AutoBuildTruckInput {
  id: string;
  name: string;
  capacityKg: number;
}

export interface AutoBuildInput {
  eligibleOrders: Order[];
  trucks: AutoBuildTruckInput[];
  warehouse: { lat: number; lng: number };
  schoolPositions: Record<string, { lat: number; lng: number }>; // schoolKey -> position, already geocoded by the map
  weightByStockCode: Record<string, number>;
  unitPriceByStockCode: Record<string, number>;
  directionsService: google.maps.DirectionsService;
}

export interface AutoBuildTruckAssignment {
  truckId: string;
  truckName: string;
  capacityKg: number;
  schoolGroups: OrderBuildSchoolGroup[];
  totalWeightKg: number;
  weightUtilizationPct: number;
  estimatedDistanceMeters: number;
  estimatedTravelTimeSeconds: number;
}

export interface AutoBuildOption {
  strategyId: 'max-schools' | 'max-weight-utilization' | 'fewest-trucks' | 'shortest-route' | 'balanced';
  label: string;
  truckAssignments: AutoBuildTruckAssignment[];
  totalSchools: number;
  totalOrders: number;
  totalValueRand: number;
  totalTrucksUsed: number;
  totalEstimatedDistanceMeters: number;
  totalEstimatedTravelTimeSeconds: number;
}

// Straight-line pre-filter radius before spending a Directions call on a
// candidate school - purely to save API calls on obviously-irrelevant schools,
// not a business rule. Tunable.
const CANDIDATE_PREFILTER_RADIUS_METERS = 50_000;

function stockCodeKey(code: string): string {
  return code.toLowerCase().trim();
}

function orderWeightKg(order: Order, weightByStockCode: Record<string, number>): number {
  return order.lineItems.reduce((sum, li) => sum + li.qty * (weightByStockCode[stockCodeKey(li.stockCode)] ?? 0), 0);
}

function orderValueRand(order: Order, unitPriceByStockCode: Record<string, number>): number {
  return order.lineItems.reduce((sum, li) => sum + li.qty * (unitPriceByStockCode[stockCodeKey(li.stockCode)] ?? 0), 0);
}

// Groups eligibleOrders by school, keeping the anchor's school + every
// on-the-way school (per isOnTheWay), discarding anything too far to matter.
// Async - makes real Directions API calls, one per surviving pre-filtered
// candidate school.
export async function buildCandidatePool(input: AutoBuildInput, anchorOrder: Order): Promise<CandidateSchool[]> {
  const { eligibleOrders, warehouse, schoolPositions, weightByStockCode, directionsService } = input;
  const anchorSchoolKey = schoolKeyFor(anchorOrder.schoolName);
  const anchorPosition = schoolPositions[anchorSchoolKey];

  const bySchool = new Map<string, { schoolName: string; orders: Order[] }>();
  for (const order of eligibleOrders) {
    const key = schoolKeyFor(order.schoolName);
    const existing = bySchool.get(key);
    if (existing) existing.orders.push(order);
    else bySchool.set(key, { schoolName: order.schoolName, orders: [order] });
  }

  const pool: CandidateSchool[] = [];

  for (const [key, group] of bySchool) {
    const position = schoolPositions[key];
    if (!position) continue; // not yet geocoded - can't evaluate, skip rather than guess

    const totalWeightKg = group.orders.reduce((s, o) => s + orderWeightKg(o, weightByStockCode), 0);
    const distanceFromWarehouseMeters = straightLineDistanceMeters(warehouse, position);

    if (key === anchorSchoolKey) {
      pool.push({
        schoolKey: key,
        schoolName: group.schoolName,
        orders: group.orders,
        position,
        totalWeightKg,
        distanceFromWarehouseMeters,
        detourRatio: 0,
        isAnchorSchool: true
      });
      continue;
    }

    if (!anchorPosition) continue; // can't run the detour check without the anchor's own position
    if (straightLineDistanceMeters(anchorPosition, position) > CANDIDATE_PREFILTER_RADIUS_METERS) continue;

    const anchorStop: RouteStop = { id: anchorSchoolKey, position: anchorPosition };
    const candidateStop: RouteStop = { id: key, position };
    const detour = await isOnTheWay(directionsService, warehouse, candidateStop, anchorStop);
    if (!detour.onTheWay) continue;

    pool.push({
      schoolKey: key,
      schoolName: group.schoolName,
      orders: group.orders,
      position,
      totalWeightKg,
      distanceFromWarehouseMeters,
      detourRatio: detour.detourRatio,
      isAnchorSchool: false
    });
  }

  return pool;
}

interface TruckBucket {
  truck: AutoBuildTruckInput;
  schools: CandidateSchool[];
  totalWeightKg: number;
}

function emptyBuckets(trucks: AutoBuildTruckInput[]): TruckBucket[] {
  return trucks.map(truck => ({ truck, schools: [], totalWeightKg: 0 }));
}

function fits(bucket: TruckBucket, school: CandidateSchool): boolean {
  return bucket.totalWeightKg + school.totalWeightKg <= bucket.truck.capacityKg;
}

function place(bucket: TruckBucket, school: CandidateSchool) {
  bucket.schools.push(school);
  bucket.totalWeightKg += school.totalWeightKg;
}

// Strategy 1: cover the most schools. First-fit by proximity to the warehouse -
// closest schools placed first, into the first ticked truck (in ticked order)
// that still has room; skip (don't abort) a school that fits nowhere.
function allocateMaxSchools(candidates: CandidateSchool[], trucks: AutoBuildTruckInput[]): TruckBucket[] {
  const buckets = emptyBuckets(trucks);
  const sorted = [...candidates].sort((a, b) => a.distanceFromWarehouseMeters - b.distanceFromWarehouseMeters);
  for (const school of sorted) {
    const bucket = buckets.find(b => fits(b, school));
    if (bucket) place(bucket, school);
  }
  return buckets;
}

// Strategy 2: fill trucks as full as possible. Best-Fit-Decreasing across ALL
// ticked trucks simultaneously (a standard bin-packing heuristic) - largest
// schools placed first, each into whichever truck leaves the LEAST leftover
// capacity, rather than filling one truck completely before touching the next
// (that's strategy 3 below - the two are deliberately different heuristics).
function allocateMaxWeightUtilization(candidates: CandidateSchool[], trucks: AutoBuildTruckInput[]): TruckBucket[] {
  const buckets = emptyBuckets(trucks);
  const sorted = [...candidates].sort((a, b) => b.totalWeightKg - a.totalWeightKg);
  for (const school of sorted) {
    let best: TruckBucket | null = null;
    let bestSlack = Infinity;
    for (const bucket of buckets) {
      if (!fits(bucket, school)) continue;
      const slack = bucket.truck.capacityKg - bucket.totalWeightKg - school.totalWeightKg;
      if (slack < bestSlack) {
        best = bucket;
        bestSlack = slack;
      }
    }
    if (best) place(best, school);
  }
  return buckets;
}

// Fills trucks sequentially (largest truck first, fully greedy-filled by
// largest-remaining-candidate-that-fits before moving to the next truck) -
// shared by strategy 3 (fewest-trucks, which then trims unnecessary trucks off
// the end) and used internally to determine full-fleet coverage.
function sequentialFill(candidates: CandidateSchool[], trucks: AutoBuildTruckInput[]): TruckBucket[] {
  const buckets = emptyBuckets(trucks);
  const remaining = [...candidates];
  for (const bucket of buckets) {
    let placedSomething = true;
    while (placedSomething) {
      placedSomething = false;
      let bestIdx = -1;
      let bestWeight = -1;
      remaining.forEach((school, i) => {
        if (fits(bucket, school) && school.totalWeightKg > bestWeight) {
          bestWeight = school.totalWeightKg;
          bestIdx = i;
        }
      });
      if (bestIdx !== -1) {
        place(bucket, remaining[bestIdx]);
        remaining.splice(bestIdx, 1);
        placedSomething = true;
      }
    }
  }
  return buckets;
}

// Strategy 3: use the fewest trucks. Finds the smallest prefix of the
// (capacity-descending-sorted) ticked trucks that achieves the SAME school
// coverage as using the full ticked fleet would - i.e. stops adding trucks once
// more of them stop actually helping, leaving smaller/extra trucks unused.
function allocateFewestTrucks(candidates: CandidateSchool[], trucks: AutoBuildTruckInput[]): TruckBucket[] {
  const sortedTrucks = [...trucks].sort((a, b) => b.capacityKg - a.capacityKg);
  const fullFleetCoverage = sequentialFill(candidates, sortedTrucks)
    .reduce((s, b) => s + b.schools.length, 0);

  for (let k = 1; k <= sortedTrucks.length; k++) {
    const kTrucks = sortedTrucks.slice(0, k);
    const buckets = sequentialFill(candidates, kTrucks);
    const coverage = buckets.reduce((s, b) => s + b.schools.length, 0);
    if (coverage >= fullFleetCoverage) return buckets;
  }
  return sequentialFill(candidates, sortedTrucks);
}

// Strategy 4: minimize driving distance. Same first-fit mechanics as
// max-schools, but ordered by detour ratio (genuinely "most on-the-way" first)
// rather than raw distance from the warehouse.
function allocateShortestRoute(candidates: CandidateSchool[], trucks: AutoBuildTruckInput[]): TruckBucket[] {
  const buckets = emptyBuckets(trucks);
  const sorted = [...candidates].sort((a, b) => a.detourRatio - b.detourRatio);
  for (const school of sorted) {
    const bucket = buckets.find(b => fits(b, school));
    if (bucket) place(bucket, school);
  }
  return buckets;
}

// Strategy 5: spread evenly across trucks. Only meaningful with 2+ trucks (see
// dedup in generateAutoBuildOptions - with 1 truck this converges with
// max-schools). Round-robin by proximity: each school (closest-first) goes to
// whichever ticked truck currently has the LOWEST utilization-so-far that still
// has room, keeping trucks roughly proportionally filled.
function allocateBalanced(candidates: CandidateSchool[], trucks: AutoBuildTruckInput[]): TruckBucket[] {
  const buckets = emptyBuckets(trucks);
  const sorted = [...candidates].sort((a, b) => a.distanceFromWarehouseMeters - b.distanceFromWarehouseMeters);
  for (const school of sorted) {
    let best: TruckBucket | null = null;
    let bestUtilization = Infinity;
    for (const bucket of buckets) {
      if (!fits(bucket, school)) continue;
      const utilization = bucket.totalWeightKg / bucket.truck.capacityKg;
      if (utilization < bestUtilization) {
        best = bucket;
        bestUtilization = utilization;
      }
    }
    if (best) place(best, school);
  }
  return buckets;
}

const STRATEGIES: { id: AutoBuildOption['strategyId']; label: string; run: typeof allocateMaxSchools }[] = [
  { id: 'max-schools', label: 'Cover the most schools', run: allocateMaxSchools },
  { id: 'max-weight-utilization', label: 'Fill trucks as full as possible', run: allocateMaxWeightUtilization },
  { id: 'fewest-trucks', label: 'Use the fewest trucks', run: allocateFewestTrucks },
  { id: 'shortest-route', label: 'Minimize driving distance', run: allocateShortestRoute },
  { id: 'balanced', label: 'Spread evenly across trucks', run: allocateBalanced }
];

// Orders a truck's assigned schools by nearest-neighbor from the warehouse (a
// cheap, good-enough route ordering using the already-known straight-line
// positions - NOT a full TSP solve, intentionally out of scope for a 5-option
// comparison tool).
function nearestNeighborOrder(warehouse: { lat: number; lng: number }, schools: CandidateSchool[]): CandidateSchool[] {
  const remaining = [...schools];
  const ordered: CandidateSchool[] = [];
  let from = warehouse;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    remaining.forEach((s, i) => {
      const d = straightLineDistanceMeters(from, s.position);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    const [next] = remaining.splice(bestIdx, 1);
    ordered.push(next);
    from = next.position;
  }
  return ordered;
}

async function toTruckAssignment(
  bucket: TruckBucket,
  warehouse: { lat: number; lng: number },
  directionsService: google.maps.DirectionsService
): Promise<AutoBuildTruckAssignment> {
  const orderedSchools = nearestNeighborOrder(warehouse, bucket.schools);
  const orderIds = new Set(orderedSchools.flatMap(s => s.orders.map(o => o.id)));
  const allOrders = orderedSchools.flatMap(s => s.orders);
  const schoolGroups = buildSchoolGroups(allOrders, orderIds);

  const stops: RouteStop[] = orderedSchools.map(s => ({ id: s.schoolKey, position: s.position }));
  const route = await computeRoute(directionsService, warehouse, stops);

  return {
    truckId: bucket.truck.id,
    truckName: bucket.truck.name,
    capacityKg: bucket.truck.capacityKg,
    schoolGroups,
    totalWeightKg: bucket.totalWeightKg,
    weightUtilizationPct: bucket.truck.capacityKg > 0 ? (bucket.totalWeightKg / bucket.truck.capacityKg) * 100 : 0,
    estimatedDistanceMeters: route?.totalMeters ?? 0,
    estimatedTravelTimeSeconds: route?.totalSeconds ?? 0
  };
}

// Identity of a resulting allocation, for dedup - which orders ended up in
// which truck, independent of strategy label.
function allocationSignature(buckets: TruckBucket[]): string {
  return buckets
    .map(b => `${b.truck.id}:${b.schools.flatMap(s => s.orders.map(o => o.id)).sort().join(',')}`)
    .sort()
    .join('|');
}

// Entry point: generates up to 5 distinct, ranked build options for the given
// ticked trucks. "Oldest active order" = earliest order number
// (orderNumberSortValue), not earliest createdAt. Same-school orders are always
// included once their school is the anchor; the on-the-way check only gates
// OTHER schools. Duplicate resulting allocations (common with 1 ticked truck, or
// a small candidate pool) are dropped rather than padded to 5 - returning fewer
// than 5 distinct options is correct, expected behavior.
export async function generateAutoBuildOptions(input: AutoBuildInput): Promise<AutoBuildOption[]> {
  if (input.eligibleOrders.length === 0 || input.trucks.length === 0) return [];

  const anchorOrder = [...input.eligibleOrders].sort(
    (a, b) => orderNumberSortValue(a.orderNumber) - orderNumberSortValue(b.orderNumber)
  )[0];

  const candidates = await buildCandidatePool(input, anchorOrder);
  if (candidates.length === 0) return [];

  const seenSignatures = new Set<string>();
  const options: AutoBuildOption[] = [];

  for (const strategy of STRATEGIES) {
    if (strategy.id === 'balanced' && input.trucks.length < 2) continue; // meaningless with <2 trucks, would just duplicate max-schools

    const buckets = strategy.run(candidates, input.trucks).filter(b => b.schools.length > 0);
    if (buckets.length === 0) continue;

    const signature = allocationSignature(buckets);
    if (seenSignatures.has(signature)) continue;
    seenSignatures.add(signature);

    const truckAssignments = await Promise.all(
      buckets.map(b => toTruckAssignment(b, input.warehouse, input.directionsService))
    );

    const totalSchools = truckAssignments.reduce((s, t) => s + t.schoolGroups.length, 0);
    const totalOrders = truckAssignments.reduce(
      (s, t) => s + t.schoolGroups.reduce((s2, g) => s2 + g.orderIds.length, 0),
      0
    );
    const totalValueRand = buckets.reduce(
      (s, b) => s + b.schools.reduce((s2, school) =>
        s2 + school.orders.reduce((s3, o) => s3 + orderValueRand(o, input.unitPriceByStockCode), 0), 0),
      0
    );

    options.push({
      strategyId: strategy.id,
      label: strategy.label,
      truckAssignments,
      totalSchools,
      totalOrders,
      totalValueRand,
      totalTrucksUsed: truckAssignments.length,
      totalEstimatedDistanceMeters: truckAssignments.reduce((s, t) => s + t.estimatedDistanceMeters, 0),
      totalEstimatedTravelTimeSeconds: truckAssignments.reduce((s, t) => s + t.estimatedTravelTimeSeconds, 0)
    });
  }

  return options.sort((a, b) => b.totalSchools - a.totalSchools);
}
