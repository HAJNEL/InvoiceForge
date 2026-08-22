/// <reference types="google.maps" />
import { useState, useEffect, useRef, useMemo } from 'react';
import { Warehouse, Loader2 } from 'lucide-react';
import { Map, AdvancedMarker, Pin, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';
import { cn } from '../../../lib/utils';
import { Settings } from '../../../types';
import { useIsMobile } from '../../../hooks/useIsMobile';
import type { Order } from '../../orders/hooks/useOrders';
import {
  buildOrderSearchAddress,
  schoolKeyFor,
  loadCachedSchoolPins,
  upsertCachedSchoolPin,
  type CachedSchoolPin
} from '../../../lib/geocoding';
import { SchoolOrdersSelectModal } from './SchoolOrdersSelectModal';
import { SchoolOrdersSelectModalMobile } from './SchoolOrdersSelectModalMobile';

interface SchoolPinGroup {
  schoolKey: string;
  schoolName: string;
  orders: Order[];
}

// One map pin per unique school (not per order) - many Order docs can share a
// school, and geocoding/rendering per-order would be both wasteful and wrong for
// the "click a pin, pick which of this school's orders to include" flow.
function SchoolPinMarker({
  group,
  position,
  selectedCount,
  onClick,
  truckBadge
}: {
  group: SchoolPinGroup;
  position: { lat: number; lng: number };
  selectedCount: number;
  onClick: () => void;
  truckBadge?: { truckName: string; color: string };
}) {
  const total = group.orders.length;
  const state = selectedCount === 0 ? 'none' : selectedCount === total ? 'full' : 'partial';

  const background = state === 'full' ? '#16a34a' : state === 'partial' ? '#f59e0b' : '#3f3f46';
  const borderColor = state === 'full' ? '#166534' : state === 'partial' ? '#b45309' : '#18181b';

  return (
    <AdvancedMarker position={position} onClick={onClick}>
      <div
        className={cn(
          'cursor-pointer group relative transition-transform duration-300',
          state !== 'none' ? 'scale-110 z-20' : 'hover:scale-110 z-10'
        )}
        title={`${group.schoolName} (${selectedCount}/${total} order${total === 1 ? '' : 's'} selected — click to ${total > 1 ? 'choose orders' : 'toggle'})${truckBadge ? ` — ${truckBadge.truckName}` : ''}`}
      >
        <Pin background={background} glyphColor="#fff" borderColor={borderColor} scale={state === 'none' ? 1.1 : 1.3}>
          <span className="text-[10px] font-black leading-none text-white font-mono shrink-0">
            {total > 1 ? `${selectedCount}/${total}` : (state === 'full' ? '✓' : '')}
          </span>
        </Pin>
        {truckBadge && (
          <span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm z-30"
            style={{ backgroundColor: truckBadge.color }}
          />
        )}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-zinc-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
          {group.schoolName} ({selectedCount}/{total}){truckBadge ? ` · ${truckBadge.truckName}` : ''}
        </div>
      </div>
    </AdvancedMarker>
  );
}

export function OrderBuilderMap({
  orders,
  selectedOrderIds,
  onToggleOrder,
  onSetOrdersForSchool,
  warehouse,
  truckBySchoolKey
}: {
  orders: Order[];
  selectedOrderIds: Set<string>;
  onToggleOrder: (orderId: string) => void;
  onSetOrdersForSchool: (orderIdsForSchool: string[], tickedIds: string[]) => void;
  warehouse: Settings | null;
  // Set while an Auto-Build option is applied (see AutoBuildFlow.tsx) - badges
  // each pin with the truck its school was assigned to. Undefined for the normal
  // manual-build case, which renders exactly as before this prop existed.
  truckBySchoolKey?: Record<string, { truckName: string; color: string }>;
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const isMobile = useIsMobile();
  const processingKeys = useRef<Set<string>>(new Set());
  const lastFitSignatureRef = useRef<string>('');
  const [hasFitted, setHasFitted] = useState(false);
  const [schoolPins, setSchoolPins] = useState<CachedSchoolPin[]>(() => loadCachedSchoolPins());
  const [activeModalSchool, setActiveModalSchool] = useState<SchoolPinGroup | null>(null);

  // Group eligible orders by school key - exactly one pin per unique school.
  // (A plain record, not the JS `Map` type, since `Map` here refers to the
  // @vis.gl map component imported above.)
  const schoolGroups = useMemo<SchoolPinGroup[]>(() => {
    const groups: Record<string, SchoolPinGroup> = {};
    for (const order of orders) {
      const key = schoolKeyFor(order.schoolName);
      const existing = groups[key];
      if (existing) {
        existing.orders.push(order);
      } else {
        groups[key] = { schoolKey: key, schoolName: order.schoolName, orders: [order] };
      }
    }
    return Object.values(groups);
  }, [orders]);

  // Geocode any school whose cached pin is missing or stale (search address no
  // longer matches what we'd search today - e.g. the school name changed).
  useEffect(() => {
    if (!geocodingLib) return;

    const toGeocode = schoolGroups.filter(g => {
      const expected = buildOrderSearchAddress(g.schoolName);
      if (!expected) return false;
      const cacheKey = `${g.schoolKey}_${expected}`;
      if (processingKeys.current.has(cacheKey)) return false;
      const existing = schoolPins.find(p => p.schoolKey === g.schoolKey);
      return !existing || existing.searchAddress !== expected;
    });

    if (toGeocode.length === 0) return;

    toGeocode.forEach(g => {
      const expected = buildOrderSearchAddress(g.schoolName);
      if (expected) processingKeys.current.add(`${g.schoolKey}_${expected}`);
    });

    const run = async () => {
      for (const g of toGeocode) {
        const expected = buildOrderSearchAddress(g.schoolName);
        if (!expected) continue;
        try {
          const { results } = await new geocodingLib.Geocoder().geocode({ address: expected });
          if (results && results[0]) {
            const pin: CachedSchoolPin = {
              schoolKey: g.schoolKey,
              schoolName: g.schoolName,
              searchAddress: expected,
              address: results[0].formatted_address,
              position: {
                lat: results[0].geometry.location.lat(),
                lng: results[0].geometry.location.lng()
              }
            };
            upsertCachedSchoolPin(pin);
            setSchoolPins(prev => [...prev.filter(p => p.schoolKey !== g.schoolKey), pin]);
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`Geocoding failed for school ${g.schoolName}:`, err);
        }
      }
    };

    run();
  }, [geocodingLib, schoolGroups, schoolPins]);

  // Auto-fit bounds to all resolved pins, only re-fitting when the pin set actually
  // changes (not on every selection toggle) - same signature-comparison technique
  // as InteractiveTripMap.tsx.
  useEffect(() => {
    if (!map) return;

    const renderable = schoolGroups
      .map(g => ({ group: g, pin: schoolPins.find(p => p.schoolKey === g.schoolKey) }))
      .filter((x): x is { group: SchoolPinGroup; pin: CachedSchoolPin } => Boolean(x.pin));

    const signature =
      renderable.map(x => `${x.group.schoolKey}:${x.pin.position.lat.toFixed(5)},${x.pin.position.lng.toFixed(5)}`).sort().join('|') +
      `|wh:${warehouse?.warehouseLat ?? ''},${warehouse?.warehouseLng ?? ''}`;

    if (signature === lastFitSignatureRef.current) return;
    lastFitSignatureRef.current = signature;

    if (renderable.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      renderable.forEach(x => bounds.extend(x.pin.position));
      if (warehouse?.warehouseLat && warehouse?.warehouseLng) {
        bounds.extend({ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng });
      }
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

      const onIdle = () => {
        if (map.getZoom() && map.getZoom()! > 14) map.setZoom(12);
        setHasFitted(true);
      };
      if (typeof google !== 'undefined' && google.maps?.event) {
        google.maps.event.addListenerOnce(map, 'idle', onIdle);
      } else {
        setHasFitted(true);
      }
    } else if (warehouse?.warehouseLat && warehouse?.warehouseLng) {
      map.setCenter({ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng });
      map.setZoom(11);
    } else {
      map.setCenter({ lat: -25.7479, lng: 28.2293 });
      map.setZoom(11);
    }
  }, [map, schoolGroups, schoolPins, warehouse]);

  // Safety net: never keep the map hidden indefinitely.
  useEffect(() => {
    const t = window.setTimeout(() => setHasFitted(true), 3000);
    return () => window.clearTimeout(t);
  }, []);

  const selectedCountFor = (group: SchoolPinGroup) => group.orders.filter(o => selectedOrderIds.has(o.id)).length;

  const handlePinClick = (group: SchoolPinGroup) => {
    if (group.orders.length === 1) {
      onToggleOrder(group.orders[0].id);
      return;
    }
    setActiveModalSchool(group);
  };

  return (
    <div className="flex flex-col h-full w-full relative">
      <Map
        defaultCenter={{ lat: -25.7479, lng: 28.2293 }}
        defaultZoom={11}
        mapId="ORDER_BUILDER_MAP"
        style={{ width: '100%', height: '100%' }}
        disableDoubleClickZoom={true}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
      >
        {schoolGroups.map(group => {
          const pin = schoolPins.find(p => p.schoolKey === group.schoolKey);
          if (!pin) return null;
          return (
            <SchoolPinMarker
              key={group.schoolKey}
              group={group}
              position={pin.position}
              selectedCount={selectedCountFor(group)}
              onClick={() => handlePinClick(group)}
              truckBadge={truckBySchoolKey?.[group.schoolKey]}
            />
          );
        })}

        {warehouse?.warehouseLat && warehouse?.warehouseLng && (
          <AdvancedMarker key="warehouse-center-marker" position={{ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng }}>
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

      {!hasFitted && (
        <div className="absolute inset-0 z-[5] flex items-center justify-center bg-zinc-100">
          <div className="flex flex-col items-center gap-2 text-zinc-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">Loading Map…</span>
          </div>
        </div>
      )}

      {activeModalSchool && (
        isMobile ? (
          <SchoolOrdersSelectModalMobile
            isOpen={true}
            schoolName={activeModalSchool.schoolName}
            orders={activeModalSchool.orders}
            selectedOrderIds={selectedOrderIds}
            onConfirm={(tickedIds) => {
              onSetOrdersForSchool(activeModalSchool.orders.map(o => o.id), tickedIds);
              setActiveModalSchool(null);
            }}
            onClose={() => setActiveModalSchool(null)}
          />
        ) : (
          <SchoolOrdersSelectModal
            isOpen={true}
            schoolName={activeModalSchool.schoolName}
            orders={activeModalSchool.orders}
            selectedOrderIds={selectedOrderIds}
            onConfirm={(tickedIds) => {
              onSetOrdersForSchool(activeModalSchool.orders.map(o => o.id), tickedIds);
              setActiveModalSchool(null);
            }}
            onClose={() => setActiveModalSchool(null)}
          />
        )
      )}
    </div>
  );
}
