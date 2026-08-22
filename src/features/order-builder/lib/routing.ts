/// <reference types="google.maps" />

// Routing helpers for Order Builder's Auto-Build feature. Reuses the client-side
// Maps JavaScript SDK's DirectionsService, NOT the REST Distance Matrix/Directions
// API - that REST endpoint doesn't support browser CORS (see the comment on
// geocodeAddress in src/lib/geocoding.ts), and this app already solved exactly
// this problem once in AutoDistanceButton (src/features/dashboard/components/
// SelfInvoiceModal.tsx) via useMapsLibrary('routes') -> new routesLib.DirectionsService().
// Unlike that button (which needs the WORST-case route for conservative billing,
// hence provideRouteAlternatives + take-the-max), route planning here just wants
// the single best/fastest route, so provideRouteAlternatives is not used.

export interface RouteStop {
  id: string;
  position: { lat: number; lng: number };
}

export interface RouteResult {
  totalMeters: number;
  totalSeconds: number;
  legMeters: number[]; // per-leg, in stop order (origin -> stop1 -> stop2 -> ...)
}

// Computes the total driving distance/duration for a route starting at `origin`
// and visiting `stops` in the given order - the order is never re-optimized here,
// callers decide it. Returns null on any failure (API error, zero routes) rather
// than throwing, since callers treat "couldn't route this candidate" as "skip it",
// not a hard crash.
export async function computeRoute(
  directionsService: google.maps.DirectionsService,
  origin: { lat: number; lng: number },
  stops: RouteStop[]
): Promise<RouteResult | null> {
  if (stops.length === 0) return null;

  const destination = stops[stops.length - 1].position;
  const waypoints: google.maps.DirectionsWaypoint[] = stops.slice(0, -1).map(s => ({
    location: s.position,
    stopover: true
  }));

  try {
    const result = await directionsService.route({
      origin,
      destination,
      waypoints,
      optimizeWaypoints: false, // caller decides stop order, never silently reorder it
      travelMode: google.maps.TravelMode.DRIVING,
      region: 'za'
    });

    const route = result.routes[0];
    if (!route || route.legs.length === 0) return null;

    const legMeters = route.legs.map(leg => leg.distance?.value || 0);
    const totalMeters = legMeters.reduce((s, m) => s + m, 0);
    const totalSeconds = route.legs.reduce((s, leg) => s + (leg.duration?.value || 0), 0);

    return { totalMeters, totalSeconds, legMeters };
  } catch (err) {
    console.error('[order-builder/routing] computeRoute failed:', err);
    return null;
  }
}

export interface DetourCheckResult {
  onTheWay: boolean;
  detourRatio: number; // (detourDistance / directDistance) - 1; e.g. 0.2 = 20% extra distance
}

// True (with the ratio) if routing origin -> candidate -> anchor stays within
// `maxDetourRatio` of the direct origin -> anchor distance. Fails closed - if
// either underlying route computation fails, returns onTheWay: false rather than
// guessing, since Order Builder shouldn't claim a school is "on the way" when it
// couldn't actually confirm that.
export async function isOnTheWay(
  directionsService: google.maps.DirectionsService,
  origin: { lat: number; lng: number },
  candidate: RouteStop,
  anchor: RouteStop,
  maxDetourRatio = 0.30
): Promise<DetourCheckResult> {
  const [direct, detour] = await Promise.all([
    computeRoute(directionsService, origin, [anchor]),
    computeRoute(directionsService, origin, [candidate, anchor])
  ]);

  if (!direct || !detour || direct.totalMeters === 0) {
    return { onTheWay: false, detourRatio: Infinity };
  }

  const detourRatio = detour.totalMeters / direct.totalMeters - 1;
  return { onTheWay: detourRatio <= maxDetourRatio, detourRatio };
}

// Straight-line ("as the crow flies") distance in meters, via the standard
// haversine formula - a free, synchronous pre-filter to avoid spending a
// Directions API call on schools that are obviously too far away to ever be "on
// the way". Deliberately a plain haversine calculation rather than
// google.maps.geometry.spherical.computeDistanceBetween, so callers don't need to
// remember to load the separate 'geometry' Maps JS library just for this.
const EARTH_RADIUS_METERS = 6371000;

export function straightLineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}
