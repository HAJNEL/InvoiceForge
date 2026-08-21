import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PackagePlus, AlertCircle } from 'lucide-react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { useOrders } from '../orders/hooks/useOrders';
import { useOrderBuilds } from './hooks/useOrderBuilds';
import { useSettings } from '../settings/hooks/useSettings';
import { schoolKeyFor } from '../../lib/geocoding';
import { OrderBuilderMap } from './components/OrderBuilderMap';
import { BuildGroupingPanel } from './components/BuildGroupingPanel';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY);

// Full-screen build view: map (per-school pins) + delivery date + Save, with the
// order-grouping/consolidation panel slotting in below the map.
// selectedOrderIds/deliveryDate are lifted here (not trapped in the map) so that
// later panel can consume the same state without a rewrite.
export function OrderBuilderScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders } = useOrders();
  const { builds } = useOrderBuilds();
  const { settings } = useSettings();

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [deliveryDate, setDeliveryDate] = useState('');
  const initializedRef = useRef(false);

  const editingBuild = id ? builds.find(b => b.id === id) : undefined;

  // Initialize from the existing build exactly once, as soon as it's available -
  // not on every builds-list update (that would stomp on in-progress edits).
  useEffect(() => {
    if (!id || initializedRef.current || !editingBuild) return;
    initializedRef.current = true;
    setSelectedOrderIds(new Set(editingBuild.schoolGroups.flatMap(g => g.orderIds)));
    setDeliveryDate(editingBuild.deliveryDate);
  }, [id, editingBuild]);

  // Eligible orders: Active, and either unconsumed or already consumed by THIS
  // build (so re-opening an existing build still shows its own orders as pinned).
  const eligibleOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.status !== 'Active') return false;
      if (!o.buildId) return true;
      return id ? o.buildId === id : false;
    });
  }, [orders, id]);

  const toggleOrder = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const setOrdersForSchool = (orderIdsForSchool: string[], tickedIds: string[]) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      orderIdsForSchool.forEach(oid => next.delete(oid));
      tickedIds.forEach(oid => next.add(oid));
      return next;
    });
  };

  const handleBack = () => {
    if (selectedOrderIds.size > 0 && !window.confirm('Discard this in-progress build? Any orders you selected will be lost.')) {
      return;
    }
    navigate('/order-builder');
  };

  const schoolCount = useMemo(() => {
    const keys = new Set(eligibleOrders.filter(o => selectedOrderIds.has(o.id)).map(o => schoolKeyFor(o.schoolName)));
    return keys.size;
  }, [eligibleOrders, selectedOrderIds]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs mb-6 shrink-0">
        <div>
          <button
            type="button"
            title="Back to Order Builder"
            onClick={handleBack}
            className="group flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-brand-primary transition-all mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Order Builder
          </button>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-brand-accent shrink-0" />
            {editingBuild ? `Build #${editingBuild.buildNumber}` : 'New Build'}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            {selectedOrderIds.size} order{selectedOrderIds.size === 1 ? '' : 's'} selected across {schoolCount} school{schoolCount === 1 ? '' : 's'}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label htmlFor="order-build-delivery-date" className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
              Delivery Date
            </label>
            <input
              id="order-build-delivery-date"
              type="date"
              title="Delivery date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs"
            />
          </div>
          <button
            type="button"
            disabled
            title="Coming soon"
            className="px-5 py-2.5 bg-zinc-200 text-zinc-400 font-semibold text-sm rounded-xl cursor-not-allowed self-end"
          >
            Save Build
          </button>
        </div>
      </div>

      {!hasValidKey ? (
        <div className="flex-1 flex items-center justify-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-300">
          <div className="text-center max-w-md p-8">
            <AlertCircle className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Google Maps API Key Required</h2>
            <p className="text-zinc-500 mb-6">
              To use the Order Builder map, add your Google Maps key as a secret named <code>GOOGLE_MAPS_PLATFORM_KEY</code>.
            </p>
          </div>
        </div>
      ) : (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
          <div className="h-[420px] w-full rounded-3xl border border-zinc-200 overflow-hidden shadow-lg relative shrink-0">
            <OrderBuilderMap
              orders={eligibleOrders}
              selectedOrderIds={selectedOrderIds}
              onToggleOrder={toggleOrder}
              onSetOrdersForSchool={setOrdersForSchool}
              warehouse={settings}
            />
          </div>
        </APIProvider>
      )}

      <BuildGroupingPanel
        orders={eligibleOrders}
        selectedOrderIds={selectedOrderIds}
        onRemoveOrder={toggleOrder}
      />
    </div>
  );
}
