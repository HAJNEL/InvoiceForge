import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  buildSchoolPinSearchAddress,
  schoolKeyFor,
  loadCachedSchoolPins,
  upsertCachedSchoolPin,
  extractAdminAreas,
  buildAreaSearchAddress,
  areaKeyFor,
  loadCachedAreaPins,
  upsertCachedAreaPin,
  describeLocationIssue,
  DEFAULT_LOCATION_ISSUE_DISTANCE_KM,
  type CachedSchoolPin,
  type CachedAreaPin,
  type LocationIssueDetail
} from '../../../lib/geocoding';
import type { Order } from './useOrders';

export const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
export const hasMapsKey = Boolean(GOOGLE_MAPS_API_KEY);

export interface OrderLocationIssue extends LocationIssueDetail {
  orderId: string;
  orderNumber: string;
  schoolName: string;
  area: string;
}

// Given the current set of resolved/cached school + area pins, which orders'
// `area` field puts them farther than maxDistanceKm from where their school
// actually geocodes to. Pure and cheap - no API calls, just localStorage-backed
// data already in memory.
export function computeLocationIssues(
  orders: Order[],
  schoolPins: CachedSchoolPin[],
  areaPins: CachedAreaPin[],
  maxDistanceKm: number = DEFAULT_LOCATION_ISSUE_DISTANCE_KM
): OrderLocationIssue[] {
  const schoolByKey = new Map(schoolPins.map(p => [p.schoolKey, p]));
  const areaByKey = new Map(areaPins.map(p => [p.areaKey, p]));
  const issues: OrderLocationIssue[] = [];
  for (const order of orders) {
    if (!order.area.trim()) continue;
    const detail = describeLocationIssue(schoolByKey.get(schoolKeyFor(order.schoolName)), areaByKey.get(areaKeyFor(order.area)), maxDistanceKm);
    if (detail) issues.push({ ...detail, orderId: order.id, orderNumber: order.orderNumber, schoolName: order.schoolName, area: order.area });
  }
  return issues;
}

// Prints exactly why each flagged order was flagged - the area it claims, the
// area it actually geocodes near, and the distance between them - so a mismatch
// can be sanity-checked against the raw geocoding data instead of just trusting
// the KPI count.
export function logLocationIssues(issues: OrderLocationIssue[], maxDistanceKm: number): void {
  if (issues.length === 0) return;
  console.group(`[Orders] ${issues.length} location issue${issues.length === 1 ? '' : 's'} detected (school >${maxDistanceKm}km from its stated area)`);
  issues.forEach(issue => {
    console.warn(
      `${issue.orderNumber || issue.orderId} · ${issue.schoolName}\n` +
      `  Stated area: "${issue.area}" -> resolves near: ${issue.areaAddress}\n` +
      `  School geocodes to: ${issue.schoolAddress}\n` +
      `  Distance apart: ~${Math.round(issue.distanceKm)} km`
    );
  });
  console.groupEnd();
}

