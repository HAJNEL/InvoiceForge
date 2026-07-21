import { useState } from 'react';
import { Fuel, Loader2, Inbox, Edit3, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFuelLogs, FuelLog } from '../hooks/useFuelLogs';
import { Truck } from '../../trucks/hooks/useTrucks';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import { MobileCard, MobileCardActionsMenu } from '../../../components/mobile/MobileCard';

export function FuelLogModalMobile({ trucks, onClose }: {
  trucks: Truck[];
  onClose: () => void;
}) {
  const { fuelLogs, loading, addFuelLog, updateFuelLog, deleteFuelLog, totalLitersConsumed } = useFuelLogs();

  const [truckId, setTruckId] = useState(trucks[0]?.id || '');
  const [liters, setLiters] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');
  const [odometerReading, setOdometerReading] = useState('');
  const [refuelDate, setRefuelDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isValid = truckId && liters && fuelPrice && odometerReading && refuelDate
    && Number(liters) > 0 && Number(fuelPrice) > 0 && Number(odometerReading) >= 0;

  const resetForm = () => {
    setTruckId(trucks[0]?.id || '');
    setLiters('');
    setFuelPrice('');
    setOdometerReading('');
    setRefuelDate(new Date().toISOString().slice(0, 10));
  };

  const startEdit = (log: FuelLog) => {
    setEditingId(log.id);
    setTruckId(log.truckId);
    setLiters(String(log.liters));
    setFuelPrice(String(log.fuelPrice));
    setOdometerReading(String(log.odometerReading));
    setRefuelDate(log.refuelDate);
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const payload = {
        truckId,
        liters: Number(liters),
        cost: Number(liters) * Number(fuelPrice),
        fuelPrice: Number(fuelPrice),
        odometerReading: Number(odometerReading),
        refuelDate,
      };
      const ok = editingId ? await updateFuelLog(editingId, payload) : await addFuelLog(payload);
      if (ok) {
        toast.success(editingId ? 'Fuel log updated' : 'Fuel log saved');
        setEditingId(null);
        resetForm();
      }
    } catch (err) {
      console.error('Failed to save fuel log:', err);
      toast.error('Could not save fuel log');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      const ok = await deleteFuelLog(id);
      if (ok && editingId === id) cancelEdit();
    } finally {
      setBusyId(null);
    }
  };

  const getTruckLabel = (id: string) => {
    const truck = trucks.find(t => t.id === id);
    return truck ? `${truck.name} (${truck.licensePlate})` : 'Unknown truck';
  };

  return (
    <MobileSheet
      isOpen
      onClose={onClose}
      title="Fuel Log"
      subtitle={`${totalLitersConsumed.toFixed(1)} L consumed total`}
      headerLeft={
        <div className="p-2 bg-orange-50 rounded-xl border border-orange-200 shrink-0">
          <Fuel className="w-4 h-4 text-orange-600" />
        </div>
      }
    >
      <div className="space-y-5">
        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Truck</span>
            <select
              title="Select the truck this refuel is for"
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            >
              <option value="" disabled>Select a truck</option>
              {trucks.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.licensePlate})</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Refuel Date</span>
            <input
              type="date"
              title="Date this refuel took place"
              value={refuelDate}
              onChange={(e) => setRefuelDate(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Odometer Reading</span>
            <input
              type="number"
              min="0"
              step="1"
              title="Current odometer reading, in km"
              placeholder="0"
              value={odometerReading}
              onChange={(e) => setOdometerReading(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Liters</span>
            <input
              type="number"
              min="0"
              step="0.01"
              title="Liters of fuel added"
              placeholder="0.00"
              value={liters}
              onChange={(e) => setLiters(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fuel Price (per L)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              title="Price per liter of fuel"
              placeholder="0.00"
              value={fuelPrice}
              onChange={(e) => setFuelPrice(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </label>
        </div>

        <div className="flex items-center gap-2">
          {editingId && (
            <button
              type="button"
              title="Cancel editing"
              onClick={cancelEdit}
              className="px-4 py-2.5 text-xs font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors mobile-tap-target"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            title={editingId ? 'Save changes to this fuel log' : 'Save this fuel log'}
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex-1 px-4 py-2.5 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 mobile-tap-target"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fuel className="w-3.5 h-3.5" />}
            {editingId ? 'Save Changes' : 'Save Fuel Log'}
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Recent Logs</p>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-brand-accent animate-spin" />
            </div>
          ) : fuelLogs.length === 0 ? (
            <div className="py-8 text-center">
              <Inbox className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-zinc-400 text-xs">No fuel logs yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...fuelLogs]
                .sort((a, b) => b.refuelDate.localeCompare(a.refuelDate))
                .map(log => (
                  <MobileCard key={log.id} className={editingId === log.id ? 'border-brand-primary/40 bg-brand-primary/5' : undefined}>
                    <MobileCard.Primary>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-zinc-800 truncate">{getTruckLabel(log.truckId)}</p>
                        <p className="text-zinc-400 text-[10px] mt-0.5">
                          {log.refuelDate} · {log.liters} L · {log.odometerReading.toLocaleString()} km odo
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-xs text-zinc-800">R {log.cost.toLocaleString()}</p>
                        <p className="text-zinc-400 text-[10px] mt-0.5">R {log.fuelPrice}/L</p>
                      </div>
                    </MobileCard.Primary>
                    <MobileCard.Actions>
                      <MobileCardActionsMenu
                        actions={[
                          { label: 'Edit log', icon: Edit3, onClick: () => startEdit(log) },
                          {
                            label: busyId === log.id ? 'Deleting...' : 'Delete log',
                            icon: Trash2,
                            destructive: true,
                            onClick: () => handleDelete(log.id),
                          },
                        ]}
                      />
                    </MobileCard.Actions>
                  </MobileCard>
                ))}
            </div>
          )}
        </div>
      </div>
    </MobileSheet>
  );
}
