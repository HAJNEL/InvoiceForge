/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { X, Loader2, AlertCircle, Warehouse, Navigation, Package, PackageSearch, Search, Truck as TruckIcon, ChevronDown, ChevronRight } from 'lucide-react';
import { Map as GoogleMap, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { cn, formatCurrency } from '../../../lib/utils';
import { useIsMobile } from '../../../hooks/useIsMobile';
import type { Order } from '../../orders/hooks/useOrders';
import { schoolKeyFor, loadCachedSchoolPins } from '../../../lib/geocoding';
import { computeOptimizedRoute, type RouteAlternative, type RouteStop } from '../lib/routing';
import { orderValueRand, orderWeightKg } from '../lib/autoBuild';
import { useStockLookups } from '../hooks/useStockLookups';
import { useTrucks } from '../../trucks/hooks/useTrucks';
import { clientTrucks } from '../utils';
import { SchoolOrdersSelectModal } from './SchoolOrdersSelectModal';
import { SchoolOrdersSelectModalMobile } from './SchoolOrdersSelectModalMobile';

type ViewMode = 'bundle' | 'all';

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
}

function formatDistance(meters: number): string {
  return `${Math.round(meters / 1000)} km`;
}

function orderUnits(order: Order): number {
  return order.lineItems.reduce((s, li) => s + li.qty, 0);
}

interface SchoolStop extends RouteStop {
  schoolName: string;
  orders: Order[];
}

function stopMatchesQuery(stop: SchoolStop, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (stop.schoolName.toLowerCase().includes(q)) return true;
  return stop.orders.some(o => o.orderNumber.toLowerCase().includes(q) || o.area.toLowerCase().includes(q));
}

// A separate filter from stopMatchesQuery above - this one narrows to stops
// that actually carry a matching stock code in one of their orders' line
// items, so it can be combined (AND) with the school/order/area search rather
// than overloading one box with two different kinds of matching.
function stopMatchesStockQuery(stop: SchoolStop, stockQuery: string): boolean {
  if (!stockQuery) return true;
  const q = stockQuery.toLowerCase();
  return stop.orders.some(o => o.lineItems.some(li => li.stockCode.toLowerCase().includes(q)));
}

// Draws one alternative's path via the imperative google.maps.DirectionsRenderer
// - @vis.gl/react-google-maps has no React wrapper for this, and it needs direct
// access to the underlying map instance. Its own A/B/1/2/3 markers are
// suppressed - RouteDialog renders its own numbered stop pins instead (see
// StopMarkers below), so there's one consistent set regardless of which
// alternative is currently selected.
function RoutePolyline({ directionsResult, routeIndex, isSelected }: {
  directionsResult: google.maps.DirectionsResult;
  routeIndex: number;
  isSelected: boolean;
}) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const rendererRef = useRef<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!map || !routesLib) return;
    const renderer = new routesLib.DirectionsRenderer({
      directions: directionsResult,
      routeIndex,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: isSelected ? '#2563eb' : '#9ca3af',
        strokeWeight: isSelected ? 6 : 4,
        strokeOpacity: isSelected ? 0.95 : 0.55,
        zIndex: isSelected ? 10 : 1
      }
    });
    renderer.setMap(map);
    rendererRef.current = renderer;
    return () => renderer.setMap(null);
  }, [map, routesLib, directionsResult, routeIndex, isSelected]);

  return null;
}

