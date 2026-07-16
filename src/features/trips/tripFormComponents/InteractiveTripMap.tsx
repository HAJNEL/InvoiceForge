/// <reference types="google.maps" />
import { useState, useEffect, useRef, useMemo, Dispatch, SetStateAction } from 'react';
import { Warehouse, Filter, Loader2 } from 'lucide-react';
import {
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';
import { cn } from '../../../lib/utils';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { Settings, TripStop } from '../../../types';
import { GeocodedInvoice } from './types';
import { STATUS_COLORS, getStatusColor, getStatusBorderColor } from './statusColors';
import { buildPinSearchAddress } from '../../../lib/geocoding';

// A single map pin. Google's AdvancedMarker renders its children into the map's
// overlay pane — OUTSIDE React's event root — so React-synthetic pointer events never
// fire on the content (only the library's own onClick does). We therefore attach NATIVE
// pointer listeners via a ref to detect a click-and-hold (press >= 500ms) for adding /
// removing the pin from the trip, while a quick click runs onQuickClick (view info).
function TripPinMarker({
  inv,
  isSelected,
  isCustomStop,
  orderIndex,
  onQuickClick,
  onHold,
}: {
  inv: GeocodedInvoice;
  isSelected: boolean;
  isCustomStop: boolean;
  orderIndex: number;
  onQuickClick: () => void;
  onHold: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<number | null>(null);
  const firedRef = useRef(false);
  // Keep the latest onHold without re-attaching native listeners every render.
  const onHoldRef = useRef(onHold);
  onHoldRef.current = onHold;

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    const clearTimer = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // primary button only
      startX = e.clientX;
      startY = e.clientY;
      firedRef.current = false;
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        firedRef.current = true;
        timerRef.current = null;
        onHoldRef.current();
      }, 500);
    };
    const onMove = (e: PointerEvent) => {
      if (!timerRef.current) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (dx * dx + dy * dy > 100) clearTimer(); // moved > ~10px: treat as a drag/pan, not a hold
    };
    const onUp = () => clearTimer();

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      clearTimer();
    };
  }, []);

  return (
    <AdvancedMarker
      position={inv.position}
      onClick={() => {
        // If a hold just fired, swallow the trailing click so we don't also run the
        // quick-click action.
        if (firedRef.current) {
          firedRef.current = false;
          return;
        }
        onQuickClick();
      }}
    >
      <div
        ref={contentRef}
        className={cn(
          "cursor-pointer group relative transition-transform duration-300",
          isSelected ? "scale-125 z-40" : "hover:scale-110 z-10"
        )}
        title={isCustomStop ? `${inv.client} (Click to edit, click & hold to remove)` : `${inv.client} (Click to view details, click & hold to add/remove from trip)`}
      >
        <Pin
          background={isSelected ? (isCustomStop ? '#4338ca' : '#f59e0b') : getStatusColor(inv.status)}
          glyphColor="#fff"
          borderColor={isSelected ? (isCustomStop ? '#312e81' : '#d97706') : getStatusBorderColor(inv.status)}
          scale={isSelected ? 1.35 : 1.1}
        >
          <div className="flex flex-col items-center justify-center">
            {isSelected ? (
              <span className="text-[11px] font-black leading-none text-white font-mono shrink-0">
                {orderIndex + 1}
              </span>
            ) : (
              <span className="text-[7px] font-black text-white uppercase leading-none">
                {inv.number.slice(-3)}
              </span>
            )}
          </div>
        </Pin>

        {/* Custom floating label on hover */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-zinc-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
          {isCustomStop ? `${inv.client} (${inv.number})` : `${inv.client} (Inv: ${inv.number})`}
          {isSelected && ` • Stop ${orderIndex + 1}`}
        </div>
      </div>
    </AdvancedMarker>
  );
}

