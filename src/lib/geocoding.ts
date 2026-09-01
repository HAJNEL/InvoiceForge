// Shared helpers for turning invoices into map pins. The `geocoded_invoices`
// localStorage cache is read by both trip maps (TripList's MapComponent and
// TripForm's InteractiveTripMap) and written by the upload flows, the Refresh
// Pins routine, and the maps themselves — so the address-priority logic and the
// cache shape MUST stay identical everywhere. This module is the single source
// of truth for both.

export interface PinAddressSource {
  client: string;
  schoolName?: string;
  district?: string;
  deliveryAddress?: string;
  deliveryAddressLine1?: string;
  deliveryAddressLine2?: string;
}

export interface CachedPin {
  id: string;
  number: string;
  client: string;
  address: string;
  // The address string that was actually geocoded to produce `position`. Used to
  // detect when an invoice's address data has changed since it was cached, so the
  // pin is re-geocoded instead of staying stuck at a stale location.
  searchAddress?: string;
  status: string;
  position: { lat: number; lng: number };
  district?: string;
  lineItems?: {
    stockCode: string;
    description: string;
    qty: number;
    unitPrice: number;
    value: number;
  }[];
}

// "Unassigned" is the placeholder useInvoices.ts falls back to when an invoice
// has no real district - feeding that literal string into a search string does
// more harm than good (it's noise to Google's geocoder, and has caused wrong
// same-named-school matches), so every builder below treats it as absent.
export function sanitizeDistrict(district: string | undefined): string {
  const trimmed = (district || '').trim();
  return trimmed && trimmed.toLowerCase() !== 'unassigned' ? trimmed : '';
}