// The clickable "1 hr 26 min · 115 km" pill at a route's midpoint - matches how
// Google Maps itself lets you click an alternative's duration bubble to select
// it, and doubles as this dialog's only click target for switching routes (a
// DirectionsRenderer's rendered polyline doesn't reliably expose its own click
// events through the renderer object, so a real marker is used instead).
function RouteLabel({ route, isSelected, onSelect }: {
  route: RouteAlternative;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const midpoint = route.overviewPath[Math.floor(route.overviewPath.length / 2)];
  if (!midpoint) return null;
  return (
    <AdvancedMarker position={midpoint} onClick={onSelect} zIndex={isSelected ? 20 : 15}>
      <button
        type="button"
        title={isSelected ? 'Selected route' : 'Use this route instead'}
        className={cn(
          'px-2.5 py-1.5 rounded-full shadow-md border text-xs font-bold whitespace-nowrap transition-all cursor-pointer',
          isSelected
            ? 'bg-brand-accent text-white border-brand-accent'
            : 'bg-white text-zinc-700 border-zinc-300 hover:border-zinc-400'
        )}
      >
        {formatDuration(route.durationSeconds)} <span className="opacity-70">· {formatDistance(route.distanceMeters)}</span>
      </button>
    </AdvancedMarker>
  );
}

// Numbered pins (1, 2, 3…) for the selected route's actual visiting order, plus
// the warehouse as the fixed starting point. Clicking a stop's pin removes every
// one of its orders from the bundle (or opens the picker if it has more than
// one order) - `visibleStopIds` hides pins the current search doesn't match
// without renumbering the rest, since the number reflects real route position.
function StopMarkers({ warehouse, stops, stopOrder, visibleStopIds, onPinClick }: {
  warehouse: { lat: number; lng: number };
  stops: SchoolStop[];
  stopOrder: number[];
  visibleStopIds: Set<string>;
  onPinClick: (stop: SchoolStop) => void;
}) {
  return (
    <>
      <AdvancedMarker position={warehouse} zIndex={30}>
        <div className="relative">
          <Pin background="#1e1b4b" glyphColor="#fff" borderColor="#312e81" scale={1.3}>
            <Warehouse className="w-3.5 h-3.5 text-white" />
          </Pin>
        </div>
      </AdvancedMarker>
      {stopOrder.map((stopIndex, visitPosition) => {
        const stop = stops[stopIndex];
        if (!stop || !visibleStopIds.has(stop.id)) return null;
        return (
          <AdvancedMarker
            key={stop.id}
            position={stop.position}
            zIndex={25}
            title={`${visitPosition + 1}. ${stop.schoolName} - click to remove from bundle`}
            onClick={() => onPinClick(stop)}
          >
            <Pin background="#2563eb" glyphColor="#fff" borderColor="#1d4ed8" scale={1.1}>
              <span className="text-[10px] font-black">{visitPosition + 1}</span>
            </Pin>
          </AdvancedMarker>
        );
      })}
    </>
  );
}

// Orange pins for eligible orders NOT currently in the bundle (only rendered in
// "All Orders" view mode) - click to add a school's order(s) to the bundle.
function ExtraStopMarkers({ stops, onPinClick }: {
  stops: SchoolStop[];
  onPinClick: (stop: SchoolStop) => void;
}) {
  return (
    <>
      {stops.map(stop => (
        <AdvancedMarker
          key={stop.id}
          position={stop.position}
          zIndex={20}
          title={`${stop.schoolName} - not in bundle, click to add`}
          onClick={() => onPinClick(stop)}
        >
          <Pin background="#f97316" glyphColor="#fff" borderColor="#c2410c" scale={1} />
        </AdvancedMarker>
      ))}
    </>
  );
}

// Full-screen "Show Route" view: the shortest one-way driving route from the
// warehouse through every bundled order's school, ending at the last one - with
// every alternative Google offers rendered at once (primary highlighted, others
// muted/clickable to swap), similar to clicking Directions on Google Maps itself.
// A search + bundle/all-orders filter above the map controls which pins show,
// and pins are clickable to add/remove their orders from the bundle - the route
// itself is automatically recalculated whenever the bundle's composition
// changes. Rendered as a sibling of OrderBuilderMap inside the build screen's
// existing <APIProvider> (see OrderBuilderScreen.tsx) so it can resolve
// useMap/useMapsLibrary without a second Maps script load.
export function OrderBuilderRouteDialog({ isOpen, onClose, orders, selectedOrderIds, warehouse, onToggleOrder, onSetOrdersForSchool }: {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  selectedOrderIds: Set<string>;
  warehouse: { lat: number; lng: number } | null;
  onToggleOrder: (orderId: string) => void;
  onSetOrdersForSchool: (orderIdsForSchool: string[], tickedIds: string[]) => void;
}) {
  const routesLib = useMapsLibrary('routes');
  const { unitPriceByStockCode, weightByStockCode } = useStockLookups();
  const { trucks } = useTrucks();
  const isMobile = useIsMobile();
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const lastSignatureRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [directionsResult, setDirectionsResult] = useState<google.maps.DirectionsResult | null>(null);
  const [alternatives, setAlternatives] = useState<RouteAlternative[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockQuery, setStockQuery] = useState('');
  // Defaults to showing every eligible order (not just the bundle) - the bundle
  // toggle below is an opt-in narrowing, not the default view.
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [activeModalStop, setActiveModalStop] = useState<SchoolStop | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Client trucks with a weight limit set - the only ones a load can meaningfully
  // be checked against, same eligibility rule Auto-Build uses.
  const weighableTrucks = useMemo(
    () => clientTrucks(trucks).filter((t): t is typeof t & { capacityKg: number } => typeof t.capacityKg === 'number' && t.capacityKg > 0),
    [trucks]
  );

  // Bundle stops - every school with at least one selected order. This is what
  // actually gets routed. Re-reads the geocoded-pin cache fresh on every
  // recompute (not memoized separately) since this dialog can mount well before
  // OrderBuilderMap's own background geocoding of every eligible school finishes
  // - a memo keyed on stable deps could otherwise freeze on a stale/empty read.
  const stops = useMemo<SchoolStop[]>(() => {
    const bySchoolKey = new Map(loadCachedSchoolPins().map(p => [p.schoolKey, p]));
    const groups = new Map<string, SchoolStop>();
    orders.forEach(o => {
      if (!selectedOrderIds.has(o.id)) return;
      const key = schoolKeyFor(o.schoolName);
      const pin = bySchoolKey.get(key);
      if (!pin) return; // not geocoded yet - can't place it on a route
      const existing = groups.get(key);
      if (existing) existing.orders.push(o);
      else groups.set(key, { id: key, schoolName: o.schoolName, position: pin.position, orders: [o] });
    });
    return [...groups.values()];
  }, [orders, selectedOrderIds]);

  // Non-bundle stops - only computed/shown in "All Orders" view. A school with
  // BOTH selected and unselected orders is already a bundle stop above, so its
  // remaining unselected orders aren't split into a second orange pin here -
  // clicking that school's (blue) pin opens the same picker to adjust them.
  const nonBundleStops = useMemo<SchoolStop[]>(() => {
    if (viewMode !== 'all') return [];
    const bySchoolKey = new Map(loadCachedSchoolPins().map(p => [p.schoolKey, p]));
    const bundleKeys = new Set(stops.map(s => s.id));
    const groups = new Map<string, SchoolStop>();
    orders.forEach(o => {
      if (selectedOrderIds.has(o.id)) return;
      const key = schoolKeyFor(o.schoolName);
      if (bundleKeys.has(key)) return;
      const pin = bySchoolKey.get(key);
      if (!pin) return;
      const existing = groups.get(key);
      if (existing) existing.orders.push(o);
      else groups.set(key, { id: key, schoolName: o.schoolName, position: pin.position, orders: [o] });
    });
    return [...groups.values()];
  }, [orders, selectedOrderIds, stops, viewMode]);

  const visibleStopIds = useMemo(
    () => new Set(stops.filter(s => stopMatchesQuery(s, searchQuery) && stopMatchesStockQuery(s, stockQuery)).map(s => s.id)),
    [stops, searchQuery, stockQuery]
  );
  const visibleNonBundleStops = useMemo(
    () => nonBundleStops.filter(s => stopMatchesQuery(s, searchQuery) && stopMatchesStockQuery(s, stockQuery)),
    [nonBundleStops, searchQuery, stockQuery]
  );

  const reset = useCallback(() => {
    lastSignatureRef.current = null;
    setLoading(false);
    setError(null);
    setDirectionsResult(null);
    setAlternatives([]);
    setSelectedIndex(0);
    setSearchQuery('');
    setStockQuery('');
    setViewMode('all');
    setActiveModalStop(null);
    setSelectedTruckId(null);
    setExpandedOrderIds(new Set());
  }, []);

  // Requests (or re-requests) the route whenever the bundle's actual composition
  // changes - not on every render, and not on incidental reference changes to
  // `stops`/`orders` that don't actually add/remove a stop (guarded by comparing
  // a signature of the current stop set against the last one routed).
  useEffect(() => {
    if (!isOpen) { reset(); return; }
    if (stops.length === 0) {
      setDirectionsResult(null);
      setAlternatives([]);
      setError(null);
      lastSignatureRef.current = null;
      return;
    }
    if (!routesLib || !warehouse) return;

    const signature = stops.map(s => s.id).sort().join('|');
    if (signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    setLoading(true);
    setError(null);
    directionsServiceRef.current ??= new routesLib.DirectionsService();

    computeOptimizedRoute(directionsServiceRef.current, warehouse, stops)
      .then(route => {
        if (!route) {
          setError('No route found.');
          return;
        }
        setDirectionsResult(route.directionsResult);
        setAlternatives(route.alternatives);
        setSelectedIndex(0);
      })
      .catch(err => {
        console.error('[OrderBuilderRouteDialog] computeOptimizedRoute failed:', err);
        setError('Could not calculate a route. Please try again.');
      })
      .finally(() => setLoading(false));
  }, [isOpen, routesLib, warehouse, stops, reset]);

  const handleClose = () => {
    reset();
    onClose();
  };

  // Single-order school toggles straight in/out of the bundle; a multi-order
  // school opens the same picker OrderBuilderMap uses, so the user chooses
  // exactly which of its orders to add or remove either way.
  const handlePinClick = (stop: SchoolStop) => {
    if (stop.orders.length === 1) {
      onToggleOrder(stop.orders[0].id);
      return;
    }
    setActiveModalStop(stop);
  };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  if (!isOpen) return null;

  const selectedRoute = alternatives[selectedIndex];

  return (
    <div className="fixed inset-0 z-[300] flex flex-col bg-white">
      <div className="flex items-center gap-4 px-5 py-4 border-b border-zinc-200 shrink-0 bg-zinc-50/50">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <Navigation className="w-5 h-5 text-brand-accent shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-zinc-900 whitespace-nowrap">Route to Delivery</h2>
            {selectedRoute && (
              <p className="text-xs text-zinc-500 whitespace-nowrap">
                {formatDuration(selectedRoute.durationSeconds)} · {formatDistance(selectedRoute.distanceMeters)} · {stops.length} stop{stops.length === 1 ? '' : 's'}
                {alternatives.length > 1 && ` · ${alternatives.length} routes`}
              </p>
            )}
          </div>
        </div>

        {/* sm:ml-[340px] lines the filters up with the map below (not the
            sidebar, see RouteSidebar's own w-[340px]) instead of sitting
            above it. No margin below sm: the sidebar stacks above the map
            there instead of beside it, so there's nothing to clear. */}
        <div className="flex-1 flex items-center justify-start gap-4 min-w-0 sm:ml-[340px]">
          <button
            type="button"
            role="switch"
            aria-checked={viewMode === 'bundle'}
            title={viewMode === 'bundle' ? 'Showing order bundle only - click to show all orders' : 'Showing all orders - click to show the order bundle only'}
            onClick={() => setViewMode(v => (v === 'bundle' ? 'all' : 'bundle'))}
            className="flex items-center gap-2 shrink-0 cursor-pointer"
          >
            <span
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
                viewMode === 'bundle' ? 'bg-brand-accent' : 'bg-zinc-300'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                  viewMode === 'bundle' ? 'translate-x-4' : 'translate-x-0.5'
                )}
              />
            </span>
            <span className="text-xs font-semibold text-zinc-600 whitespace-nowrap">Bundle only</span>
          </button>

          <div className="relative flex-1 min-w-0 max-w-xs shrink">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              title="Filter pins by order number, area, or school name"
              placeholder="Search order no., area, school…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all"
            />
          </div>

          <div className="relative flex-1 min-w-0 max-w-[200px] shrink">
            <PackageSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              title="Filter pins to orders carrying a matching line item stock code"
              placeholder="Filter by stock code…"
              value={stockQuery}
              onChange={(e) => setStockQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all"
            />
          </div>
        </div>

        <button
          type="button"
          title="Close"
          onClick={handleClose}
          className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {!warehouse ? (
        <div className="flex-1 flex items-center justify-center bg-zinc-50">
          <div className="text-center max-w-sm p-8">
            <AlertCircle className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-zinc-900 mb-1">No Warehouse Set</h3>
            <p className="text-xs text-zinc-500">Set a warehouse address in Settings before showing a route.</p>
          </div>
        </div>
      ) : stops.length === 0 ? (
        <div className="flex-1 flex items-center justify-center bg-zinc-50">
          <div className="text-center max-w-sm p-8">
            <AlertCircle className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-zinc-900 mb-1">Nothing to Route To</h3>
            <p className="text-xs text-zinc-500">Select at least one order with a geocoded school first.</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center bg-zinc-50">
          <div className="text-center max-w-sm p-8">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-zinc-700">{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          <RouteSidebar
            stops={stops}
            stopOrder={selectedRoute?.stopOrder ?? stops.map((_, i) => i)}
            unitPriceByStockCode={unitPriceByStockCode}
            weightByStockCode={weightByStockCode}
            trucks={weighableTrucks}
            selectedTruckId={selectedTruckId}
            onSelectTruck={setSelectedTruckId}
            expandedOrderIds={expandedOrderIds}
            onToggleOrderExpanded={toggleOrderExpanded}
            stockQuery={stockQuery}
          />

          <div className="flex-1 relative min-h-[240px]">
            <GoogleMap
              defaultCenter={warehouse}
              defaultZoom={9}
              mapId="ORDER_BUILDER_ROUTE_MAP"
              style={{ width: '100%', height: '100%' }}
              disableDoubleClickZoom={true}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            >
              <FitBoundsOnLoad warehouse={warehouse} stops={stops} ready={!!directionsResult} />
              {directionsResult && alternatives.map((route, i) => (
                <RoutePolyline key={i} directionsResult={directionsResult} routeIndex={i} isSelected={i === selectedIndex} />
              ))}
              {selectedRoute && (
                <StopMarkers
                  warehouse={warehouse}
                  stops={stops}
                  stopOrder={selectedRoute.stopOrder}
                  visibleStopIds={visibleStopIds}
                  onPinClick={handlePinClick}
                />
              )}
              {viewMode === 'all' && <ExtraStopMarkers stops={visibleNonBundleStops} onPinClick={handlePinClick} />}
              {alternatives.map((route, i) => (
                <RouteLabel key={i} route={route} isSelected={i === selectedIndex} onSelect={() => setSelectedIndex(i)} />
              ))}
            </GoogleMap>

            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70">
                <div className="flex flex-col items-center gap-2 text-zinc-500">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs font-black uppercase tracking-widest">Calculating Route…</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeModalStop && (
        isMobile ? (
          <SchoolOrdersSelectModalMobile
            isOpen={true}
            schoolName={activeModalStop.schoolName}
            orders={activeModalStop.orders}
            selectedOrderIds={selectedOrderIds}
            onConfirm={(tickedIds) => {
              onSetOrdersForSchool(activeModalStop.orders.map(o => o.id), tickedIds);
              setActiveModalStop(null);
            }}
            onClose={() => setActiveModalStop(null)}
          />
        ) : (
          <SchoolOrdersSelectModal
            isOpen={true}
            schoolName={activeModalStop.schoolName}
            orders={activeModalStop.orders}
            selectedOrderIds={selectedOrderIds}
            onConfirm={(tickedIds) => {
              onSetOrdersForSchool(activeModalStop.orders.map(o => o.id), tickedIds);
              setActiveModalStop(null);
            }}
            onClose={() => setActiveModalStop(null)}
          />
        )
      )}
    </div>
  );
}

// Google Maps-style left panel: every bundled order, grouped by delivery stop in
// the selected route's actual visiting order (renumbers when the user picks a
// different alternative), each with its order number, unit count and Rand value,
// plus a running grand total pinned at the bottom. Always reflects the bundle,
// independent of the map's search/view-mode filters (which only affect pin
// visibility) - see OrderBuilderRouteDialog.
function RouteSidebar({ stops, stopOrder, unitPriceByStockCode, weightByStockCode, trucks, selectedTruckId, onSelectTruck, expandedOrderIds, onToggleOrderExpanded, stockQuery }: {
  stops: SchoolStop[];
  stopOrder: number[];
  unitPriceByStockCode: Record<string, number>;
  weightByStockCode: Record<string, number>;
  trucks: WeighableTruck[];
  selectedTruckId: string | null;
  onSelectTruck: (id: string) => void;
  expandedOrderIds: Set<string>;
  onToggleOrderExpanded: (orderId: string) => void;
  stockQuery: string;
}) {
  const sq = stockQuery.toLowerCase();
  const allOrders = stops.flatMap(s => s.orders);
  const totalUnits = allOrders.reduce((s, o) => s + orderUnits(o), 0);
  const totalValue = allOrders.reduce((s, o) => s + orderValueRand(o, unitPriceByStockCode), 0);
  const totalWeightKg = allOrders.reduce((s, o) => s + orderWeightKg(o, weightByStockCode), 0);

  return (
    <aside className="w-full sm:w-[340px] shrink-0 border-b sm:border-b-0 sm:border-r border-zinc-200 bg-white flex flex-col max-h-[45vh] sm:max-h-none">
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
        {stopOrder.map((stopIndex, visitPosition) => {
          const stop = stops[stopIndex];
          if (!stop) return null;
          const stopValue = stop.orders.reduce((s, o) => s + orderValueRand(o, unitPriceByStockCode), 0);
          return (
            <div key={stop.id} className="p-4">
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-6 h-6 rounded-full bg-brand-accent text-white flex items-center justify-center text-[11px] font-black shrink-0">
                  {visitPosition + 1}
                </div>
                <p className="text-sm font-bold text-zinc-900 truncate min-w-0">{stop.schoolName}</p>
              </div>
              <div className="space-y-1 pl-8">
                {stop.orders.map(order => {
                  const isExpanded = expandedOrderIds.has(order.id);
                  return (
                    <div key={order.id}>
                      <button
                        type="button"
                        title={isExpanded ? 'Hide line items' : 'Show line items'}
                        onClick={() => onToggleOrderExpanded(order.id)}
                        className="w-full flex items-center justify-between gap-3 text-xs py-1 -mx-1 px-1 rounded hover:bg-zinc-50 transition-colors cursor-pointer text-left"
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-zinc-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3 h-3 text-zinc-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-mono font-bold text-zinc-700 truncate">{order.orderNumber || '—'}</p>
                            <p className="text-[10px] text-zinc-400">{orderUnits(order)} units</p>
                          </div>
                        </div>
                        <p className="font-bold text-zinc-800 tabular-nums shrink-0">R{formatCurrency(orderValueRand(order, unitPriceByStockCode))}</p>
                      </button>
                      {isExpanded && (
                        <div className="ml-4 mb-1.5 border border-zinc-200/60 rounded-lg bg-zinc-50/50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                          {order.lineItems.length === 0 ? (
                            <p className="px-3 py-2 text-[11px] text-zinc-400 italic">No line items.</p>
                          ) : (
                            <table className="w-full text-left">
                              <tbody className="divide-y divide-zinc-200/60">
                                {order.lineItems.map((item, idx) => {
                                  const isStockMatched = sq.length > 0 && item.stockCode.toLowerCase().includes(sq);
                                  return (
                                    <tr key={idx} className={isStockMatched ? 'bg-amber-50/80' : undefined}>
                                      <td className="px-3 py-1.5 font-mono text-[11px] text-zinc-600">{item.stockCode || '—'}</td>
                                      <td className="px-3 py-1.5 text-right font-mono text-[11px] font-bold text-zinc-700 shrink-0">{item.qty}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {stop.orders.length > 1 && (
                <div className="pl-8 mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                  <span>Stop Total</span>
                  <span className="tabular-nums text-zinc-600">R{formatCurrency(stopValue)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/70 p-4 space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><Package className="w-3.5 h-3.5" />Total Units</span>
            <span className="font-bold text-zinc-700 tabular-nums">{totalUnits}</span>
          </div>
          <div className="flex items-center justify-between text-sm font-black text-zinc-900">
            <span>Total Value</span>
            <span className="tabular-nums">R{formatCurrency(totalValue)}</span>
          </div>
        </div>

        <TruckFullness totalWeightKg={totalWeightKg} trucks={trucks} selectedTruckId={selectedTruckId} onSelectTruck={onSelectTruck} />
      </div>
    </aside>
  );
}

interface WeighableTruck {
  id: string;
  name: string;
  capacityKg: number;
}

// How full the checked truck would be, by weight - separate from the order
// picker/bundle logic above, purely a read-only planning aid (doesn't affect
// which orders are in the bundle). Client trucks without a weight limit set
// aren't offered here since there'd be nothing to divide by; see
// OrderBuilderSettingsDialog for setting one.
function TruckFullness({ totalWeightKg, trucks, selectedTruckId, onSelectTruck }: {
  totalWeightKg: number;
  trucks: WeighableTruck[];
  selectedTruckId: string | null;
  onSelectTruck: (id: string) => void;
}) {
  if (trucks.length === 0) {
    return (
      <div className="pt-3 border-t border-zinc-200">
        <p className="text-[10px] text-zinc-400 leading-relaxed">
          No client truck with a weight limit set - add one in Order Builder Settings to see truck load here.
        </p>
      </div>
    );
  }

  const selectedTruck = trucks.find(t => t.id === selectedTruckId) ?? trucks[0];
  const pct = Math.min(100, (totalWeightKg / selectedTruck.capacityKg) * 100);
  const overCapacity = totalWeightKg > selectedTruck.capacityKg;
  const barColor = overCapacity ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="pt-3 border-t border-zinc-200 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-400">
          <TruckIcon className="w-3.5 h-3.5" />
          Truck Load
        </span>
        {trucks.length > 1 ? (
          <select
            title="Select which truck to check the load against"
            value={selectedTruck.id}
            onChange={(e) => onSelectTruck(e.target.value)}
            className="text-[10px] font-bold text-zinc-600 bg-transparent border-none focus:outline-none cursor-pointer"
          >
            {trucks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : (
          <span className="text-[10px] font-bold text-zinc-500">{selectedTruck.name}</span>
        )}
      </div>
      <div className="w-full h-2.5 bg-zinc-200 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className={cn('font-bold', overCapacity ? 'text-red-600' : 'text-zinc-700')}>
          {totalWeightKg.toFixed(0)} kg{overCapacity ? ' · Over capacity' : ''}
        </span>
        <span className="text-zinc-400">of {selectedTruck.capacityKg.toFixed(0)} kg</span>
      </div>
    </div>
  );
}

// Fits the map bounds to the warehouse + every stop as soon as they're all
// known - runs once (ready flips true only after the route request resolves) so
// the camera settles on the actual route instead of re-fitting on every
// alternative selection.
function FitBoundsOnLoad({ warehouse, stops, ready }: {
  warehouse: { lat: number; lng: number };
  stops: SchoolStop[];
  ready: boolean;
}) {
  const map = useMap();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!map || !ready || firedRef.current || stops.length === 0) return;
    firedRef.current = true;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(warehouse);
    stops.forEach(s => bounds.extend(s.position));
    map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
  }, [map, ready, warehouse, stops]);

  return null;
}
