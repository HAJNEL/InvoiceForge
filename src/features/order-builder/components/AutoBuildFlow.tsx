import { useState } from 'react';
import { X, Zap, Loader2, Truck as TruckIcon, AlertTriangle, Check, ArrowLeft, School, Package, Weight, Route, Clock, Banknote } from 'lucide-react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../../../lib/utils';
import { useTrucks } from '../../trucks/hooks/useTrucks';
import { useStockLookups } from '../hooks/useStockLookups';
import { clientTrucks } from '../utils';
import { loadCachedSchoolPins } from '../../../lib/geocoding';
import { generateAutoBuildOptions, type AutoBuildOption, type AutoBuildTruckInput } from '../lib/autoBuild';
import type { Order } from '../../orders/hooks/useOrders';

function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

// Auto-Build: tick 1+ client trucks, generate up to 5 ranked build options, apply
// one onto the build screen's existing selection (as if built manually). Doesn't
// replace manual pin-clicking - this is an additional, optional path to the same
// selectedOrderIds state the map already writes to.
export function AutoBuildFlow({
  isOpen,
  onClose,
  eligibleOrders,
  warehouse,
  onApply
}: {
  isOpen: boolean;
  onClose: () => void;
  eligibleOrders: Order[];
  warehouse: { lat: number; lng: number } | null;
  onApply: (option: AutoBuildOption) => void;
}) {
  const { trucks } = useTrucks();
  const { weightByStockCode, unitPriceByStockCode } = useStockLookups();
  const routesLib = useMapsLibrary('routes');

  const [tickedTruckIds, setTickedTruckIds] = useState<Set<string>>(new Set());
  const [step, setStep] = useState<'pick-trucks' | 'options'>('pick-trucks');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<AutoBuildOption[]>([]);

  if (!isOpen) return null;

  const usableTrucks = clientTrucks(trucks);

  const toggleTruck = (id: string) => {
    setTickedTruckIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setStep('pick-trucks');
    setTickedTruckIds(new Set());
    setOptions([]);
    onClose();
  };

  const handleGenerate = async () => {
    if (!warehouse) {
      toast.error('Set a warehouse address in Settings first.');
      return;
    }
    if (!routesLib) {
      toast.error('Google Maps is still loading. Try again in a moment.');
      return;
    }

    const tickedTrucks: AutoBuildTruckInput[] = usableTrucks
      .filter(t => tickedTruckIds.has(t.id) && typeof t.capacityKg === 'number')
      .map(t => ({ id: t.id, name: t.name, capacityKg: t.capacityKg as number }));

    if (tickedTrucks.length === 0) {
      toast.error('Tick at least one truck with a weight limit set.');
      return;
    }

    const schoolPositions: Record<string, { lat: number; lng: number }> = {};
    loadCachedSchoolPins().forEach(pin => {
      schoolPositions[pin.schoolKey] = pin.position;
    });

    setLoading(true);
    try {
      const directionsService = new routesLib.DirectionsService();
      const result = await generateAutoBuildOptions({
        eligibleOrders,
        trucks: tickedTrucks,
        warehouse,
        schoolPositions,
        weightByStockCode,
        unitPriceByStockCode,
        directionsService
      });
      setOptions(result);
      setStep('options');
      if (result.length === 0) {
        toast.error('No build options found - no eligible orders near enough to each other for these trucks.');
      }
    } catch (err) {
      toast.error('Failed to generate build options', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleUseOption = (option: AutoBuildOption) => {
    onApply(option);
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {step === 'options' && (
              <button
                type="button"
                title="Back to truck selection"
                onClick={() => setStep('pick-trucks')}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <Zap className="w-5 h-5 text-brand-accent shrink-0" />
            <h2 className="text-sm font-bold text-zinc-900">
              {step === 'pick-trucks' ? 'Auto-Build: Choose Trucks' : 'Auto-Build: Choose a Plan'}
            </h2>
          </div>
          <button
            type="button"
            title="Close"
            onClick={handleClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-3">
          {step === 'pick-trucks' ? (
            usableTrucks.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-400">
                No client trucks yet — add one via the gear icon settings first.
              </div>
            ) : (
              usableTrucks.map(truck => {
                const hasCapacity = typeof truck.capacityKg === 'number' && truck.capacityKg > 0;
                return (
                  <label
                    key={truck.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                      !hasCapacity ? 'opacity-50 cursor-not-allowed border-zinc-200' :
                        tickedTruckIds.has(truck.id) ? 'border-brand-accent bg-brand-accent/5' : 'border-zinc-200 hover:bg-zinc-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      title={`Include ${truck.name}`}
                      checked={tickedTruckIds.has(truck.id)}
                      disabled={!hasCapacity}
                      onChange={() => toggleTruck(truck.id)}
                      className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30"
                    />
                    <TruckIcon className="w-4 h-4 text-zinc-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-zinc-850">{truck.name}</p>
                      {!hasCapacity && (
                        <p className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          Set a weight limit in Order Builder Settings to use this truck
                        </p>
                      )}
                    </div>
                    {hasCapacity && (
                      <span className="text-xs font-mono text-zinc-500 shrink-0">{truck.capacityKg} kg</span>
                    )}
                  </label>
                );
              })
            )
          ) : options.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-400">
              No build options found for these trucks and available orders.
            </div>
          ) : (
            options.map(option => (
              <div key={option.strategyId} className="p-4 rounded-xl border border-zinc-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-zinc-900">{option.label}</h3>
                  <button
                    type="button"
                    title={`Use "${option.label}"`}
                    onClick={() => handleUseOption(option)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-brand-accent hover:bg-brand-accent/95 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Use this option
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <School className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    {option.totalSchools} school{option.totalSchools === 1 ? '' : 's'}
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <Package className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    {option.totalOrders} order{option.totalOrders === 1 ? '' : 's'}
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <TruckIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    {option.totalTrucksUsed} truck{option.totalTrucksUsed === 1 ? '' : 's'}
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <Route className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    {formatDistance(option.totalEstimatedDistanceMeters)}
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    {formatDuration(option.totalEstimatedTravelTimeSeconds)}
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <Banknote className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    R{formatCurrency(option.totalValueRand)}
                  </div>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-zinc-100">
                  {option.truckAssignments.map(ta => (
                    <div key={ta.truckId} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-zinc-700 flex items-center gap-1">
                        <Weight className="w-3 h-3 text-zinc-400" />
                        {ta.truckName}
                      </span>
                      <span className="font-mono text-zinc-500">
                        {ta.totalWeightKg.toFixed(0)}/{ta.capacityKg} kg ({ta.weightUtilizationPct.toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {step === 'pick-trucks' && (
          <div className="px-5 py-4 border-t border-zinc-200 shrink-0 flex justify-end">
            <button
              type="button"
              title="Generate build options"
              onClick={handleGenerate}
              disabled={loading || tickedTruckIds.size === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 transition-all shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? 'Generating…' : 'Generate Options'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
