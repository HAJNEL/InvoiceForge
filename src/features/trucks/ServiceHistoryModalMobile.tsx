import { FormEvent, useMemo, useState } from 'react';
import {
  Plus,
  Loader2,
  Gauge,
  Settings,
  Clock,
  Wrench,
  DollarSign,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { Truck } from './hooks/useTrucks';
import { useServiceHistory, ServiceRecord } from './hooks/useServiceHistory';
import { formatCurrency } from '../../lib/utils';
import { motion } from 'motion/react';
import { MobileSheet } from '../../components/mobile/MobileSheet';
import { MobileCard, MobileCardActionsMenu } from '../../components/mobile/MobileCard';

interface ServiceHistoryModalMobileProps {
  truck: Truck | null;
  isOpen: boolean;
  onClose: () => void;
}

const emptyForm = {
  date: new Date().toISOString().split('T')[0],
  odometer: '',
  type: 'Scheduled Maintenance',
  description: '',
  cost: '',
  provider: '',
  nextServiceKm: '',
  nextServiceDate: ''
};

export function ServiceHistoryModalMobile({ truck, isOpen, onClose }: ServiceHistoryModalMobileProps) {
  const { records, loading, addRecord, updateRecord, deleteRecord } = useServiceHistory(truck?.id || null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingRecord(null);
    setIsAdding(false);
  };

  const handleEdit = (record: ServiceRecord) => {
    setEditingRecord(record);
    setFormData({
      date: record.date,
      odometer: record.odometer.toString(),
      type: record.type,
      description: record.description,
      cost: record.cost.toString(),
      provider: record.provider,
      nextServiceKm: record.nextServiceKm?.toString() || '',
      nextServiceDate: record.nextServiceDate || ''
    });
    setIsAdding(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = JSON.parse(JSON.stringify({
      ...formData,
      odometer: parseFloat(formData.odometer),
      cost: parseFloat(formData.cost),
      nextServiceKm: formData.nextServiceKm ? parseFloat(formData.nextServiceKm) : undefined,
      nextServiceDate: formData.nextServiceDate || undefined
    }));

    if (editingRecord) {
      await updateRecord(editingRecord.id, payload);
    } else {
      await addRecord(payload);
    }

    setIsSubmitting(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this service record?')) {
      await deleteRecord(id);
    }
  };

  const totalSpent = useMemo(() => records.reduce((sum, r) => sum + r.cost, 0), [records]);

  if (!truck) return null;

  return (
    <>
      <MobileSheet
        isOpen={isOpen && !isAdding}
        onClose={onClose}
        title="Service History"
        subtitle={`${truck.name} · ${truck.licensePlate}`}
        footer={
          <button
            type="button"
            title="Add service record"
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all mobile-tap-target"
          >
            <Plus className="w-4 h-4" />
            Add Record
          </button>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center justify-between">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Maintenance Cost</p>
            <p className="text-base font-black text-emerald-600">{formatCurrency(totalSpent)}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-zinc-300" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center bg-white border-2 border-dashed border-zinc-200 rounded-2xl">
              <div className="w-14 h-14 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Wrench className="w-7 h-7 text-zinc-200" />
              </div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">No service records found</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {records.map((record) => (
                <MobileCard key={record.id}>
                  <MobileCard.Primary>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary px-2 py-0.5 bg-brand-primary/5 rounded-md">
                          {record.type}
                        </span>
                        <span className="text-[10px] font-bold text-zinc-400">
                          {new Date(record.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm font-black text-zinc-800 mt-1 truncate">{record.description}</p>
                      <p className="text-[11px] font-bold text-zinc-500 mt-0.5 flex items-center gap-1.5">
                        <Settings className="w-3 h-3" />
                        {record.provider}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-black text-sm text-zinc-900">{formatCurrency(record.cost)}</span>
                      <MobileCard.Actions>
                        <MobileCardActionsMenu
                          actions={[
                            { label: 'Edit', icon: Edit2, onClick: () => handleEdit(record) },
                            { label: 'Delete', icon: Trash2, destructive: true, onClick: () => handleDelete(record.id) }
                          ]}
                        />
                      </MobileCard.Actions>
                    </div>
                  </MobileCard.Primary>
                  <MobileCard.Secondary>
                    <span className="flex items-center gap-1.5">
                      <Gauge className="w-3 h-3" />
                      {record.odometer.toLocaleString()} KM
                    </span>
                    {record.nextServiceKm && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-amber-500" />
                        Next: {record.nextServiceKm.toLocaleString()} KM
                        {record.nextServiceDate && ` · ${new Date(record.nextServiceDate).toLocaleDateString()}`}
                      </span>
                    )}
                  </MobileCard.Secondary>
                </MobileCard>
              ))}
            </div>
          )}
        </div>
      </MobileSheet>

      <MobileSheet
        isOpen={isOpen && isAdding}
        onClose={resetForm}
        title={editingRecord ? 'Update Record' : 'New Service Log'}
        subtitle={`${truck.name} · ${truck.licensePlate}`}
        headerLeft={
          <button
            type="button"
            title="Back"
            onClick={resetForm}
            className="p-2 -ml-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all mobile-tap-target"
          >
            <X className="w-5 h-5" />
          </button>
        }
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              title="Cancel"
              onClick={resetForm}
              className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 border border-zinc-200 rounded-xl mobile-tap-target"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="service-record-form-mobile"
              title="Save record"
              disabled={isSubmitting}
              className="flex-[2] bg-zinc-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 py-3 mobile-tap-target"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingRecord ? 'Save Changes' : 'Post Log Entry'}
            </button>
          </div>
        }
      >
        <motion.form
          id="service-record-form-mobile"
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Service Date</label>
              <input aria-label="Service date" title="Service date" type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="modal-input-mobile" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Current KM</label>
              <input aria-label="Current KM" title="Current KM" type="number" required placeholder="125000" value={formData.odometer} onChange={(e) => setFormData({ ...formData, odometer: e.target.value })} className="modal-input-mobile" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Service Category</label>
            <select aria-label="Service category" title="Service category" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="modal-input-mobile appearance-none">
              <option>Scheduled Maintenance</option>
              <option>Engine Repair</option>
              <option>Tire Service</option>
              <option>Brake Service</option>
              <option>Oil Change</option>
              <option>Body Work</option>
              <option>Electrical</option>
              <option>Other / General</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Service Description</label>
            <textarea
              aria-label="Service description"
              title="Service description"
              required
              rows={3}
              placeholder="What was done to the vehicle?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="modal-input-mobile resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Total Cost (R)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" />
                <input aria-label="Total cost" title="Total cost" type="number" required step="0.01" placeholder="0.00" value={formData.cost} onChange={(e) => setFormData({ ...formData, cost: e.target.value })} className="modal-input-mobile pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Service Provider</label>
              <input aria-label="Service provider" title="Service provider" type="text" required placeholder="Mechanic / Shop Name" value={formData.provider} onChange={(e) => setFormData({ ...formData, provider: e.target.value })} className="modal-input-mobile" />
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Planning & Next Service</h4>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Next Service (KM)</label>
              <input aria-label="Next service km" title="Next service km" type="number" placeholder="135000" value={formData.nextServiceKm} onChange={(e) => setFormData({ ...formData, nextServiceKm: e.target.value })} className="modal-input-mobile" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Expected Date</label>
              <input aria-label="Expected date" title="Expected date" type="date" value={formData.nextServiceDate} onChange={(e) => setFormData({ ...formData, nextServiceDate: e.target.value })} className="modal-input-mobile" />
            </div>
          </div>
        </motion.form>
      </MobileSheet>

      <style>{`
        .modal-input-mobile {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 700;
          transition: all 0.2s;
        }
        .modal-input-mobile:focus {
          outline: none;
          border-color: black;
          background-color: white;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
      `}</style>
    </>
  );
}
