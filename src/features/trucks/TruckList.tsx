import { useState, FormEvent, useMemo, useEffect } from 'react';
import { 
  Truck as TruckIcon, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X,
  Loader2,
  Calendar,
  Shield,
  Gauge,
  Fuel,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  History,
  DollarSign,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useTrucks, Truck } from './hooks/useTrucks';
import { useServiceHistory, ServiceRecord } from './hooks/useServiceHistory';
import { cn, formatCurrency } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { TruckListMobile } from './TruckListMobile';

export function TruckList() {
  const isMobile = useIsMobile();
  const { trucks, loading, addTruck, updateTruck, deleteTruck } = useTrucks();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Service History State
  const [serviceModalTruck, setServiceModalTruck] = useState<Truck | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    licensePlate: '',
    model: '',
    make: '',
    year: '',
    vinNumber: '',
    engineNumber: '',
    capacityKg: '',
    volumetricCapacity: '',
    insuranceCompany: '',
    insurancePolicyNumber: '',
    insuranceExpiryDate: '',
    licenseRenewalDate: '',
    lastServiceDate: '',
    nextServiceKm: '',
    currentKm: '',
    fuelType: 'Diesel',
    status: 'Active',
    maxValue: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenModal = (truck?: Truck) => {
    if (truck) {
      setEditingTruck(truck);
      setFormData({ 
        name: truck.name || '', 
        licensePlate: truck.licensePlate || '',
        model: truck.model || '',
        make: truck.make || '',
        year: truck.year?.toString() || '',
        vinNumber: truck.vinNumber || '',
        engineNumber: truck.engineNumber || '',
        capacityKg: truck.capacityKg?.toString() || '',
        volumetricCapacity: truck.volumetricCapacity?.toString() || '',
        insuranceCompany: truck.insuranceCompany || '',
        insurancePolicyNumber: truck.insurancePolicyNumber || '',
        insuranceExpiryDate: truck.insuranceExpiryDate || '',
        licenseRenewalDate: truck.licenseRenewalDate || '',
        lastServiceDate: truck.lastServiceDate || '',
        nextServiceKm: truck.nextServiceKm?.toString() || '',
        currentKm: truck.currentKm?.toString() || '',
        fuelType: truck.fuelType || 'Diesel',
        status: truck.status || 'Active',
        maxValue: truck.maxValue?.toString() || ''
      });
    } else {
      setEditingTruck(null);
      setFormData({ 
        name: '', 
        licensePlate: '',
        model: '',
        make: '',
        year: '',
        vinNumber: '',
        engineNumber: '',
        capacityKg: '',
        volumetricCapacity: '',
        insuranceCompany: '',
        insurancePolicyNumber: '',
        insuranceExpiryDate: '',
        licenseRenewalDate: '',
        lastServiceDate: '',
        nextServiceKm: '',
        currentKm: '',
        fuelType: 'Diesel',
        status: 'Active',
        maxValue: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const payload = JSON.parse(JSON.stringify({
      ...formData,
      year: formData.year ? parseInt(formData.year) : undefined,
      capacityKg: formData.capacityKg ? parseFloat(formData.capacityKg) : undefined,
      volumetricCapacity: formData.volumetricCapacity ? parseFloat(formData.volumetricCapacity) : undefined,
      nextServiceKm: formData.nextServiceKm ? parseFloat(formData.nextServiceKm) : undefined,
      currentKm: formData.currentKm ? parseFloat(formData.currentKm) : undefined,
      maxValue: formData.maxValue ? parseFloat(formData.maxValue) : undefined,
      fuelType: formData.fuelType as 'Diesel' | 'Petrol' | 'Gas',
      status: formData.status as 'Active' | 'Maintenance' | 'Inactive'
    }));

    if (editingTruck) {
      await updateTruck(editingTruck.id, payload);
    } else {
      await addTruck(payload);
    }
    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this truck?')) {
      await deleteTruck(id);
    }
  };

  const filteredTrucks = useMemo(() => {
    return trucks.filter(truck => 
      truck.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      truck.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
      truck.model?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [trucks, searchQuery]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const totalPages = Math.ceil(filteredTrucks.length / itemsPerPage);

  const paginatedTrucks = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTrucks.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTrucks, currentPage, itemsPerPage]);

  const getRenewalStatus = (dateString?: string) => {
    if (!dateString) return null;
    const renewalDate = new Date(dateString);
    const today = new Date();
    const diffTime = renewalDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { label: 'Expired', color: 'text-red-600 bg-red-50 border-red-100', icon: AlertTriangle };
    if (diffDays <= 30) return { label: `${diffDays} days left`, color: 'text-amber-600 bg-amber-50 border-amber-100', icon: Clock };
    return { label: 'Up to date', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: CheckCircle2 };
  };

  if (isMobile) {
    return (
      <TruckListMobile
        trucks={trucks}
        loading={loading}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        paginatedTrucks={paginatedTrucks}
        filteredCount={filteredTrucks.length}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        getRenewalStatus={getRenewalStatus}
        isModalOpen={isModalOpen}
        editingTruck={editingTruck}
        formData={formData}
        setFormData={setFormData}
        isSubmitting={isSubmitting}
        onOpenModal={handleOpenModal}
        onCloseModal={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        serviceModalTruck={serviceModalTruck}
        onOpenServiceModal={setServiceModalTruck}
        onCloseServiceModal={() => setServiceModalTruck(null)}
      />
    );
  }

  if (loading) {
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
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Truck Fleet</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage delivery vehicles, technical specs, and license renewals.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-brand-primary text-white px-5 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-zinc-200"
        >
          <Plus className="w-4 h-4" />
          Register New Vehicle
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="saas-card p-6 bg-white border-l-4 border-l-brand-primary">
           <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Total Fleet</p>
           <div className="flex items-baseline gap-2">
             <p className="text-3xl font-black">{trucks.length}</p>
             <p className="text-xs font-bold text-zinc-400">VEHICLES</p>
           </div>
        </div>
        <div className="saas-card p-6 bg-white border-l-4 border-l-amber-400">
           <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Upcoming Renewals</p>
           <div className="flex items-baseline gap-2">
             <p className="text-3xl font-black">
               {trucks.filter(t => {
                 const status = getRenewalStatus(t.licenseRenewalDate);
                 return status && status.label !== 'Up to date';
               }).length}
             </p>
             <p className="text-xs font-bold text-amber-600">ACTION REQ.</p>
           </div>
        </div>
      </div>

      <div className="saas-card overflow-hidden">
        <div className="p-4 border-b border-zinc-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search by name, plate, or model..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50/50 text-[10px] uppercase tracking-widest font-black text-zinc-400 border-b border-zinc-100">
                <th className="px-6 py-4">Vehicle Identity</th>
                <th className="px-6 py-4">License Plate</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4">License Renewal</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {filteredTrucks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <TruckIcon className="w-10 h-10 text-zinc-200 mb-2" />
                      <p className="text-sm font-bold text-zinc-500 italic">No matching vehicles found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTrucks.map((truck) => {
                  const renewal = getRenewalStatus(truck.licenseRenewalDate);
                  return (
                    <tr key={truck.id} className="group hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-sm",
                            truck.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                          )}>
                            <TruckIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-zinc-900 uppercase tracking-tight">{truck.name}</p>
                            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                              {truck.make} {truck.model} {truck.year ? `'${truck.year.toString().slice(-2)}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center px-3 py-1.5 bg-white border border-zinc-200 rounded-lg shadow-sm">
                           <span className="text-[11px] font-black font-mono tracking-[0.2em] text-zinc-900 uppercase">{truck.licensePlate}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                          truck.status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          truck.status === 'Maintenance' ? "bg-amber-50 text-amber-600 border-amber-100" :
                          "bg-zinc-100 text-zinc-500 border-zinc-200"
                        )}>
                          {truck.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {renewal ? (
                          <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-tight", renewal.color)}>
                            <renewal.icon className="w-3.5 h-3.5" />
                            {renewal.label}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-400 italic">Not set</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => setServiceModalTruck(truck)}
                            className="p-2 hover:bg-brand-primary/10 border-transparent hover:border-brand-primary/20 border rounded-lg text-brand-primary transition-all"
                            title="Service History"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenModal(truck)}
                            className="p-2 hover:bg-white border-transparent hover:border-zinc-200 border rounded-lg text-zinc-500 transition-all"
                            title="Edit Vehicle Details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            title='Delete'
                            onClick={() => handleDelete(truck.id)}
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-150 bg-zinc-50/50">
            <span className="text-xs text-zinc-500 font-medium">
              Showing <span className="font-bold text-zinc-800">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-zinc-800">{Math.min(currentPage * itemsPerPage, filteredTrucks.length)}</span> of <span className="font-bold text-zinc-800">{filteredTrucks.length}</span> vehicles
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  if (totalPages > 5 && Math.abs(currentPage - pNum) > 1 && pNum !== 1 && pNum !== totalPages) {
                    if (Math.abs(currentPage - pNum) === 2) {
                      return <span key={pNum} className="text-xs text-zinc-400 font-bold px-0.5">...</span>;
                    }
                    return null;
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg border transition",
                        currentPage === pNum 
                          ? "bg-brand-primary border-brand-primary text-white" 
                          : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                      )}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md" 
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-4xl relative z-10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-brand-primary flex items-center justify-center text-white shadow-lg shadow-zinc-200">
                    <TruckIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">
                      {editingTruck ? 'Update Vehicle Record' : 'Register New Vehicle'}
                    </h2>
                    <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Comprehensive Fleet Management</p>
                  </div>
                </div>
                <button title='Comprehensive Fleet Management' onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 overflow-y-auto space-y-8 flex-1">
                {/* Basic Info */}
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5" />
                    Vehicle Identity & Status
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Internal Name</label>
                      <input 
                        required
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Master Truck 01" 
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">License Plate</label>
                      <input 
                        required
                        type="text" 
                        value={formData.licensePlate}
                        onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value.toUpperCase() })}
                        placeholder="ABC 123 GP" 
                        className="w-full px-4 py-3 bg-white border-2 border-zinc-100 rounded-xl text-sm font-black font-mono tracking-widest focus:outline-none focus:border-brand-primary transition-all shadow-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fleet Status</label>
                      <select aria-label="Fleet Status" 
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all shadow-sm appearance-none"
                      >
                        <option value="Active">Operational / Active</option>
                        <option value="Maintenance">Under Maintenance</option>
                        <option value="Inactive">Decommissioned / Inactive</option>
                      </select>
                    </div>
                  </div>
                </section>

                {/* Technical Specs */}
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                    <Gauge className="w-3.5 h-3.5" />
                    Technical Specifications
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Make</label>
                      <input type="text" value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} placeholder="e.g. Scania" className="modal-input" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Model</label>
                      <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="e.g. R450" className="modal-input" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Year</label>
                      <input type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} placeholder="2022" className="modal-input" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fuel Type</label>
                      <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
                        {['Diesel', 'Petrol', 'Gas'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({ ...formData, fuelType: type })}
                            className={cn(
                              "flex-1 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all",
                              formData.fuelType === type ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400 hover:text-zinc-600"
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">VIN Number</label>
                      <input type="text" value={formData.vinNumber} onChange={(e) => setFormData({ ...formData, vinNumber: e.target.value.toUpperCase() })} placeholder="17 Digit VIN" className="modal-input font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Engine Number</label>
                      <input type="text" value={formData.engineNumber} onChange={(e) => setFormData({ ...formData, engineNumber: e.target.value.toUpperCase() })} placeholder="Engine SN" className="modal-input font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Max Cargo Value (R)</label>
                      <input type="number" value={formData.maxValue} onChange={(e) => setFormData({ ...formData, maxValue: e.target.value })} placeholder="e.g. 1000000" className="modal-input" />
                    </div>
                  </div>
                </section>

                {/* Compliance & Insurance */}
                <section className="space-y-4 p-8 bg-zinc-50 rounded-[2rem] border border-zinc-100">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" />
                    Compliance & Renewals
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-900">License Renewal</label>
                        <Calendar className="w-3.5 h-3.5 text-brand-primary" />
                      </div>
                      <input aria-label="License Renewal" 
                        type="date" 
                        value={formData.licenseRenewalDate} 
                        onChange={(e) => setFormData({ ...formData, licenseRenewalDate: e.target.value })} 
                        className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all shadow-sm" 
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Insurance Expiry</label>
                        <Shield className="w-3.5 h-3.5 text-indigo-500" />
                      </div>
                      <input aria-label="Insurance Expiry" 
                        type="date" 
                        value={formData.insuranceExpiryDate} 
                        onChange={(e) => setFormData({ ...formData, insuranceExpiryDate: e.target.value })} 
                        className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all shadow-sm" 
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Next Service Km</label>
                        <Gauge className="w-3.5 h-3.5 text-zinc-400" />
                      </div>
                      <input 
                        type="number" 
                        value={formData.nextServiceKm} 
                        onChange={(e) => setFormData({ ...formData, nextServiceKm: e.target.value })} 
                        placeholder="e.g. 50000"
                        className="w-full px-4 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all shadow-sm" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Insurance Company</label>
                      <input type="text" value={formData.insuranceCompany} onChange={(e) => setFormData({ ...formData, insuranceCompany: e.target.value })} placeholder="Discovery Insure, OUTsurance, etc." className="modal-input bg-white" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Policy Number</label>
                      <input type="text" value={formData.insurancePolicyNumber} onChange={(e) => setFormData({ ...formData, insurancePolicyNumber: e.target.value })} placeholder="VHC-123456789" className="modal-input bg-white" />
                    </div>
                  </div>
                </section>

                {/* Capacity */}
                <section className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
                    <Fuel className="w-3.5 h-3.5" />
                    Payload Capacity
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Max Weight (KG)</label>
                      <input type="number" value={formData.capacityKg} onChange={(e) => setFormData({ ...formData, capacityKg: e.target.value })} placeholder="e.g. 8000" className="modal-input" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Volumetric Capacity (m³)</label>
                      <input type="number" step="0.1" value={formData.volumetricCapacity} onChange={(e) => setFormData({ ...formData, volumetricCapacity: e.target.value })} placeholder="e.g. 35.5" className="modal-input" />
                    </div>
                  </div>
                </section>

                <div className="pt-8 flex gap-4 border-t border-zinc-100">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 border-2 border-zinc-100 rounded-2xl font-black text-xs uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 transition-all"
                  >
                    Discard Changes
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-[2] bg-brand-primary text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:opacity-95 transition-all shadow-2xl shadow-zinc-200 flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : editingTruck ? 'Update Vehicle Record' : 'Complete Registration'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ServiceHistoryModal 
        truck={serviceModalTruck} 
        isOpen={!!serviceModalTruck} 
        onClose={() => setServiceModalTruck(null)} 
      />
      
      <style>{`
        .modal-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 700;
          transition: all 0.2s;
        }
        .modal-input:focus {
          outline: none;
          border-color: black;
          background-color: white;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
      `}</style>
    </div>
  );
}

function ServiceHistoryModal({ truck, isOpen, onClose }: { truck: Truck | null, isOpen: boolean, onClose: () => void }) {
  const { records, loading, addRecord, updateRecord, deleteRecord } = useServiceHistory(truck?.id || null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ServiceRecord | null>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    odometer: '',
    type: 'Scheduled Maintenance',
    description: '',
    cost: '',
    provider: '',
    nextServiceKm: '',
    nextServiceDate: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      odometer: '',
      type: 'Scheduled Maintenance',
      description: '',
      cost: '',
      provider: '',
      nextServiceKm: '',
      nextServiceDate: ''
    });
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

  const totalSpent = useMemo(() => {
    return records.reduce((sum, r) => sum + r.cost, 0);
  }, [records]);

  return (
    <AnimatePresence>
      {isOpen && truck && (
        <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md" 
            onClick={onClose}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[2.5rem] w-full max-w-5xl relative z-10 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-10 py-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 flex items-center justify-center text-white shadow-xl shadow-zinc-200">
                  <History className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-zinc-900 uppercase tracking-tight">Service History</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">{truck.name}</p>
                    <div className="w-1 h-1 rounded-full bg-zinc-300" />
                    <p className="text-xs font-black font-mono text-zinc-400 tracking-tighter uppercase">{truck.licensePlate}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="text-right px-6 py-3 bg-white border border-zinc-200 rounded-2xl shadow-sm">
                   <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Maintenance Cost</p>
                   <p className="text-lg font-black text-emerald-600">{formatCurrency(totalSpent)}</p>
                </div>
                <button onClick={onClose} aria-label="Close" className="p-3 hover:bg-zinc-100 rounded-2xl text-zinc-400 transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              {/* Left Side: List */}
              <div className="flex-1 overflow-y-auto p-10 bg-zinc-50/30">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">Maintenance Log</h3>
                  {!isAdding && (
                    <button 
                      onClick={() => setIsAdding(true)}
                      className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Record
                    </button>
                  )}
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-zinc-300" />
                  </div>
                ) : records.length === 0 ? (
                  <div className="py-20 text-center bg-white border-2 border-dashed border-zinc-200 rounded-[2rem]">
                    <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Wrench className="w-8 h-8 text-zinc-200" />
                    </div>
                    <p className="text-sm font-bold text-zinc-400 uppercase tracking-widest">No service records found</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {records.map((record) => (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={record.id}
                        className="group bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between relative z-10">
                          <div className="flex gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-50 flex flex-col items-center justify-center border border-zinc-100">
                               <p className="text-[9px] font-black text-zinc-400 uppercase leading-none">{new Date(record.date).toLocaleString('default', { month: 'short' })}</p>
                               <p className="text-lg font-black text-zinc-900 leading-none mt-1">{new Date(record.date).getDate()}</p>
                            </div>
                            <div>
                               <div className="flex items-center gap-2">
                                 <span className="text-[10px] font-black uppercase tracking-widest text-brand-primary px-2 py-0.5 bg-brand-primary/5 rounded-md">{record.type}</span>
                                 <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                                    <Gauge className="w-3 h-3" />
                                    {record.odometer.toLocaleString()} KM
                                 </span>
                               </div>
                               <h4 className="text-sm font-black text-zinc-800 mt-2">{record.description}</h4>
                               <p className="text-xs font-bold text-zinc-500 mt-1 flex items-center gap-2">
                                 <Settings className="w-3.5 h-3.5" />
                                 {record.provider}
                               </p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                             <p className="text-sm font-black text-zinc-900 mb-2">{formatCurrency(record.cost)}</p>
                             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all justify-end">
                                <button title='Edit' onClick={() => handleEdit(record)} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button title='Trash' onClick={() => handleDelete(record.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                             </div>
                          </div>
                        </div>
                        
                        {record.nextServiceKm && (
                          <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center gap-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-amber-500" /> Next Service: {record.nextServiceKm.toLocaleString()} KM</span>
                            {record.nextServiceDate && <span>• {new Date(record.nextServiceDate).toLocaleDateString()}</span>}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Side: Form */}
              <AnimatePresence>
                {isAdding && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 420, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="border-l border-zinc-100 bg-white shadow-2xl relative z-20 flex flex-col"
                  >
                    <div className="p-8 border-b border-zinc-100 flex items-center justify-between sticky top-0 bg-white z-10">
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900">
                        {editingRecord ? 'Update Record' : 'New Service Log'}
                      </h3>
                      <button onClick={resetForm} aria-label="Close" className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400"><X className="w-5 h-5" /></button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto flex-1 scroller-hide">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Service Date</label>
                          <input aria-label="Service date" type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="modal-input" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Current KM</label>
                          <input type="number" required placeholder="125000" value={formData.odometer} onChange={(e) => setFormData({...formData, odometer: e.target.value})} className="modal-input" />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Service Category</label>
                        <select aria-label="Service category" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} className="modal-input appearance-none">
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
                          required 
                          rows={3} 
                          placeholder="What was done to the vehicle?" 
                          value={formData.description} 
                          onChange={(e) => setFormData({...formData, description: e.target.value})} 
                          className="modal-input resize-none" 
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Total Cost (R)</label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-300" />
                            <input type="number" required step="0.01" placeholder="0.00" value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})} className="modal-input pl-9" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Service Provider</label>
                          <input type="text" required placeholder="Mechanic / Shop Name" value={formData.provider} onChange={(e) => setFormData({...formData, provider: e.target.value})} className="modal-input" />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-zinc-100 flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Planning & Next Service</h4>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Next Service (KM)</label>
                          <input type="number" placeholder="135000" value={formData.nextServiceKm} onChange={(e) => setFormData({...formData, nextServiceKm: e.target.value})} className="modal-input" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">Expected Date</label>
                          <input placeholder='next Service Date' type="date" value={formData.nextServiceDate} onChange={(e) => setFormData({...formData, nextServiceDate: e.target.value})} className="modal-input" />
                        </div>
                      </div>

                      <div className="pt-6 flex gap-3">
                         <button 
                           type="button" 
                           onClick={resetForm} 
                           className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 transition-all"
                         >
                            Cancel
                         </button>
                         <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="flex-[2] bg-zinc-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-zinc-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                         >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingRecord ? 'Save Changes' : 'Post Log Entry'}
                         </button>
                      </div>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