// Interactive Map component with custom sequence indicators
export function InteractiveTripMap({
  invoices,
  geocodedInvoices,
  setGeocodedInvoices,
  onInvoiceClick,
  onInvoiceToggle,
  warehouse,
  filters,
  stops = [],
  setStops,
  setEditingStop,
  setIsStopModalOpen
}: {
  invoices: UIInvoice[],
  geocodedInvoices: GeocodedInvoice[],
  setGeocodedInvoices: Dispatch<SetStateAction<GeocodedInvoice[]>>,
  onInvoiceClick: (inv: GeocodedInvoice) => void,
  onInvoiceToggle?: (id: string) => void,
  warehouse: Settings | null,
  filters: { searchTerm: string, selectedDistrict: string, selectedStatus: string },
  stops: TripStop[],
  setStops: Dispatch<SetStateAction<TripStop[]>>,
  setEditingStop: Dispatch<SetStateAction<TripStop | null>>,
  setIsStopModalOpen: Dispatch<SetStateAction<boolean>>
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const processingIds = useRef<Set<string>>(new Set());
  // Signature of the last auto-fitted set of points, so we only re-zoom when the
  // plotted locations actually change — not when an invoice/stop is toggled in/out.
  const lastFitSignatureRef = useRef<string>('');
  // Keep the map covered until it has framed the pins, so it never flashes the
  // default (Pretoria) view before jumping to the right place.
  const [hasFitted, setHasFitted] = useState(false);

  // Geocode all invoices and custom stops
  useEffect(() => {
    if (!geocodingLib) return;

    // 1. Invoices to geocode using priority logic
    const invoicesToGeocode = invoices.filter((inv) => {
      const existing = geocodedInvoices.find(gi => gi.id === inv.id);
      const expectedAddress = buildPinSearchAddress(inv);

      if (!existing) {
        return !processingIds.current.has(inv.id + "_" + expectedAddress);
      }

      const isOutdated = existing.searchAddress !== expectedAddress;
      return isOutdated && !processingIds.current.has(inv.id + "_" + expectedAddress);
    });

    // 2. Custom stops to geocode
    const customStopsToGeocode = (stops || []).filter((stop) => {
      if (stop.invoiceId) return false; // Handled by invoice geocoding
      if (!stop.location) return false;

      const existing = geocodedInvoices.find(gi => gi.id === stop.id);
      const expectedAddress = stop.location.trim();

      if (!existing) {
        return !processingIds.current.has(stop.id + "_" + expectedAddress);
      }

      const isOutdated = existing.searchAddress !== expectedAddress;
      return isOutdated && !processingIds.current.has(stop.id + "_" + expectedAddress);
    });

    if (invoicesToGeocode.length === 0 && customStopsToGeocode.length === 0) return;

    // Mark as processing with address hashes
    invoicesToGeocode.forEach(inv => {
      const expectedAddress = buildPinSearchAddress(inv);
      processingIds.current.add(inv.id + "_" + expectedAddress);
    });

    customStopsToGeocode.forEach(stop => {
      const expectedAddress = stop.location.trim();
      processingIds.current.add(stop.id + "_" + expectedAddress);
    });

    const geocodeLocations = async () => {
      const results: GeocodedInvoice[] = [];

      // Geocode Invoices
      for (const inv of invoicesToGeocode) {
        const expectedAddress = buildPinSearchAddress(inv);

        try {
          const { results: geoResults } = await new geocodingLib.Geocoder().geocode({
            address: expectedAddress
          });

          if (geoResults && geoResults[0]) {
            results.push({
              id: inv.id,
              number: inv.number,
              client: inv.client,
              status: inv.status,
              address: geoResults[0].formatted_address,
              searchAddress: expectedAddress,
              position: {
                lat: geoResults[0].geometry.location.lat(),
                lng: geoResults[0].geometry.location.lng()
              },
              district: inv.district,
              lineItems: inv.lineItems
            });
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`Geocoding failed for invoice ${inv.number}:`, err);
        }
      }

      // Geocode Custom Stops
      for (const stop of customStopsToGeocode) {
        const expectedAddress = stop.location.trim();
        try {
          const { results: geoResults } = await new geocodingLib.Geocoder().geocode({
            address: expectedAddress
          });

          if (geoResults && geoResults[0]) {
            results.push({
              id: stop.id,
              number: stop.type === 'Refuel' ? 'REF' : (stop.type === 'Sleep' ? 'SLP' : (stop.type === 'Rest' ? 'RST' : 'STP')),
              client: stop.location,
              status: 'custom_stop',
              address: geoResults[0].formatted_address,
              searchAddress: expectedAddress,
              position: {
                lat: geoResults[0].geometry.location.lat(),
                lng: geoResults[0].geometry.location.lng()
              },
              district: 'Custom Stop',
              lineItems: []
            });
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`Geocoding failed for custom stop ${stop.location}:`, err);
        }
      }

      if (results.length > 0) {
        setGeocodedInvoices((prev) => {
          const newIds = results.map(r => r.id);
          const filteredPrev = prev.filter(p => !newIds.includes(p.id));
          return [...filteredPrev, ...results];
        });
      }
    };

    geocodeLocations();
  }, [geocodingLib, invoices, stops, geocodedInvoices, setGeocodedInvoices]);

  // Fit bounds so the map opens showing all the pins it will render.
  useEffect(() => {
    if (!map) return;

    // The pins that will actually render on the map: live invoices that aren't
    // delivered/invoiced, plus active custom stops. We base both the bounds AND the
    // re-fit signature on THIS set (not just geocodedInvoices) so that when invoices
    // finish loading after the map mounts, the signature changes and the map re-fits
    // to include them — guaranteeing all pins are visible by default. Ignoring the
    // search/legend filters here keeps the default view showing every pin.
    const renderable = geocodedInvoices.filter((gi) => {
      if (gi.status === 'custom_stop') {
        return (stops || []).some(s => s.id === gi.id);
      }
      const liveInv = invoices.find(i => i.id === gi.id);
      if (!liveInv) return false;
      const s = (liveInv.status || '').toLowerCase();
      return !(s === 'delivered' || s === 'invoiced' || s === 'complete' || s === 'completed');
    });

    // Only auto-fit/zoom when this rendered set actually changes. Toggling an invoice
    // in/out of the trip does NOT change the set, so the map keeps its zoom & center.
    const signature =
      renderable
        .map(gi => `${gi.id}:${gi.position.lat.toFixed(5)},${gi.position.lng.toFixed(5)}`)
        .sort()
        .join('|') +
      `|wh:${warehouse?.warehouseLat ?? ''},${warehouse?.warehouseLng ?? ''}`;

    if (signature === lastFitSignatureRef.current) return;
    lastFitSignatureRef.current = signature;

    if (renderable.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      renderable.forEach(gi => bounds.extend(gi.position));

      if (warehouse?.warehouseLat && warehouse?.warehouseLng) {
        bounds.extend({ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng });
      }

      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

      // Reveal the map only once it has settled on the pins (and clamp extreme
      // zoom), so the default view is never shown before the jump.
      const onIdle = () => {
        if (map.getZoom() && map.getZoom()! > 14) {
          map.setZoom(12);
        }
        setHasFitted(true);
      };
      if (typeof google !== 'undefined' && google.maps?.event) {
        google.maps.event.addListenerOnce(map, 'idle', onIdle);
      } else {
        setHasFitted(true);
      }
    } else if (warehouse?.warehouseLat && warehouse?.warehouseLng) {
      // Loader/fallback to prevent loading zoomed-in exactly on the warehouse point
      map.setCenter({ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng });
      map.setZoom(11);
    } else {
      map.setCenter({ lat: -25.7479, lng: 28.2293 });
      map.setZoom(11);
    }
  }, [map, geocodedInvoices, warehouse, invoices, stops]);

  // Safety net: never keep the map hidden indefinitely (e.g. a trip with no
  // plottable invoices, or slow geocoding) — reveal after a short grace period.
  useEffect(() => {
    const t = window.setTimeout(() => setHasFitted(true), 3000);
    return () => window.clearTimeout(t);
  }, []);

  // Apply filters on the geocoded list to decide which pins to render
  const [selectedLegendStatuses, setSelectedLegendStatuses] = useState<string[]>([]);

  const filteredPins = useMemo(() => {
    const pins: GeocodedInvoice[] = [];
    const seenIds = new Set<string>();

    geocodedInvoices.forEach(pin => {
      if (seenIds.has(pin.id)) return;
      seenIds.add(pin.id);

      if (pin.status === 'custom_stop') {
        pins.push(pin);
        return;
      }

      const liveInv = invoices.find(inv => inv.id === pin.id);
      if (!liveInv) return;
      pins.push({
        ...pin,
        status: liveInv.status,
        client: liveInv.client,
        number: liveInv.number,
        lineItems: liveInv.lineItems,
        district: liveInv.district,
      });
    });

    return pins.filter(pin => {
      if (pin.status === 'custom_stop') {
        // ALWAYS show custom stops on the map if they are part of our current trip stops list!
        const isPartofTrip = (stops || []).some(s => s.id === pin.id);
        return isPartofTrip;
      }

      // Do not display invoices on the map that have a status of delivered or invoiced
      const statusLower = (pin.status || '').toLowerCase();
      if (statusLower === 'delivered' || statusLower === 'invoiced' || statusLower === 'complete' || statusLower === 'completed') {
        return false;
      }

      // 1. Text Search
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = !filters.searchTerm ||
        pin.number.toLowerCase().includes(searchLower) ||
        pin.client.toLowerCase().includes(searchLower) ||
        (pin.district?.toLowerCase() || '').includes(searchLower);

      // 2. District filter
      const matchesDistrict = filters.selectedDistrict === 'all' || (pin.district || '').trim().toUpperCase() === filters.selectedDistrict.trim().toUpperCase();

      // 3. Status filter
      const matchesStatus = filters.selectedStatus === 'all' || (() => {
        const normFilterStatus = filters.selectedStatus.toLowerCase();
        const normPinStatus = (statusLower === 'assembly' ? 'assembled' :
          (statusLower === 'loaded' ? 'partially_complete' :
            (statusLower === 'partially complete' ? 'partially_complete' :
              (statusLower === 'completed' || statusLower === 'invoiced' ? 'complete' : statusLower)))).toLowerCase();
        return normPinStatus === normFilterStatus;
      })();

      // 4. Legend status filter
      const normPinStatus = (statusLower === 'assembly' ? 'assembled' :
        (statusLower === 'loaded' ? 'partially_complete' :
          (statusLower === 'partially complete' ? 'partially_complete' :
            (statusLower === 'completed' || statusLower === 'invoiced' ? 'complete' : statusLower)))).toLowerCase();
      const matchesLegendStatus = selectedLegendStatuses.length === 0 || selectedLegendStatuses.includes(normPinStatus);

      return matchesSearch && matchesDistrict && matchesStatus && matchesLegendStatus;
    });
  }, [geocodedInvoices, filters, invoices, stops, selectedLegendStatuses]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 relative">
        <Map
          defaultCenter={{ lat: -25.7479, lng: 28.2293 }}
          defaultZoom={11}
          mapId="INVOICE_TRIP_RECORDER_MAP"
          style={{ width: '100%', height: '100%' }}
          disableDoubleClickZoom={true}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          {/* Render matching filtered pins */}
          {filteredPins.map((inv, pIdx) => {
            const orderIndex = (stops || []).findIndex(s => s.id === inv.id || (s.invoiceId && s.invoiceId === inv.id));
            const isSelected = orderIndex !== -1;
            const isCustomStop = inv.status === 'custom_stop';

            return (
              <TripPinMarker
                key={`${inv.id}-${pIdx}`}
                inv={inv}
                isSelected={isSelected}
                isCustomStop={isCustomStop}
                orderIndex={orderIndex}
                onQuickClick={() => {
                  // A quick (fast) click views info: edit a custom stop, or open the
                  // invoice's details/stock card.
                  if (isCustomStop) {
                    const matchedStop = (stops || []).find(s => s.id === inv.id);
                    if (matchedStop) {
                      setEditingStop(matchedStop);
                      setIsStopModalOpen(true);
                    }
                    return;
                  }
                  onInvoiceClick(inv);
                }}
                onHold={() => {
                  // A click-and-hold adds/removes from the trip (or removes a custom stop).
                  if (isCustomStop) {
                    setStops(prev => prev.filter(s => s.id !== inv.id));
                  } else if (onInvoiceToggle) {
                    onInvoiceToggle(inv.id);
                  }
                }}
              />
            );
          })}

          {/* Warehouse Center marker */}
          {warehouse?.warehouseLat && warehouse?.warehouseLng && (
            <AdvancedMarker
              key="warehouse-center-marker"
              position={{ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng }}
            >
              <div className="relative group">
                <Pin background="#1e1b4b" glyphColor="#fff" borderColor="#312e81" scale={1.4}>
                  <Warehouse className="w-3.5 h-3.5 text-white" />
                </Pin>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-indigo-950 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                  Main Warehouse Center
                </div>
              </div>
            </AdvancedMarker>
          )}
        </Map>

        {/* Cover the map until it has framed the pins, so the user only ever sees
            the final all-pins view (no Pretoria flash on open). */}
        {!hasFitted && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center bg-zinc-100">
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Loading Map…</span>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Legend with dynamic filter toggle */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border-t border-zinc-200 justify-between shrink-0 select-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-zinc-400" />
            Filter Statuses:
          </span>
          {['partially_complete', 'draft', 'pending', 'proposed', 'assembled', 'on_route'].map(status => {
            const isSelected = selectedLegendStatuses.length === 0 || selectedLegendStatuses.includes(status);
            const colorConfig = STATUS_COLORS[status] || { bg: '#71717a', border: '#3f3f46', label: status };
            const label = colorConfig.label;

            return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setSelectedLegendStatuses(prev => {
                    if (prev.includes(status)) {
                      return prev.filter(s => s !== status);
                    } else {
                      return [...prev, status];
                    }
                  });
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95",
                  isSelected
                    ? "text-white border-transparent"
                    : "bg-white text-zinc-450 border-zinc-200 hover:text-zinc-650 hover:border-zinc-350 opacity-60 hover:opacity-90"
                )}
                style={{
                  backgroundColor: isSelected ? colorConfig.bg : undefined,
                  boxShadow: isSelected ? `0 2px 4px ${colorConfig.bg}30` : undefined
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: isSelected ? '#fff' : colorConfig.bg }}
                />
                {label}
              </button>
            );
          })}
        </div>

        {selectedLegendStatuses.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedLegendStatuses([])}
            className="text-[10px] font-black uppercase text-red-500 hover:text-red-650 tracking-wider hover:underline px-2.5 py-1 leading-none border border-red-150 bg-red-50/50 rounded-lg shadow-sm font-bold scale-95 transition-all"
          >
            Show All
          </button>
        )}
      </div>
    </div>
  );
}
