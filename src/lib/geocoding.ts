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

// The Google-resolved school address, when we have one. It is stored verbatim as
// `deliveryAddress` on the invoice doc, so a manual edit of that field moves the pin.
export function buildSchoolLookupAddress(inv: PinAddressSource): string | null {
  const schoolName = inv.schoolName?.trim();
  if (!schoolName) return null;
  return [schoolName, inv.district, 'South Africa'].filter(Boolean).join(', ');
}

// Builds the search address an invoice's pin should be geocoded to, given its
// current data: the stored delivery address (Google-resolved or manually edited)
// first, then school name, then the extracted street address, then client name.
export function buildPinSearchAddress(inv: PinAddressSource): string {
  const deliveryAddress = inv.deliveryAddress?.trim();
  if (deliveryAddress) return deliveryAddress;

  const schoolAddress = buildSchoolLookupAddress(inv);
  if (schoolAddress) return schoolAddress;

  const fullAddress = [
    inv.deliveryAddressLine1,
    inv.deliveryAddressLine2,
    inv.district,
    'South Africa'
  ].filter(Boolean).join(', ');
  if (fullAddress && fullAddress.length >= 5) return fullAddress;

  return [inv.client, inv.district, 'South Africa'].filter(Boolean).join(', ');
}

export interface GeocodeResult {
  formattedAddress: string;
  position: { lat: number; lng: number };
}

// REST geocoder used outside the map components (upload flows, Refresh Pins),
// where the @vis.gl maps context isn't guaranteed to be mounted.
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
  if (!key || !address || address.trim().length < 5) return null;

  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address.trim())}&key=${key}`);
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
