import { useState } from 'react';
import { X, Fuel, Loader2, Inbox, Edit3, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../../lib/utils';
import { useFuelLogs, FuelLog } from '../hooks/useFuelLogs';
import { Truck } from '../../trucks/hooks/useTrucks';

export function FuelLogModal({ trucks, onClose }: {
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

  // Set while editing an existing log instead of creating a new one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
      if (ok) {
        setDeleteConfirmId(null);
        if (editingId === id) cancelEdit();
      }
    } finally {
      setBusyId(null);
    }
  };

  const getTruckLabel = (id: string) => {
    const truck = trucks.find(t => t.id === id);
    return truck ? `${truck.name} (${truck.licensePlate})` : 'Unknown truck';
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-xl border border-orange-200">
              <Fuel className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight">Fuel Log</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                {totalLitersConsumed.toFixed(1)} L consumed total
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Truck</label>
              <select
                title="Select the truck this refuel is for"
                value={truckId}
                onChange={(e) => setTruckId(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              >
                <option value="" disabled>Select a truck</option>
                {trucks.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.licensePlate})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Refuel Date</label>
              <input
                type="date"
                title="Date this refuel took place"
                value={refuelDate}
                onChange={(e) => setRefuelDate(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Odometer Reading</label>
              <input
                type="number"
                min="0"
                step="1"
                title="Current odometer reading, in km"
                placeholder="0"
                value={odometerReading}
                onChange={(e) => setOdometerReading(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Liters</label>
              <input
                type="number"
                min="0"
                step="0.01"
                title="Liters of fuel added"
                placeholder="0.00"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Fuel Price (per L)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                title="Price per liter of fuel"
                placeholder="0.00"
                value={fuelPrice}
                onChange={(e) => setFuelPrice(e.target.value)}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            {editingId && (
              <button
                type="button"
                title="Cancel editing"
                onClick={cancelEdit}
                className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              title={editingId ? 'Save changes to this fuel log' : 'Save this fuel log'}
              onClick={handleSubmit}
              disabled={!isValid || submitting}
              className="px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
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
              <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 max-h-56 overflow-y-auto">
                {[...fuelLogs]
                  .sort((a, b) => b.refuelDate.localeCompare(a.refuelDate))
                  .map(log => (
                    <div
                      key={log.id}
                      className={cn(
                        "px-4 py-2.5 flex items-center justify-between gap-3 text-xs",
                        editingId === log.id && "bg-brand-primary/5"
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-zinc-800">{getTruckLabel(log.truckId)}</p>
                        <p className="text-zinc-400 text-[10px] mt-0.5">
                          {log.refuelDate} · {log.liters} L · {log.odometerReading.toLocaleString()} km odo
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="font-black text-zinc-800">R {log.cost.toLocaleString()}</p>
                          <p className="text-zinc-400 text-[10px] mt-0.5">R {log.fuelPrice}/L</p>
                        </div>
                        <button
                          type="button"
                          title="Edit log"
                          onClick={() => startEdit(log)}
                          className="p-1.5 text-zinc-400 hover:text-brand-primary hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {deleteConfirmId === log.id ? (
                          <>
                            <button
                              type="button"
                              title="Confirm delete"
                              onClick={() => handleDelete(log.id)}
                              disabled={busyId === log.id}
                              className="p-1.5 text-white bg-red-500 rounded-lg border border-red-600 transition-all disabled:opacity-50"
                            >
                              {busyId === log.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              title="Cancel delete"
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            title="Delete log"
                            onClick={() => setDeleteConfirmId(log.id)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
