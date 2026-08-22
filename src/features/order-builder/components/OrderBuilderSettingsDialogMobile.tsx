import { useState } from 'react';
import { Truck as TruckIcon, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import { useTrucks, type Truck } from '../../trucks/hooks/useTrucks';

// Mobile counterpart to OrderBuilderSettingsDialog.tsx - a bottom sheet instead
// of a centered dialog, same content/behavior (reads/writes the real
// useTrucks(), no inline truck creation - see the desktop version's comment for
// why, "+ Add Truck" hands off to /trucks).
export function OrderBuilderSettingsDialogMobile({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { trucks, loading, updateTruck } = useTrucks();
  const navigate = useNavigate();
  const [savingId, setSavingId] = useState<string | null>(null);

  const handleOwnershipChange = async (truck: Truck, ownership: Truck['ownership']) => {
    setSavingId(truck.id);
    const ok = await updateTruck(truck.id, { ownership });
    setSavingId(null);
    if (!ok) toast.error(`Failed to update ${truck.name}`);
  };

  const handleCapacityChange = async (truck: Truck, value: string) => {
    const capacityKg = value.trim() === '' ? undefined : Math.max(0, parseFloat(value) || 0);
    setSavingId(truck.id);
    const ok = await updateTruck(truck.id, { capacityKg });
    setSavingId(null);
    if (!ok) toast.error(`Failed to update ${truck.name}`);
  };

  const handleAddTruck = () => {
    onClose();
    navigate('/trucks');
  };

  return (
    <MobileSheet isOpen={isOpen} onClose={onClose} title="Order Builder Settings" fullHeight={false}>
      <div className="space-y-3">
        <div>
          <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wide flex items-center gap-1.5">
            <TruckIcon className="w-3.5 h-3.5 text-zinc-400" />
            Trucks
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Only client trucks with a weight limit are usable in Auto-Build.
          </p>
        </div>

        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
          </div>
        ) : trucks.length === 0 ? (
          <div className="py-6 text-center text-sm text-zinc-400 border border-dashed border-zinc-200 rounded-xl">
            No trucks yet.
          </div>
        ) : (
          <div className="space-y-2">
            {trucks.map(truck => (
              <div key={truck.id} className="p-3 rounded-xl border border-zinc-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-zinc-850 truncate">{truck.name}</p>
                  {savingId === truck.id && <Loader2 className="w-3.5 h-3.5 text-zinc-400 animate-spin shrink-0" />}
                </div>
                <div className="flex items-center gap-2">
                  <select
                    title={`Ownership for ${truck.name}`}
                    value={truck.ownership}
                    onChange={(e) => handleOwnershipChange(truck, e.target.value as Truck['ownership'])}
                    className="flex-1 px-2.5 py-2 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/20 mobile-tap-target"
                  >
                    <option value="client">Client</option>
                    <option value="personal">Personal</option>
                  </select>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      title={`Weight limit for ${truck.name}`}
                      placeholder="Weight limit"
                      defaultValue={truck.capacityKg ?? ''}
                      onBlur={(e) => handleCapacityChange(truck, e.target.value)}
                      className="w-full pl-2.5 pr-9 py-2 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/20 mobile-tap-target"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">kg</span>
                  </div>
                </div>
                {truck.ownership === 'client' && !truck.capacityKg && (
                  <p className={cn('flex items-center gap-1 text-[10px] font-semibold text-amber-600')}>
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    No weight limit set — this truck can&apos;t be used for Auto-Build yet.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          title="Add a new truck"
          onClick={handleAddTruck}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-zinc-300 text-zinc-500 text-xs font-bold uppercase tracking-wide transition-all mobile-tap-target"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Truck
        </button>
      </div>
    </MobileSheet>
  );
}
