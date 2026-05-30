import { useState, useMemo, FormEvent } from 'react';
import { 
  Calendar, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X,
  Loader2,
  ChevronDown,
  AlertCircle,
  Package
} from 'lucide-react';
import { useSchedules, Schedule } from './hooks/useSchedules';
import { useTrucks } from '../trucks/hooks/useTrucks';
import { useInvoices, UIInvoice } from '../invoices/hooks/useInvoices';
import { cn } from '../../lib/utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function ScheduleList() {
  const { schedules, scheduledInvoiceIds, loading: schedulesLoading, addSchedule, updateSchedule, deleteSchedule } = useSchedules();
  const { trucks, loading: trucksLoading } = useTrucks();
  const { invoices, loading: invoicesLoading } = useInvoices();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState<{
    day: string;
    truckId: string;
    invoiceIds: string[];
  }>({ day: 'Monday', truckId: '', invoiceIds: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [stockCodeSearchTerm, setStockCodeSearchTerm] = useState('');
  const [selectedInvoiceForStock, setSelectedInvoiceForStock] = useState<UIInvoice | null>(null);

  const loading = schedulesLoading || trucksLoading || invoicesLoading;

  const handleOpenModal = (schedule?: Schedule) => {
    setErrorMessage(null);
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({ 
        day: schedule.day, 
        truckId: schedule.truckId, 
        invoiceIds: schedule.invoiceIds 
      });
    } else {
      setEditingSchedule(null);
      setFormData({ 
        day: 'Monday', 
        truckId: trucks[0]?.id || '', 
        invoiceIds: [] 
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!formData.truckId) {
       setErrorMessage('Please select a truck');
       return;
    }
    if (formData.invoiceIds.length === 0) {
       setErrorMessage('Please select at least one invoice');
       return;
    }

    setIsSubmitting(true);
    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, formData);
      } else {
        await addSchedule(formData);
      }
      setIsModalOpen(false);
    } catch {
      setErrorMessage('Failed to save schedule. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteSchedule(deleteConfirmId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Failed to delete schedule:", error);
      setErrorMessage("Failed to delete schedule. Please try again.");
      setDeleteConfirmId(null);
    }
  };

  const groupedAvailableInvoices = useMemo(() => {
    const filtered = invoices.filter(inv => {
      // If we are editing, current schedule invoices are "available"
      const isCurrentlySelected = editingSchedule?.invoiceIds.includes(inv.id);
      const isScheduledElsewhere = scheduledInvoiceIds.has(inv.id) && !isCurrentlySelected;
      
      const matchesSearch = 
        inv.number.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
        inv.client.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
        (inv.district?.toLowerCase() || '').includes(invoiceSearchTerm.toLowerCase());

      const matchesStockCode = !stockCodeSearchTerm || (inv.lineItems?.some(item => 
        item.stockCode.toLowerCase().includes(stockCodeSearchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(stockCodeSearchTerm.toLowerCase())
      ) ?? false);

      return matchesSearch && matchesStockCode && !isScheduledElsewhere;
    });

    const grouped: Record<string, UIInvoice[]> = {};
    filtered.forEach(inv => {
      const district = inv.district || 'Unassigned';
      if (!grouped[district]) grouped[district] = [];
      grouped[district].push(inv);
    });

    return grouped;
  }, [invoices, scheduledInvoiceIds, editingSchedule, invoiceSearchTerm, stockCodeSearchTerm]);

  const toggleInvoice = (id: string) => {
    setFormData(prev => ({
      ...prev,
      invoiceIds: prev.invoiceIds.includes(id)
        ? prev.invoiceIds.filter(i => i !== id)
        : [...prev.invoiceIds, id]
    }));
  };

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      const truck = trucks.find(t => t.id === s.truckId);
      const searchStr = `${s.day} ${truck?.name || ''} ${truck?.licensePlate || ''}`.toLowerCase();
      return searchStr.includes(searchTerm.toLowerCase());
    });
  }, [schedules, trucks, searchTerm]);

  if (loading && schedules.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Delivery Schedules</h1>
          <p className="text-zinc-500 text-sm mt-1">Assign invoices to trucks and days of the week.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20"
        >
          <Plus className="w-4 h-4" />
          Create Schedule
        </button>
      </div>

      <div className="saas-card overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search schedules..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50/50 text-[10px] uppercase tracking-widest font-bold text-zinc-400 border-b border-zinc-100">
                <th className="px-6 py-4">Day / Truck</th>
                <th className="px-6 py-4">Invoices</th>
                <th className="px-6 py-4">Volume</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-zinc-500 text-sm">
                    No schedules found. Create one to get started.
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((schedule) => {
                  const truck = trucks.find(t => t.id === schedule.truckId);
                  return (
                    <tr key={schedule.id} className="group hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-400 group-hover:bg-brand-accent group-hover:text-white transition-all">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{schedule.day}</p>
                            <p className="text-[10px] text-zinc-400 font-mono italic">
                              {truck?.name || 'Unknown Truck'} ({truck?.licensePlate || 'N/A'})
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {schedule.invoiceIds.slice(0, 3).map((invId) => {
                            const inv = invoices.find(i => i.id === invId);
                            return (
                              <span key={invId} className="px-2 py-0.5 bg-zinc-100 text-[10px] font-bold text-zinc-600 rounded border border-zinc-200">
                                {inv?.number || invId.slice(0, 4)}
                              </span>
                            );
                          })}
                          {schedule.invoiceIds.length > 3 && (
                            <span className="px-2 py-0.5 bg-brand-accent/10 text-[10px] font-bold text-brand-accent rounded border border-brand-accent/20">
                              +{schedule.invoiceIds.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <span className="text-xs font-bold text-zinc-700">
                            {schedule.invoiceIds.length} Drops
                         </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleOpenModal(schedule)}
                            className="p-2 hover:bg-white border-transparent hover:border-zinc-200 border rounded-lg text-zinc-500 transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(schedule.id)}
                            className="p-2 hover:bg-red-50 border-transparent hover:border-red-100 border rounded-lg text-red-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-zinc-900">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-2xl w-full max-w-2xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
              <h2 className="text-lg font-bold text-zinc-900">
                {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-6 overflow-y-auto">
                {errorMessage && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2 duration-200">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p className="text-sm font-bold">{errorMessage}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Day of the Week</label>
                    <div className="relative">
                      <select 
                        required
                        value={formData.day}
                        onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                        className="w-full pl-4 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all appearance-none"
                      >
                        {DAYS.map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">Assigned Truck</label>
                    <div className="relative">
                      <select 
                        required
                        value={formData.truckId}
                        onChange={(e) => setFormData({ ...formData, truckId: e.target.value })}
                        className="w-full pl-4 pr-10 py-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all appearance-none uppercase font-mono tracking-widest"
                      >
                        <option value="" disabled>Select a truck</option>
                        {trucks.map(truck => (
                          <option key={truck.id} value={truck.id}>
                            {truck.licensePlate} - {truck.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                      Link Invoices <span className="ml-2 text-brand-accent font-black">{formData.invoiceIds.length} Selected</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative w-36">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400" />
                        <input 
                          type="text"
                          placeholder="Filter invoices..."
                          value={invoiceSearchTerm}
                          onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-brand-accent/20 focus:border-brand-accent"
                        />
                      </div>
                      <div className="relative w-36">
                        <Package className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-400" />
                        <input 
                          type="text"
                          placeholder="Stock Code..."
                          value={stockCodeSearchTerm}
                          onChange={(e) => setStockCodeSearchTerm(e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-[10px] focus:outline-none focus:ring-1 focus:ring-brand-accent/20 focus:border-brand-accent font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="border border-zinc-200 rounded-xl overflow-hidden bg-zinc-50/30">
                    <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100">
                      {Object.keys(groupedAvailableInvoices).length === 0 ? (
                        <div className="p-12 text-center">
                          <Package className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
                          <p className="text-sm text-zinc-400">No invoices match your search.</p>
                        </div>
                      ) : (
                        (Object.entries(groupedAvailableInvoices) as [string, UIInvoice[]][]).map(([district, districtInvoices]) => (
                          <div key={district} className="space-y-px">
                            <div className="px-4 py-2 bg-zinc-100/50 flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{district}</span>
                              <span className="text-[9px] font-bold text-zinc-400">{districtInvoices.length} Invoices</span>
                            </div>
                            <div className="divide-y divide-zinc-50">
                              {districtInvoices.map((inv) => (
                                <div 
                                  key={inv.id}
                                  className={cn(
                                    "px-4 py-3 cursor-pointer transition-all hover:bg-white group relative",
                                    formData.invoiceIds.includes(inv.id) && "bg-brand-accent/[0.03]"
                                  )}
                                >
                                  <div className="flex items-center gap-4">
                                    <div 
                                      onClick={() => toggleInvoice(inv.id)}
                                      className={cn(
                                        "w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0",
                                        formData.invoiceIds.includes(inv.id) 
                                          ? "bg-brand-accent border-brand-accent text-white" 
                                          : "bg-white border-zinc-300 group-hover:border-brand-accent"
                                      )}
                                    >
                                      {formData.invoiceIds.includes(inv.id) && <Plus className="w-3 h-3" />}
                                    </div>
                                    <div className="flex-1 min-w-0" onClick={() => toggleInvoice(inv.id)}>
                                       <div className="flex items-center gap-2">
                                          <p className="text-sm font-bold text-zinc-900 group-hover:text-brand-accent transition-colors truncate">
                                             {inv.number}
                                          </p>
                                          <span className="px-1.5 py-0.5 bg-zinc-100 text-[8px] font-bold uppercase text-zinc-400 rounded">
                                            {inv.status}
                                          </span>
                                       </div>
                                       {stockCodeSearchTerm ? (
                                         <div className="mt-1 space-y-1">
                                           {inv.lineItems?.filter(item => 
                                             item.stockCode.toLowerCase().includes(stockCodeSearchTerm.toLowerCase()) ||
                                             item.description.toLowerCase().includes(stockCodeSearchTerm.toLowerCase())
                                           ).map((item, idx) => (
                                             <div key={idx} className="flex items-center gap-4 text-[9px] font-mono leading-tight">
                                               <span className="font-black text-brand-accent shrink-0">{item.stockCode}</span>
                                               <span className="text-zinc-500 truncate">{item.description}</span>
                                               <span className="ml-auto font-black text-zinc-900 shrink-0">QTY: {item.qty}</span>
                                             </div>
                                           ))}
                                         </div>
                                       ) : null}
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                       <button
                                         type="button"
                                         onClick={(e) => {
                                           e.stopPropagation();
                                           setSelectedInvoiceForStock(inv);
                                         }}
                                         className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-brand-accent transition-all"
                                       >
                                         <Package className="w-4 h-4" />
                                         <span className="text-[8px] font-black uppercase tracking-tighter">Stock</span>
                                       </button>
                                       <div className="text-right min-w-[70px]">
                                          <p className="text-xs font-black text-zinc-900">R {inv.amount.toLocaleString()}</p>
                                       </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-zinc-200 rounded-xl font-bold text-sm hover:bg-zinc-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-brand-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingSchedule ? 'Save Changes' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 text-zinc-900">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)}></div>
          <div className="bg-white rounded-2xl w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 space-y-6">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold">Delete Schedule?</h3>
              <p className="text-sm text-zinc-500">This action cannot be undone. All invoice links will be removed from this schedule.</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2 border border-zinc-200 rounded-xl font-bold text-sm hover:bg-zinc-50 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedInvoiceForStock && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 text-zinc-900">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setSelectedInvoiceForStock(null)}></div>
          <div className="bg-white rounded-2xl w-full max-w-xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div>
                <h3 className="text-lg font-bold">Stock Count</h3>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{selectedInvoiceForStock.number} • {selectedInvoiceForStock.client}</p>
              </div>
              <button 
                onClick={() => setSelectedInvoiceForStock(null)}
                className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                    <th className="pb-3 px-2">Code</th>
                    <th className="pb-3 px-2">Description</th>
                    <th className="pb-3 px-2 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {selectedInvoiceForStock.lineItems?.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-zinc-400 text-sm italic">
                        No line items found for this invoice.
                      </td>
                    </tr>
                  ) : (
                    selectedInvoiceForStock.lineItems?.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="py-3 px-2 text-xs font-mono font-bold text-zinc-700">{item.stockCode}</td>
                        <td className="py-3 px-2 text-xs text-zinc-600">{item.description}</td>
                        <td className="py-3 px-2 text-xs font-black text-right tabular-nums">{item.qty}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
              <button 
                onClick={() => setSelectedInvoiceForStock(null)}
                className="w-full py-2 bg-white border border-zinc-200 rounded-xl font-bold text-sm hover:bg-zinc-50 transition-all shadow-sm"
              >
                Close Stock View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
