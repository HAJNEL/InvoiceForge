import { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PackagePlus, AlertCircle, Loader2, Check, Copy, Zap } from 'lucide-react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { toast } from 'sonner';
import { useAuth } from '../../core/hooks/useAuth';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useOrders } from '../orders/hooks/useOrders';
import { useOrderBuilds, createBuild, updateBuild } from './hooks/useOrderBuilds';
import { useSettings } from '../settings/hooks/useSettings';
import { schoolKeyFor } from '../../lib/geocoding';
import { OrderBuilderMap } from './components/OrderBuilderMap';
import { BuildGroupingPanel } from './components/BuildGroupingPanel';
import { AutoBuildFlow } from './components/AutoBuildFlow';
import { OrderBuilderScreenMobile } from './OrderBuilderScreenMobile';
import { buildSchoolGroups, formatBuildAsText } from './utils';
import { orderIdsInOption, truckIdByOrderId, type AutoBuildOption } from './lib/autoBuild';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY);

// Fixed palette for truck-grouping badges/headers when an Auto-Build option is
// applied - cycles if a chosen option somehow used more trucks than colors,
// which in practice won't happen given realistic truck-selection counts.
const TRUCK_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

// Full-screen build view: map (per-school pins) + delivery date + Save, with the
// order-grouping/consolidation panel slotting in below the map.
// selectedOrderIds/deliveryDate are lifted here (not trapped in the map) so that
// later panel can consume the same state without a rewrite.
export function OrderBuilderScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders } = useOrders();
  const { builds } = useOrderBuilds();
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [deliveryDate, setDeliveryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [isAutoBuildOpen, setIsAutoBuildOpen] = useState(false);
  const [appliedAutoBuild, setAppliedAutoBuild] = useState<AutoBuildOption | null>(null);
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

  // A manual edit after applying an Auto-Build option clears the truck
  // assignment rather than trying to keep it consistent under arbitrary
  // hand-edits - Save then falls back to the normal single-build path.
  const toggleOrder = (orderId: string) => {
    setAppliedAutoBuild(null);
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const setOrdersForSchool = (orderIdsForSchool: string[], tickedIds: string[]) => {
    setAppliedAutoBuild(null);
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      orderIdsForSchool.forEach(oid => next.delete(oid));
      tickedIds.forEach(oid => next.add(oid));
      return next;
    });
  };

  // Applies a chosen Auto-Build option "as if built manually" - sets the same
  // selectedOrderIds state the map/panel already react to, and remembers the
  // option so the truck-grouping layer and batch save (below) can use it.
  const handleApplyAutoBuild = (option: AutoBuildOption) => {
    setSelectedOrderIds(orderIdsInOption(option));
    setAppliedAutoBuild(option);
  };

  // Per-school truck badge/header lookup for the map and grouping panel, built
  // from the applied option's per-order truck assignments plus a fixed color
  // per truck. Undefined (no truck-grouping layer) when no option is applied.
  const truckBySchoolKey = useMemo(() => {
    if (!appliedAutoBuild) return undefined;
    const byOrderId = truckIdByOrderId(appliedAutoBuild);
    const colorByTruckId: Record<string, string> = {};
    appliedAutoBuild.truckAssignments.forEach((ta, i) => {
      colorByTruckId[ta.truckId] = TRUCK_COLORS[i % TRUCK_COLORS.length];
    });
    const result: Record<string, { truckId: string; truckName: string; color: string }> = {};
    eligibleOrders.forEach(o => {
      const assignment = byOrderId[o.id];
      if (assignment) {
        result[schoolKeyFor(o.schoolName)] = { ...assignment, color: colorByTruckId[assignment.truckId] };
      }
    });
    return result;
  }, [appliedAutoBuild, eligibleOrders]);

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

  const handleSave = async () => {
    if (!user) return;
    if (!deliveryDate) {
      toast.error('Set a delivery date before saving.');
      return;
    }

    // Applied Auto-Build option, still intact (no manual edit since): batch-save
    // one build per truck, all sharing this one delivery date, each recording
    // which truck it was planned for.
    if (appliedAutoBuild) {
      setSaving(true);
      const results = await Promise.all(
        appliedAutoBuild.truckAssignments.map(async (ta) => {
          try {
            const created = await createBuild(user.uid, deliveryDate, ta.schoolGroups, { id: ta.truckId, name: ta.truckName });
            return { truckName: ta.truckName, success: true as const, buildNumber: created.buildNumber };
          } catch (err) {
            return { truckName: ta.truckName, success: false as const, error: err instanceof Error ? err.message : String(err) };
          }
        })
      );
      setSaving(false);

      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (failed.length === 0) {
        toast.success(`Saved ${succeeded.length} build${succeeded.length === 1 ? '' : 's'}`, {
          description: succeeded.map(r => `${r.truckName}: Build #${r.success ? r.buildNumber : ''}`).join(', ')
        });
        navigate('/order-builder');
      } else if (succeeded.length > 0) {
        // Partial success: the succeeded builds are already real Firestore docs -
        // don't hide that. Surface exactly what failed so the user can retry that
        // truck manually (e.g. via the normal single-build flow).
        toast.error(`${succeeded.length} of ${results.length} builds saved - ${failed.length} failed`, {
          description: failed.map(r => `${r.truckName}: ${r.success ? '' : r.error}`).join('; ')
        });
        navigate('/order-builder');
      } else {
        toast.error('Failed to save any builds', {
          description: failed.map(r => (r.success ? '' : `${r.truckName}: ${r.error}`)).join('; ')
        });
      }
      return;
    }

    const groups = buildSchoolGroups(eligibleOrders, selectedOrderIds);
    if (groups.length === 0) {
      toast.error('Add at least one order before saving.');
      return;
    }

    setSaving(true);
    try {
      if (editingBuild) {
        await updateBuild(editingBuild, deliveryDate, groups);
        toast.success(`Build #${editingBuild.buildNumber} updated`);
      } else {
        const created = await createBuild(user.uid, deliveryDate, groups);
        toast.success(`Build #${created.buildNumber} saved`);
      }
      navigate('/order-builder');
    } catch (err) {
      // Keep the user on the screen with their in-progress work intact - a failed
      // save must never navigate away or clear state.
      toast.error('Failed to save build', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  // Preview copy of the in-progress build, before it's saved - never calls
  // getNextBuildNumber() just to fill in a real number for a copy action that
  // might never be saved (that would needlessly burn a sequence number).
  const handleCopy = async () => {
    const groups = buildSchoolGroups(eligibleOrders, selectedOrderIds);
    const text = formatBuildAsText({
      buildNumber: editingBuild?.buildNumber ?? '(unsaved)',
      deliveryDate,
      schoolGroups: groups
    });
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Build details copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy build details', { description: err instanceof Error ? err.message : String(err) });
    }
  };

  if (isMobile) {
    return (
      <OrderBuilderScreenMobile
        editingBuild={editingBuild}
        eligibleOrders={eligibleOrders}
        selectedOrderIds={selectedOrderIds}
        deliveryDate={deliveryDate}
        setDeliveryDate={setDeliveryDate}
        toggleOrder={toggleOrder}
        setOrdersForSchool={setOrdersForSchool}
        warehouse={settings}
        saving={saving}
        schoolCount={schoolCount}
        onSave={handleSave}
        onCopy={handleCopy}
        onBack={handleBack}
      />
    );
  }

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
            onClick={() => setIsAutoBuildOpen(true)}
            disabled={!hasValidKey}
            title={hasValidKey ? 'Auto-build from available orders' : 'Requires the Google Maps API key (see below)'}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-semibold text-sm transition-all shadow-2xs cursor-pointer self-end disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4 text-zinc-500" />
            Auto-Build
          </button>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy build details"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-semibold text-sm transition-all shadow-2xs cursor-pointer self-end"
          >
            <Copy className="w-4 h-4 text-zinc-500" />
            Copy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            title="Save build"
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs disabled:opacity-60 cursor-pointer self-end"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Build
          </button>
          {appliedAutoBuild && (
            <p className="w-full text-[10px] text-amber-600 font-semibold basis-full text-right">
              Editing orders after Auto-Build clears the truck assignment — this will save as one build instead of per-truck.
            </p>
          )}
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
              truckBySchoolKey={truckBySchoolKey}
            />
          </div>

          {/* Rendered inside APIProvider so it can resolve useMapsLibrary('routes') */}
          <AutoBuildFlow
            isOpen={isAutoBuildOpen}
            onClose={() => setIsAutoBuildOpen(false)}
            eligibleOrders={eligibleOrders}
            warehouse={settings?.warehouseLat && settings?.warehouseLng ? { lat: settings.warehouseLat, lng: settings.warehouseLng } : null}
            onApply={handleApplyAutoBuild}
          />
        </APIProvider>
      )}

      <BuildGroupingPanel
        orders={eligibleOrders}
        selectedOrderIds={selectedOrderIds}
        onRemoveOrder={toggleOrder}
        truckBySchoolKey={truckBySchoolKey}
      />
    </div>
  );
}
