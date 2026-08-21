import { ArrowLeft, PackagePlus, AlertCircle, Loader2, Check, Copy } from 'lucide-react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Settings } from '../../types';
import type { Order } from '../orders/hooks/useOrders';
import type { OrderBuild } from './types';
import { OrderBuilderMap } from './components/OrderBuilderMap';
import { BuildGroupingPanel } from './components/BuildGroupingPanel';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY);

// Mobile build screen - reuses OrderBuilderMap and BuildGroupingPanel directly
// (no forked map/grouping logic), same precedent as TripFormMobile.tsx reusing
// InteractiveTripMap. Just a mobile-appropriate header/layout around them.
export function OrderBuilderScreenMobile({
  editingBuild,
  eligibleOrders,
  selectedOrderIds,
  deliveryDate,
  setDeliveryDate,
  toggleOrder,
  setOrdersForSchool,
  warehouse,
  saving,
  schoolCount,
  onSave,
  onCopy,
  onBack
}: {
  editingBuild: OrderBuild | undefined;
  eligibleOrders: Order[];
  selectedOrderIds: Set<string>;
  deliveryDate: string;
  setDeliveryDate: (v: string) => void;
  toggleOrder: (orderId: string) => void;
  setOrdersForSchool: (orderIdsForSchool: string[], tickedIds: string[]) => void;
  warehouse: Settings | null;
  saving: boolean;
  schoolCount: number;
  onSave: () => void;
  onCopy: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col h-full pb-6 space-y-3">
      <button
        type="button"
        title="Back to Order Builder"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-zinc-400 mobile-tap-target"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Order Builder
      </button>

      <div className="space-y-1">
        <h1 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
          <PackagePlus className="w-5 h-5 text-brand-accent shrink-0" />
          {editingBuild ? `Build #${editingBuild.buildNumber}` : 'New Build'}
        </h1>
        <p className="text-xs text-zinc-500">
          {selectedOrderIds.size} order{selectedOrderIds.size === 1 ? '' : 's'} selected across {schoolCount} school{schoolCount === 1 ? '' : 's'}.
        </p>
      </div>

      <div>
        <label htmlFor="order-build-delivery-date-mobile" className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
          Delivery Date
        </label>
        <input
          id="order-build-delivery-date-mobile"
          type="date"
          title="Delivery date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs mobile-tap-target"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCopy}
          title="Copy build details"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-xs transition-all shadow-2xs mobile-tap-target"
        >
          <Copy className="w-3.5 h-3.5 text-zinc-500" />
          Copy
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          title="Save build"
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs disabled:opacity-60 mobile-tap-target"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save
        </button>
      </div>

      {!hasValidKey ? (
        <div className="p-8 text-center border border-dashed border-zinc-300 rounded-2xl bg-zinc-50">
          <AlertCircle className="w-10 h-10 text-zinc-400 mx-auto mb-3" />
          <h2 className="text-sm font-bold text-zinc-900 mb-1">Google Maps API Key Required</h2>
          <p className="text-xs text-zinc-500">
            Add your Google Maps key as a secret named <code>GOOGLE_MAPS_PLATFORM_KEY</code>.
          </p>
        </div>
      ) : (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
          <div className="h-[280px] w-full rounded-2xl border border-zinc-200 overflow-hidden shadow-lg relative shrink-0">
            <OrderBuilderMap
              orders={eligibleOrders}
              selectedOrderIds={selectedOrderIds}
              onToggleOrder={toggleOrder}
              onSetOrdersForSchool={setOrdersForSchool}
              warehouse={warehouse}
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
