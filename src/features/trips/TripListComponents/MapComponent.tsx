/// <reference types="google.maps" />
import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { Warehouse, CheckCircle2, Filter, Loader2 } from 'lucide-react';
import {
  Map,
  AdvancedMarker,
  Pin,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';
import { cn } from '../../../lib/utils';
import { buildPinSearchAddress } from '../../../lib/geocoding';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { Trip, Settings } from '../../../types';
import { GeocodedInvoice } from './types';
import { STATUS_COLORS } from './statusColors';
import { InvoicePin } from './InvoicePin';

export function MapComponent({ invoices, allInvoices, geocodedInvoices, setGeocodedInvoices, onInvoiceClick, warehouse, routedTrip, highlightedInvoiceIds, showHistory, isRefreshing, filters }: {
  invoices: UIInvoice[],
  allInvoices: UIInvoice[],
  geocodedInvoices: GeocodedInvoice[],
  setGeocodedInvoices: Dispatch<SetStateAction<GeocodedInvoice[]>>,
  onInvoiceClick: (inv: GeocodedInvoice) => void,
  warehouse: Settings | null,
  routedTrip: Trip | null,
  highlightedInvoiceIds: string[],
  showHistory: boolean,
  isRefreshing?: boolean,
  filters?: { searchTerm: string, selectedDistrict: string, selectedStatus: string, lineItemFilter: string }
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const routesLib = useMapsLibrary('routes');
  const processingIds = useRef<Set<string>>(new Set());
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);

  // Filter state for dynamic legend clicks
  const [selectedLegendStatuses, setSelectedLegendStatuses] = useState<string[]>([]);

  // Automatically reset selectedLegendStatuses to empty when a new routedTrip is activated
  const prevRoutedTripIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = routedTrip?.id || null;
    if (currentId !== prevRoutedTripIdRef.current) {
      prevRoutedTripIdRef.current = currentId;
      if (currentId) {
        setSelectedLegendStatuses([]);
      }
    }
  }, [routedTrip]);

  // Cleanly reset selectedLegendStatuses whenever switching showHistory state to avoid status-mismatched pin filter lockouts
  useEffect(() => {
    setSelectedLegendStatuses([]);
  }, [showHistory]);

  useEffect(() => {
    if (!map || !routesLib || !routedTrip || !warehouse?.warehouseLat) {
      if (directionsRenderer.current) {
        directionsRenderer.current.setMap(null);
      }
      return;
    }

    const calculateRoute = async () => {
      // Sort trip invoices according to the order of routedTrip.invoiceIds exactly
      const tripInvoices = geocodedInvoices
        .filter(gi => routedTrip.invoiceIds?.includes(gi.id))
        .sort((a, b) => {
          const indexA = routedTrip.invoiceIds?.indexOf(a.id) ?? 0;
          const indexB = routedTrip.invoiceIds?.indexOf(b.id) ?? 0;
          return indexA - indexB;
        });

      if (tripInvoices.length === 0) return;

      const directionsService = new routesLib.DirectionsService();

      if (!directionsRenderer.current) {
        directionsRenderer.current = new routesLib.DirectionsRenderer({
          map,
          suppressMarkers: true, // Suppress default icons so our high-fidelity pin sequence numbers are not duplicated/overlapped
          polylineOptions: {
            strokeColor: '#f59e0b',
            strokeWeight: 5,
            strokeOpacity: 0.8
          }
        });
      } else {
        directionsRenderer.current.setMap(map);
        directionsRenderer.current.setOptions({ suppressMarkers: true });
      }

      const origin = { lat: warehouse.warehouseLat!, lng: warehouse.warehouseLng! };

      const waypoints = tripInvoices.map(inv => ({
        location: inv.position,
        stopover: true
      }));

      try {
        const result = await directionsService.route({
          origin: origin,
          destination: origin,
          waypoints: waypoints,
          optimizeWaypoints: false, // Maintain exact trip stop sequence sequence order as defined in the trip
          travelMode: google.maps.TravelMode.DRIVING
        });

        directionsRenderer.current.setDirections(result);
      } catch (err) {
        console.error("Directions request failed:", err);
      }
    };

    calculateRoute();
  }, [map, routesLib, routedTrip, warehouse, geocodedInvoices]);

  useEffect(() => {
    if (!geocodingLib || !allInvoices.length) return;

    // Re-geocode when there's no cached pin yet OR the invoice's address data has
    // changed since it was cached (stale cache previously caused pins to keep
    // showing an old, sometimes coincidentally-shared, location).
    const invoicesToGeocode = allInvoices.filter((inv) => {
      const existing = geocodedInvoices.find((gi) => gi.id === inv.id);
      const expectedAddress = buildPinSearchAddress(inv);
      const processingKey = inv.id + '_' + expectedAddress;

      if (!existing) return !processingIds.current.has(processingKey);

      const isOutdated = existing.searchAddress !== expectedAddress;
      return isOutdated && !processingIds.current.has(processingKey);
    });

    if (invoicesToGeocode.length === 0) return;

    // Mark as processing, keyed by id + expected address so a genuine address
    // change is retried instead of being permanently skipped.
    invoicesToGeocode.forEach(inv => processingIds.current.add(inv.id + '_' + buildPinSearchAddress(inv)));

    // Batch geocoding. Each result is committed to state as soon as it resolves
    // (rather than all at once at the end) so a progress bar can track real,
    // incremental completion instead of jumping straight from 0% to 100%.
    const geocodeInvoices = async () => {
      for (const inv of invoicesToGeocode) {
        const expectedAddress = buildPinSearchAddress(inv);

        try {
          const { results: geoResults } = await new geocodingLib.Geocoder().geocode({
            address: expectedAddress
          });

          if (geoResults && geoResults[0]) {
            const result: GeocodedInvoice = {
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
            };
            setGeocodedInvoices((prev) => [...prev.filter(p => p.id !== result.id), result]);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`Geocoding failed for ${inv.number}:`, err);
        }
      }
    };

    geocodeInvoices();
  }, [geocodingLib, allInvoices, geocodedInvoices, setGeocodedInvoices]);

  // Fit bounds when map or geocodedInvoices loads
  useEffect(() => {
    if (!map) return;

    if (geocodedInvoices.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      geocodedInvoices.forEach((gi) => {
        bounds.extend(gi.position);
      });

      if (warehouse?.warehouseLat && warehouse?.warehouseLng) {
        bounds.extend({ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng });
      }

      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

      // Prevent extreme zoom-in if points are too close or single point
      const limitZoom = () => {
        if (map.getZoom() && map.getZoom()! > 14) {
          map.setZoom(12);
        }
      };
      if (typeof google !== 'undefined' && google.maps?.event) {
        google.maps.event.addListenerOnce(map, 'idle', limitZoom);
      }
    } else if (warehouse?.warehouseLat && warehouse?.warehouseLng) {
      // Loader/fallback to prevent loading zoomed-in exactly on the warehouse point
      map.setCenter({ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng });
      map.setZoom(11);
    } else {
      map.setCenter({ lat: -25.7479, lng: 28.2293 });
      map.setZoom(11);
    }
  }, [map, geocodedInvoices, warehouse]);

  // Progress for the refresh overlay: how many of the currently-known invoices
  // already have a resolved pin, out of the total that need one.
  const geocodedTotal = allInvoices.length;
  const geocodedDone = geocodedInvoices.filter(gi => allInvoices.some(inv => inv.id === gi.id)).length;
  const geocodedPercent = geocodedTotal > 0 ? Math.min(100, Math.round((geocodedDone / geocodedTotal) * 100)) : 0;

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 relative">
        {isRefreshing && (
          <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4 pointer-events-none">
            <div className="w-full max-w-xs bg-white rounded-2xl border border-zinc-200 shadow-xl px-6 py-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-accent/10 rounded-xl border border-brand-accent/20 shrink-0">
                  <Loader2 className="w-4 h-4 text-brand-accent animate-spin" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-zinc-800 leading-tight">Refreshing Map Pins</p>
                  <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                    {geocodedDone} of {geocodedTotal} {geocodedTotal === 1 ? 'invoice' : 'invoices'} geocoded
                  </p>
                </div>
                <span className="ml-auto text-sm font-black font-mono text-brand-primary tabular-nums shrink-0">{geocodedPercent}%</span>
              </div>
              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-accent rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${geocodedPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}
        <Map
          defaultCenter={{ lat: -25.7479, lng: 28.2293 }} // Pretoria/Centurion area
          defaultZoom={11}
          mapId="INVOICE_MAP"
          style={{ width: '100%', height: '100%' }}
          fullscreenControl={false}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          {geocodedInvoices.filter(gi => {
            // ONLY show the pins for invoices that actually exist in the current `invoices` list (filtered active or history!)
            const actualInvoice = invoices.find(inv => inv.id === gi.id);
            if (!actualInvoice) {
              return false;
            }
            const liveStatus = (actualInvoice.status || '').toLowerCase();

            // Explicitly partition map pins between active trips mode and history trips mode
            if (showHistory) {
              if (liveStatus !== 'delivered' && liveStatus !== 'complete' && liveStatus !== 'completed' && liveStatus !== 'invoiced') {
                return false;
              }
            } else {
              if (liveStatus === 'delivered' || liveStatus === 'complete' || liveStatus === 'completed' || liveStatus === 'invoiced') {
                return false;
              }
            }

            // Legend multi-select filter logic
            const statusKey = (liveStatus === 'assembly' ? 'assembled' :
              (liveStatus === 'loaded' ? 'partially_complete' :
                (liveStatus === 'partially complete' ? 'partially_complete' :
                  (liveStatus === 'completed' || liveStatus === 'invoiced' ? 'complete' : liveStatus)))).toLowerCase();

            const isTripStop = Boolean(routedTrip && routedTrip.invoiceIds?.includes(gi.id));
            if (routedTrip) {
              // 1. "Selected trip stop" pins are always shown
              if (isTripStop) return true;

              // 2. Other pins are shown only if their status is explicitly toggled ON in selectedLegendStatuses
              if (!selectedLegendStatuses.includes(statusKey)) return false;
            } else {
              // Standard behavior of the legend multi-select
              if (selectedLegendStatuses.length > 0 && !selectedLegendStatuses.includes(statusKey)) {
                return false;
              }
            }

            // Map Pin Filters bar: keyword search, line item, district and status dropdowns
            if (filters) {
              const searchLower = filters.searchTerm.toLowerCase();
              const matchesSearch = !filters.searchTerm ||
                (actualInvoice.number || '').toLowerCase().includes(searchLower) ||
                (actualInvoice.client || '').toLowerCase().includes(searchLower) ||
                (actualInvoice.district || '').toLowerCase().includes(searchLower);
              if (!matchesSearch) return false;

              const matchesDistrict = filters.selectedDistrict === 'all' ||
                (actualInvoice.district || '').trim().toUpperCase() === filters.selectedDistrict.trim().toUpperCase();
              if (!matchesDistrict) return false;

              const matchesStatus = filters.selectedStatus === 'all' ||
                filters.selectedStatus === statusKey ||
                (filters.selectedStatus === 'complete' && statusKey === 'delivered');
              if (!matchesStatus) return false;

              const lineItemLower = filters.lineItemFilter.toLowerCase();
              const matchesLineItem = !filters.lineItemFilter ||
                (actualInvoice.lineItems || []).some(li =>
                  (li.stockCode || '').toLowerCase().includes(lineItemLower) ||
                  (li.description || '').toLowerCase().includes(lineItemLower)
                );
              if (!matchesLineItem) return false;
            }

            return true;
          }).map((inv) => {
            const actualInvoice = invoices.find(i => i.id === inv.id);
            const liveStatus = actualInvoice?.status || inv.status;
            const liveNumber = actualInvoice?.number || inv.number;
            const liveClient = actualInvoice?.client || inv.client;
            const liveLineItems = actualInvoice?.lineItems || inv.lineItems;
            const liveDistrict = actualInvoice?.district || inv.district;

            const isTripStop = Boolean(routedTrip && routedTrip.invoiceIds?.includes(inv.id));
            const stopNumber = isTripStop && routedTrip ? routedTrip.invoiceIds.indexOf(inv.id) + 1 : undefined;

            return (
              <AdvancedMarker
                key={inv.id}
                position={inv.position}
                onClick={() => onInvoiceClick({
                  ...inv,
                  status: liveStatus,
                  number: liveNumber,
                  client: liveClient,
                  lineItems: liveLineItems,
                  district: liveDistrict
                })}
              >
                <InvoicePin
                  status={liveStatus}
                  number={liveNumber}
                  isHighlighted={highlightedInvoiceIds.includes(inv.id)}
                  isTripStop={isTripStop}
                  stopNumber={stopNumber}
                />
              </AdvancedMarker>
            );
          })}

          {warehouse?.warehouseLat && warehouse?.warehouseLng && (
            <AdvancedMarker
              position={{ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng }}
            >
              <Pin background="#1e1b4b" glyphColor="#fff" borderColor="#312e81" scale={1.5}>
                <Warehouse className="w-4 h-4 text-white" />
              </Pin>
            </AdvancedMarker>
          )}
        </Map>
      </div>

      {/* Dynamic Filter Status Legend under Map */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border-t border-zinc-200 justify-between shrink-0 select-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-zinc-400" />
            Filter Statuses:
          </span>
          {(routedTrip || highlightedInvoiceIds.length > 0) && (
            <div
              className="px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 shadow-sm text-white border-transparent"
              style={{
                backgroundColor: 'green',
                boxShadow: '0 2px 4px #10b98130'
              }}
            >
              <CheckCircle2 className="w-3 h-3 text-white" />
              Selected Trip Stop
            </div>
          )}
          {['partially_complete', 'draft', 'proposed', 'assembled', 'on_route', 'delivered', 'complete']
            .filter(status => {
              if (showHistory) {
                return status === 'delivered' || status === 'complete';
              } else {
                return status !== 'delivered' && status !== 'complete';
              }
            })
            .map(status => {
              const isSelected = routedTrip
                ? selectedLegendStatuses.includes(status)
                : (selectedLegendStatuses.length === 0 || selectedLegendStatuses.includes(status));
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
                      : "bg-white text-zinc-400 border-zinc-200 hover:text-zinc-650 hover:border-zinc-350 opacity-60 hover:opacity-90"
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