// Capitalizes the first letter of every letter-run and lowercases the rest, so
// "ASHTON PUBLIC SCHOOL", "ashton public school" and "AsHtOn PuBlic ScHool" all
// collapse onto the same "Ashton Public School" - regardless of what casing the
// source spreadsheet used. \p{L}+ (not \s-split) so hyphenated/apostrophed names
// like "St-Mary's" title-case each part correctly.
function toTitleCase(name: string): string {
  return name.replace(/\p{L}+/gu, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

// OCR/AI extraction sometimes yields Afrikaans school-name terms (e.g. "PRIMÊRE
// SKOOL", "HOËRSKOOL", "MEISIES") instead of their English equivalents - the terms
// Google Maps actually indexes South African schools under, and that read
// correctly on an otherwise-English invoice. Phrase-level entries run first so
// compound/spaced Afrikaans terms resolve before the standalone "skool" catch-all;
// Afrikaans word order (place, then gender, then school type, e.g. "La Rochelle
// Meisies Hoërskool") happens to match the desired English order, so no reordering
// is needed - only per-term translation.
const AFRIKAANS_SCHOOL_TERMS: [RegExp, string][] = [
  [/prim(?:e|é|ê)re\s+skool/gi, 'Primary School'],
  [/sekond(?:e|é|ê)re\s+skool/gi, 'Secondary School'],
  [/kombineerde\s+skool/gi, 'Combined School'],
  [/laerskool/gi, 'Primary School'],
  [/ho(?:e|é|ë)rskool/gi, 'High School'],
  [/meisieskool/gi, "Girls' School"],
  [/seunskool/gi, "Boys' School"],
  [/\bskool\b/gi, 'School'],
  [/\bmeisies\b/gi, "Girls'"],
  [/\bpionier\b/gi, 'Pioneer'],
  [/\bseuns\b/gi, "Boys'"],
];

// Used both to normalize the school name on import and to build search queries.
export function normalizeSchoolName(schoolName: string): string {
  const translated = AFRIKAANS_SCHOOL_TERMS.reduce(
    (name, [pattern, replacement]) => name.replace(pattern, replacement),
    schoolName
  );
  return toTitleCase(translated);
}

// The Google-resolved school address, when we have one. It is stored verbatim as
// `deliveryAddress` on the invoice doc, so a manual edit of that field moves the pin.
export function buildSchoolLookupAddress(inv: PinAddressSource): string | null {
  const schoolName = inv.schoolName?.trim();
  if (!schoolName) return null;
  return [normalizeSchoolName(schoolName), sanitizeDistrict(inv.district), 'South Africa'].filter(Boolean).join(', ');
}

// The street-address/client-name fallback used once there's no school name to go
// on at all (or the school-name lookup in resolveInvoicePin below found nothing).
function buildAddressLineFallback(inv: PinAddressSource): string {
  const district = sanitizeDistrict(inv.district);
  const fullAddress = [
    inv.deliveryAddressLine1,
    inv.deliveryAddressLine2,
    district,
    'South Africa'
  ].filter(Boolean).join(', ');
  if (fullAddress && fullAddress.length >= 5) return fullAddress;

  return [inv.client, district, 'South Africa'].filter(Boolean).join(', ');
}

// Builds the search address an invoice's pin should be geocoded to, given its
// current data: the stored delivery address (Google-resolved or manually edited)
// first, then school name, then the extracted street address, then client name.
export function buildPinSearchAddress(inv: PinAddressSource): string {
  const deliveryAddress = inv.deliveryAddress?.trim();
  if (deliveryAddress) return deliveryAddress;

  const schoolAddress = buildSchoolLookupAddress(inv);
  if (schoolAddress) return schoolAddress;

  return buildAddressLineFallback(inv);
}

export interface GeocodeResult {
  formattedAddress: string;
  position: { lat: number; lng: number };
}

export interface GeocodeBias {
  lat: number;
  lng: number;
}

// REST geocoder used outside the map components (upload flows, Refresh Pins),
// where the @vis.gl maps context isn't guaranteed to be mounted. The Geocoding
// API (unlike Distance Matrix/Directions) supports CORS, so a plain fetch works.
//
// `bias` (usually the warehouse's coordinates) biases results toward that area
// via a loose viewport, and `region=za` biases toward South African results -
// both matter for schools that share a name with one in another province (e.g.
// "Woodlands Secondary School" exists in both Cape Town and Pietermaritzburg).
export async function geocodeAddress(address: string, bias?: GeocodeBias): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
  if (!key || !address || address.trim().length < 5) return null;

  try {
    const params = new URLSearchParams({
      address: address.trim(),
      region: 'za',
      key
    });
    if (bias) {
      // ~75km box around the bias point, matching the Auto Distance button's own
      // AutocompleteService radius - biases toward the warehouse's region without
      // hard-excluding a legitimately distant match (bounds is only a soft
      // preference for the Geocoding API, never a hard restriction).
      const delta = 0.67;
      params.set('bounds', `${bias.lat - delta},${bias.lng - delta}|${bias.lat + delta},${bias.lng + delta}`);
    }
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.[0]) return null;
    const result = data.results[0];
    return {
      formattedAddress: result.formatted_address || address.trim(),
      position: {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng
      }
    };
  } catch (err) {
    console.error(`[geocoding] Lookup failed for "${address}":`, err);
    return null;
  }
}

// Resolves an invoice's map pin the same way the "Auto Distance" button (see
// SelfInvoiceModal.tsx's getTopPlaceMatch) resolves a school for its distance
// lookup: search by the school name ALONE first, tightly biased toward the
// warehouse, and only bring in the district as a fallback if that plain-name
// search finds nothing. Combining school+district into one query up front can
// turn a search that would otherwise cleanly match into a noisier one - if the
// extracted district is wrong, empty, or just not how Google indexes the place,
// folding it into the first attempt can make a real, findable school fail (or
// worse, resolve to some other place entirely) instead of just falling through
// to this same name-only attempt. Never silently defaults to a fixed location -
// returns null (no pin) rather than guessing, same as geocodeAddress itself.
export async function resolveInvoicePin(inv: PinAddressSource, bias?: GeocodeBias): Promise<GeocodeResult | null> {
  const schoolName = inv.schoolName?.trim() ? normalizeSchoolName(inv.schoolName.trim()) : '';
  if (schoolName) {
    let geo = await geocodeAddress(`${schoolName}, South Africa`, bias);
    if (geo) return geo;

    const district = sanitizeDistrict(inv.district);
    if (district) {
      geo = await geocodeAddress(`${schoolName}, ${district}, South Africa`, bias);
      if (geo) return geo;
    }
  }

  // No school name, or the school-name lookup found nothing - fall back to
  // whatever other address material is available (street address, then client name).
  return geocodeAddress(buildAddressLineFallback(inv), bias);
}