// Must be rendered inside an <APIProvider> (needs the 'geocoding' Maps JS
// library). Renders nothing - it only geocodes any school or area among `orders`
// whose cached pin is missing or stale. School geocoding mirrors
// OrderBuilderMap.tsx exactly, sharing its `geocoded_order_schools` cache so a
// school resolved via either screen isn't re-geocoded by the other; area
// geocoding is new and lives in its own `geocoded_order_areas` cache (see
// geocoding.ts). Reports every pin (cached + newly resolved) back to the parent
// via the two onChange callbacks so it can compute location issues without
// needing Maps JS itself.
export function OrderLocationGeocoder({ orders, onSchoolPinsChange, onAreaPinsChange }: {
  orders: Order[];
  onSchoolPinsChange: (pins: CachedSchoolPin[]) => void;
  onAreaPinsChange: (pins: CachedAreaPin[]) => void;
}) {
  const geocodingLib = useMapsLibrary('geocoding');
  const processingSchoolKeys = useRef<Set<string>>(new Set());
  const processingAreaKeys = useRef<Set<string>>(new Set());
  const [schoolPins, setSchoolPins] = useState<CachedSchoolPin[]>(() => loadCachedSchoolPins());
  const [areaPins, setAreaPins] = useState<CachedAreaPin[]>(() => loadCachedAreaPins());

  // Address, when set, comes from whichever order for this school has one -
  // an explicit address on any order overrides the school-name search for the
  // whole shared pin (see buildSchoolPinSearchAddress).
  const schoolNamesByKey = useMemo(() => {
    const seen = new Map<string, { schoolName: string; address?: string }>();
    for (const o of orders) {
      const key = schoolKeyFor(o.schoolName);
      if (!key) continue;
      const address = o.address?.trim();
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, { schoolName: o.schoolName, address });
      } else if (!existing.address && address) {
        existing.address = address;
      }
    }
    return seen;
  }, [orders]);

  const areasByKey = useMemo(() => {
    const seen = new Map<string, string>();
    for (const o of orders) {
      const trimmed = o.area.trim();
      const key = areaKeyFor(trimmed);
      if (key && !seen.has(key)) seen.set(key, trimmed);
    }
    return seen;
  }, [orders]);

  useEffect(() => { onSchoolPinsChange(schoolPins); }, [schoolPins, onSchoolPinsChange]);
  useEffect(() => { onAreaPinsChange(areaPins); }, [areaPins, onAreaPinsChange]);

  // Schools - identical geocode-and-cache logic to OrderBuilderMap.tsx's effect.
  useEffect(() => {
    if (!geocodingLib) return;

    const toGeocode = [...schoolNamesByKey.entries()].filter(([key, { schoolName, address }]) => {
      const expected = buildSchoolPinSearchAddress(schoolName, address);
      if (!expected) return false;
      const cacheKey = `${key}_${expected}`;
      if (processingSchoolKeys.current.has(cacheKey)) return false;
      const existing = schoolPins.find(p => p.schoolKey === key);
      return !existing || existing.searchAddress !== expected;
    });

    if (toGeocode.length === 0) return;

    toGeocode.forEach(([key, { schoolName, address }]) => {
      const expected = buildSchoolPinSearchAddress(schoolName, address);
      if (expected) processingSchoolKeys.current.add(`${key}_${expected}`);
    });

    const run = async () => {
      for (const [key, { schoolName, address }] of toGeocode) {
        const expected = buildSchoolPinSearchAddress(schoolName, address);
        if (!expected) continue;
        try {
          const { results } = await new geocodingLib.Geocoder().geocode({ address: expected });
          if (results && results[0]) {
            const pin: CachedSchoolPin = {
              schoolKey: key,
              schoolName,
              searchAddress: expected,
              address: results[0].formatted_address,
              position: {
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng()
              },
              adminAreas: extractAdminAreas(results[0].address_components)
            };
            upsertCachedSchoolPin(pin);
            setSchoolPins(prev => [...prev.filter(p => p.schoolKey !== key), pin]);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`Geocoding failed for school ${schoolName}:`, err);
        }
      }
    };

    run();
  }, [geocodingLib, schoolNamesByKey, schoolPins]);

  // Areas - same shape, geocoding "<area>, South Africa" instead of a school name.
  useEffect(() => {
    if (!geocodingLib) return;

    const toGeocode = [...areasByKey.entries()].filter(([key, area]) => {
      const expected = buildAreaSearchAddress(area);
      if (!expected) return false;
      const cacheKey = `${key}_${expected}`;
      if (processingAreaKeys.current.has(cacheKey)) return false;
      const existing = areaPins.find(p => p.areaKey === key);
      return !existing || existing.searchAddress !== expected;
    });

    if (toGeocode.length === 0) return;

    toGeocode.forEach(([key, area]) => {
      const expected = buildAreaSearchAddress(area);
      if (expected) processingAreaKeys.current.add(`${key}_${expected}`);
    });

    const run = async () => {
      for (const [key, area] of toGeocode) {
        const expected = buildAreaSearchAddress(area);
        if (!expected) continue;
        try {
          const { results } = await new geocodingLib.Geocoder().geocode({ address: expected });
          if (results && results[0]) {
            const pin: CachedAreaPin = {
              areaKey: key,
              area,
              searchAddress: expected,
              address: results[0].formatted_address,
              position: {
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng()
              },
              // Only present when Google resolved this area as an actual region
              // (not a single point) - see CachedAreaPin.bounds.
              bounds: results[0].geometry.bounds?.toJSON()
            };
            upsertCachedAreaPin(pin);
            setAreaPins(prev => [...prev.filter(p => p.areaKey !== key), pin]);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`Geocoding failed for area ${area}:`, err);
        }
      }
    };

    run();
  }, [geocodingLib, areasByKey, areaPins]);

  return null;
}
