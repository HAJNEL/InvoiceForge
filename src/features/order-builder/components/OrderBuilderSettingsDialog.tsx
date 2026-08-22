import { useState } from 'react';
import { X, Settings, Truck as TruckIcon, AlertTriangle, Plus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { useTrucks, type Truck } from '../../trucks/hooks/useTrucks';

// Order Builder-specific settings. For now this manages which trucks Auto-Build
// is allowed to use (ownership + weight capacity) - deliberately does NOT create
// trucks inline, since Truck.licensePlate is a required, actively-used
// fleet-identification field on the real Trucks form and weakening it app-wide
// just for a quick-add shortcut here was judged not worth the regression risk.
// "+ Add Truck" below hands off to the real /trucks screen instead. Titled
// generically ("Order Builder Settings") rather than "Truck Settings" since more
// configuration sections are expected here later - kept to a single section for
// now rather than pre-building a tabs/sidebar framework nothing else needs yet.
export function OrderBuilderSettingsDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { trucks, loading, updateTruck } = useTrucks();
  const navigate = useNavigate();
  const [savingId, setSavingId] = useState<string | null>(null);

  if (!isOpen) return null;

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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Settings className="w-5 h-5 text-brand-accent shrink-0" />
            <h2 className="text-sm font-bold text-zinc-900">Order Builder Settings</h2>
          </div>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <section className="space-y-3">
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
                        className="flex-1 px-2.5 py-1.5 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
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
                          className="w-full pl-2.5 pr-9 py-1.5 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
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
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-zinc-300 text-zinc-500 hover:text-zinc-700 hover:border-zinc-400 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Truck
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