export function loadCachedPins(): CachedPin[] {
  try {
    const saved = localStorage.getItem('geocoded_invoices');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as CachedPin[];
    }
  } catch (e) {
    console.error('[geocoding] Error loading cached pins:', e);
  }
  return [];
}

// Replaces any existing pin for the same invoice id and persists the cache.
export function upsertCachedPin(pin: CachedPin): void {
  const pins = loadCachedPins().filter(p => p.id !== pin.id);
  pins.push(pin);
  localStorage.setItem('geocoded_invoices', JSON.stringify(pins));
}

// Order Builder's school-pin resolution is deliberately simpler than an invoice's:
// search by school name ALONE, always normalized to English first, and take
// Google's first result unconditionally - no district-combined retry, no street-
// address fallback chain, since Order docs don't carry that data at all (only an
// `area` field, which isn't reliable enough to feed into a geocoding query). Never
// silently defaults to a fixed location - returns null (no pin) if geocoding
// fails, same as geocodeAddress/resolveInvoicePin.
// Extracted from resolveOrderPin so the map component (which geocodes via the
// client-side @vis.gl Geocoder, not this REST helper, since it already has the JS
// Maps library loaded - same reasoning InteractiveTripMap.tsx follows) can build
// the identical search string without duplicating the normalize+suffix logic.
export function buildOrderSearchAddress(schoolName: string): string | null {
  const normalized = normalizeSchoolName(schoolName.trim());
  return normalized ? `${normalized}, South Africa` : null;
}

// The search string a school's pin should actually be geocoded to: an explicit
// per-order address (set via the Edit Order dialog's Address field, picked from
// Places Autocomplete) always wins when present - it's a precise, user-confirmed
// location, so the fuzzy school-name search below never overrides it. Falls back
// to the school-name search (buildOrderSearchAddress) when no order for this
// school has an address set, which is the common case. Used everywhere a
// school's shared map pin is geocoded (OrderBuilderMap, OrderLocationGeocoder) -
// `address` should be the first non-blank address among the orders sharing this
// school name, so one confirmed address corrects the pin for every order at that
// school, not just the one it was entered on.
export function buildSchoolPinSearchAddress(schoolName: string, address?: string): string | null {
  const trimmedAddress = address?.trim();
  if (trimmedAddress) return trimmedAddress;
  return buildOrderSearchAddress(schoolName);
}

// Minimal shape needed to check for shared addresses - kept decoupled from the
// real Order type (features/orders/hooks/useOrders.ts) so this lib module
// doesn't need to import a feature-level type just for this one check.
export interface AddressableOrder {
  id: string;
  schoolName: string;
  address?: string;
}

// Other schools (not `currentSchoolName`) that share the exact same address as
// the order being edited - surfaced as a "did you mean this?" prompt before
// saving, since two different schools sharing one delivery address is usually
// a copy-paste mistake rather than the norm. Orders for the same school as the
// one being edited don't count (that's expected - repeat orders for one
// school), nor does the order being edited itself (excluded by `currentOrderId`).
export function findSchoolsSharingAddress(
  orders: AddressableOrder[],
  currentOrderId: string | undefined,
  currentSchoolName: string,
  address: string
): string[] {
  const normalizedAddress = address.trim().toLowerCase();
  if (!normalizedAddress) return [];

  const currentKey = schoolKeyFor(currentSchoolName);
  const schoolsByKey = new Map<string, string>();
  for (const o of orders) {
    if (o.id === currentOrderId) continue;
    const otherAddress = o.address?.trim().toLowerCase();
    if (!otherAddress || otherAddress !== normalizedAddress) continue;
    const key = schoolKeyFor(o.schoolName);
    if (key === currentKey || schoolsByKey.has(key)) continue;
    schoolsByKey.set(key, o.schoolName.trim());
  }
  return [...schoolsByKey.values()];
}

export async function resolveOrderPin(schoolName: string, bias?: GeocodeBias): Promise<GeocodeResult | null> {
  const address = buildOrderSearchAddress(schoolName);
  if (!address) return null;
  return geocodeAddress(address, bias);
}

// The cache key an order's school resolves to - normalized name, trimmed, lower-
// cased, so "Klaasvoogds Primêre Skool" and "klaasvoogds primary school " both
// collapse onto the same pin.
export function schoolKeyFor(schoolName: string): string {
  return normalizeSchoolName(schoolName).trim().toLowerCase();
}

// A school's resolved map pin, cached ONCE and reused by every order for that
// school - unlike CachedPin above (keyed per invoice id), many Order docs can
// share one schoolKey, so geocoding must happen once per unique school, not once
// per order. Kept in a separate localStorage key from `geocoded_invoices` since
// the two caches are keyed differently and mixing them would corrupt both.
export interface CachedSchoolPin {
  schoolKey: string;
  schoolName: string;
  searchAddress: string;
  address: string;
  position: { lat: number; lng: number };
  // Google's address_components long_names for the admin/locality levels
  // (province, district/local municipality, suburb) - captured alongside
  // `address` at geocode time. Not used for location-issue detection (that's
  // distance-based, see describeLocationIssue below) - kept for a more readable
  // "resolves to X" label than the raw formatted address. Optional/absent on
  // pins geocoded before this field existed.
  adminAreas?: string[];
}

const ADMIN_AREA_COMPONENT_TYPES = new Set([
  'administrative_area_level_1',
  'administrative_area_level_2',
  'administrative_area_level_3',
  'locality',
  'sublocality',
  'sublocality_level_1',
]);

// Pulls the province/district/suburb names out of a Google geocode result's
// address_components - structurally typed (not `google.maps.GeocoderAddressComponent`)
// so this file doesn't need the Maps JS types loaded just to read a result shape.
export function extractAdminAreas(components: { long_name: string; types: string[] }[]): string[] {
  return components.filter(c => c.types.some(t => ADMIN_AREA_COMPONENT_TYPES.has(t))).map(c => c.long_name);
}

// A geocoded `area` value (e.g. "Cape Winelands"), cached exactly like
// CachedSchoolPin so each unique area is only geocoded once and shared across
// every order/school that names it. Kept in its own localStorage key since it's
// keyed by area text, not school name.
export interface CachedAreaPin {
  areaKey: string;
  area: string;
  searchAddress: string;
  address: string;
  position: { lat: number; lng: number };
  // The area's actual boundary box, when Google resolves it as a proper region
  // (district municipality, city, etc.) rather than a single point - lets
  // describeLocationIssue check "is the school actually inside this district"
  // instead of "is it near some single representative point in it", which for a
  // district spanning 100+km can sit far from a perfectly valid school within it.
  // Absent when Google's result for this area is a point-only match.
  bounds?: { south: number; west: number; north: number; east: number };
}

export function areaKeyFor(area: string): string {
  return area.trim().toLowerCase();
}

export function buildAreaSearchAddress(area: string): string | null {
  const trimmed = area.trim();
  return trimmed ? `${trimmed}, South Africa` : null;
}

export function loadCachedAreaPins(): CachedAreaPin[] {
  try {
    const saved = localStorage.getItem('geocoded_order_areas');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as CachedAreaPin[];
    }
  } catch (e) {
    console.error('[geocoding] Error loading cached area pins:', e);
  }
  return [];
}

// Replaces any existing pin for the same area key and persists the cache.
export function upsertCachedAreaPin(pin: CachedAreaPin): void {
  const pins = loadCachedAreaPins().filter(p => p.areaKey !== pin.areaKey);
  pins.push(pin);
  localStorage.setItem('geocoded_order_areas', JSON.stringify(pins));
}

// Great-circle distance in km between two lat/lng points (haversine formula).
export function haversineDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Default max distance (km) a school may sit from its order's stated area before
// it's flagged as a location issue - user-configurable via the gear icon next to
// Import on the Orders screen (Settings.orderLocationIssueMaxDistanceKm). Applies
// both when the area resolved to a real boundary (distance outside that boundary)
// and when it only resolved to a single point (straight-line distance to that
// point) - so a very small value can produce false positives for an area whose
// name Google can't resolve to an actual administrative boundary, since a large
// district's true extent can be much wider than the distance to one representative
// point in it. 50km is a middle ground: strict enough to catch a school that
// resolved into a clearly different, non-adjacent region, loose enough to rarely
// false-positive in the point-only fallback case.
export const DEFAULT_LOCATION_ISSUE_DISTANCE_KM = 50;

export interface LocationIssueDetail {
  distanceKm: number;
  schoolAddress: string;
  areaAddress: string;
}

function clampToBounds(point: { lat: number; lng: number }, bounds: { south: number; west: number; north: number; east: number }) {
  return {
    lat: Math.min(Math.max(point.lat, bounds.south), bounds.north),
    lng: Math.min(Math.max(point.lng, bounds.west), bounds.east)
  };
}

// Compares a school's geocoded pin against its stated area's geocoded pin/
// boundary and returns the mismatch detail (distance + both resolved addresses,
// for logging/display) if they're farther apart than maxDistanceKm, or null if
// they're within it - or if either pin hasn't been resolved yet (unknown defaults
// to "not an issue" rather than a false alarm). Prefers checking the school's
// point against the area's actual boundary box when Google resolved one (accurate
// regardless of district size/shape); falls back to straight-line distance to the
// area's single point when it didn't (see DEFAULT_LOCATION_ISSUE_DISTANCE_KM for
// why the same threshold serves both, and why this is distance/boundary-based
// rather than text-matching the admin-area name, which Google's South African
// data doesn't reliably expose at district-municipality level).
export function describeLocationIssue(
  schoolPin: CachedSchoolPin | undefined,
  areaPin: CachedAreaPin | undefined,
  maxDistanceKm: number = DEFAULT_LOCATION_ISSUE_DISTANCE_KM
): LocationIssueDetail | null {
  if (!schoolPin || !areaPin) return null;

  if (areaPin.bounds) {
    const { south, west, north, east } = areaPin.bounds;
    const inside = schoolPin.position.lat >= south && schoolPin.position.lat <= north
      && schoolPin.position.lng >= west && schoolPin.position.lng <= east;
    if (inside) return null;
    const distanceKm = haversineDistanceKm(schoolPin.position, clampToBounds(schoolPin.position, areaPin.bounds));
    if (distanceKm <= maxDistanceKm) return null;
    return { distanceKm, schoolAddress: schoolPin.address, areaAddress: areaPin.address };
  }

  const distanceKm = haversineDistanceKm(schoolPin.position, areaPin.position);
  if (distanceKm <= maxDistanceKm) return null;
  return { distanceKm, schoolAddress: schoolPin.address, areaAddress: areaPin.address };
}

export function loadCachedSchoolPins(): CachedSchoolPin[] {
  try {
    const saved = localStorage.getItem('geocoded_order_schools');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as CachedSchoolPin[];
    }
  } catch (e) {
    console.error('[geocoding] Error loading cached school pins:', e);
  }
  return [];
}

// Replaces any existing pin for the same school key and persists the cache.
export function upsertCachedSchoolPin(pin: CachedSchoolPin): void {
  const pins = loadCachedSchoolPins().filter(p => p.schoolKey !== pin.schoolKey);
  pins.push(pin);
  localStorage.setItem('geocoded_order_schools', JSON.stringify(pins));
}
