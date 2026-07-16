import { FormEvent } from 'react';
import {
  Truck as TruckIcon,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  Calendar,
  Shield,
  Gauge,
  Fuel,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Truck } from './hooks/useTrucks';
import { cn } from '../../lib/utils';
import { MobileSheet } from '../../components/mobile/MobileSheet';
import { MobileCard, MobileCardActionsMenu } from '../../components/mobile/MobileCard';
import { ServiceHistoryModalMobile } from './ServiceHistoryModalMobile';

type TruckFormData = {
  name: string;
  licensePlate: string;
  model: string;
  make: string;
  year: string;
  vinNumber: string;
  engineNumber: string;
  capacityKg: string;
  volumetricCapacity: string;
  insuranceCompany: string;
  insurancePolicyNumber: string;
  insuranceExpiryDate: string;
  licenseRenewalDate: string;
  lastServiceDate: string;
  nextServiceKm: string;
  currentKm: string;
  fuelType: string;
  status: string;
  maxValue: string;
};

interface TruckListMobileProps {
  trucks: Truck[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  paginatedTrucks: Truck[];
  filteredCount: number;
  currentPage: number;
  setCurrentPage: (updater: (prev: number) => number) => void;
  totalPages: number;
  itemsPerPage: number;
  getRenewalStatus: (dateString?: string) => { label: string; color: string; icon: typeof AlertTriangle } | null;
  isModalOpen: boolean;
  editingTruck: Truck | null;
  formData: TruckFormData;
  setFormData: (data: TruckFormData) => void;
  isSubmitting: boolean;
  onOpenModal: (truck?: Truck) => void;
  onCloseModal: () => void;
  onSubmit: (e: FormEvent) => void;
  onDelete: (id: string) => void;
  serviceModalTruck: Truck | null;
  onOpenServiceModal: (truck: Truck) => void;
  onCloseServiceModal: () => void;
}

export function TruckListMobile({
  trucks,
  loading,
  searchQuery,
  setSearchQuery,
  paginatedTrucks,
  filteredCount,
  currentPage,
  setCurrentPage,
  totalPages,
  itemsPerPage,
  getRenewalStatus,
  isModalOpen,
  editingTruck,
  formData,
  setFormData,
  isSubmitting,
  onOpenModal,
  onCloseModal,
  onSubmit,
  onDelete,
  serviceModalTruck,
  onOpenServiceModal,
  onCloseServiceModal
}: TruckListMobileProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
      </div>
    );
  }

  const upcomingRenewals = trucks.filter(t => {
    const status = getRenewalStatus(t.licenseRenewalDate);
    return status && status.label !== 'Up to date';
  }).length;

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900">Truck Fleet</h1>
        <p className="text-zinc-500 text-xs">Manage delivery vehicles, technical specs, and license renewals.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="saas-card p-4 bg-white border-l-4 border-l-brand-primary">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Total Fleet</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-black">{trucks.length}</p>
            <p className="text-[10px] font-bold text-zinc-400">VEHICLES</p>
          </div>
        </div>
        <div className="saas-card p-4 bg-white border-l-4 border-l-amber-400">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Upcoming Renewals</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-2xl font-black">{upcomingRenewals}</p>
            <p className="text-[10px] font-bold text-amber-600">ACTION REQ.</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        title="Register new vehicle"
        onClick={() => onOpenModal()}
        className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white px-5 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition-all shadow-lg shadow-zinc-200 mobile-tap-target"
      >
        <Plus className="w-4 h-4" />
        Register New Vehicle
      </button>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          title="Search vehicles"
          placeholder="Search by name, plate, or model..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 transition-all"
        />
      </div>

      {filteredCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <TruckIcon className="w-10 h-10 text-zinc-200 mb-2" />
          <p className="text-sm font-bold text-zinc-500 italic">No matching vehicles found.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedTrucks.map((truck) => {
            const renewal = getRenewalStatus(truck.licenseRenewalDate);
            return (
              <MobileCard key={truck.id}>
                <MobileCard.Primary>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                      truck.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                    )}>
                      <TruckIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-zinc-900 uppercase tracking-tight truncate">{truck.name}</p>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 truncate">
                        {truck.model || 'No model set'}
                      </p>
                    </div>
                  </div>
                  <MobileCard.Actions>
                    <MobileCardActionsMenu
                      actions={[
                        { label: 'Service History', icon: History, onClick: () => onOpenServiceModal(truck) },
                        { label: 'Edit', icon: Edit2, onClick: () => onOpenModal(truck) },
                        { label: 'Delete', icon: Trash2, destructive: true, onClick: () => onDelete(truck.id) }
                      ]}
                    />
                  </MobileCard.Actions>
                </MobileCard.Primary>
                <MobileCard.Secondary className="justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2 py-1 bg-white border border-zinc-200 rounded-lg shadow-sm">
                      <span className="text-[10px] font-black font-mono tracking-[0.15em] text-zinc-900 uppercase">{truck.licensePlate}</span>
                    </span>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      truck.status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      truck.status === 'Maintenance' ? "bg-amber-50 text-amber-600 border-amber-100" :
                      "bg-zinc-100 text-zinc-500 border-zinc-200"
                    )}>
                      {truck.status || 'Unknown'}
                    </span>
                  </div>
                </MobileCard.Secondary>
                {renewal && (
                  <MobileCard.Secondary>
                    <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-tight", renewal.color)}>
                      <renewal.icon className="w-3 h-3" />
                      {renewal.label}
                    </div>
                  </MobileCard.Secondary>
                )}
              </MobileCard>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            title="Previous page"
            className="p-2 border border-zinc-200 bg-white rounded-lg disabled:opacity-40 text-zinc-700 transition mobile-tap-target"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-zinc-500 font-medium">
            Page <span className="font-bold text-zinc-800">{currentPage}</span> of <span className="font-bold text-zinc-800">{totalPages}</span>
            {' '}({filteredCount} vehicles, {itemsPerPage}/page)
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            title="Next page"
            className="p-2 border border-zinc-200 bg-white rounded-lg disabled:opacity-40 text-zinc-700 transition mobile-tap-target"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Add / Edit vehicle sheet */}
      <MobileSheet
        isOpen={isModalOpen}
        onClose={onCloseModal}
        title={editingTruck ? 'Update Vehicle Record' : 'Register New Vehicle'}
        subtitle="Comprehensive Fleet Management"
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              title="Discard changes"
              onClick={onCloseModal}
              className="flex-1 px-4 py-3 border-2 border-zinc-100 rounded-xl font-black text-[10px] uppercase tracking-widest text-zinc-500 mobile-tap-target"
            >
              Discard
            </button>
            <button
              type="submit"
              form="truck-form-mobile"
              title="Save vehicle"
              disabled={isSubmitting}
              className="flex-[2] bg-brand-primary text-white px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-zinc-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-all mobile-tap-target"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingTruck ? 'Update Record' : 'Complete Registration'}
            </button>
          </div>
        }
      >
        <form id="truck-form-mobile" onSubmit={onSubmit} className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5" />
              Vehicle Identity & Status
            </h3>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Internal Name</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Master Truck 01"
                className="modal-input-truck-mobile font-bold"
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
                className="modal-input-truck-mobile font-black font-mono tracking-widest"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fleet Status</label>
              <select
                aria-label="Fleet Status"
                title="Fleet Status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="modal-input-truck-mobile appearance-none font-bold"
              >
                <option value="Active">Operational / Active</option>
                <option value="Maintenance">Under Maintenance</option>
                <option value="Inactive">Decommissioned / Inactive</option>
              </select>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5" />
              Technical Specifications
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Make</label>
                <input title="Make" type="text" value={formData.make} onChange={(e) => setFormData({ ...formData, make: e.target.value })} placeholder="e.g. Scania" className="modal-input-truck-mobile" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Model</label>
                <input title="Model" type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} placeholder="e.g. R450" className="modal-input-truck-mobile" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Year</label>
                <input title="Year" type="number" value={formData.year} onChange={(e) => setFormData({ ...formData, year: e.target.value })} placeholder="2022" className="modal-input-truck-mobile" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Fuel Type</label>
                <select aria-label="Fuel Type" title="Fuel Type" value={formData.fuelType} onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })} className="modal-input-truck-mobile appearance-none">
                  <option value="Diesel">Diesel</option>
                  <option value="Petrol">Petrol</option>
                  <option value="Gas">Gas</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">VIN Number</label>
              <input title="VIN Number" type="text" value={formData.vinNumber} onChange={(e) => setFormData({ ...formData, vinNumber: e.target.value.toUpperCase() })} placeholder="17 Digit VIN" className="modal-input-truck-mobile font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Engine Number</label>
              <input title="Engine Number" type="text" value={formData.engineNumber} onChange={(e) => setFormData({ ...formData, engineNumber: e.target.value.toUpperCase() })} placeholder="Engine SN" className="modal-input-truck-mobile font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Max Cargo Value (R)</label>
              <input title="Max Cargo Value" type="number" value={formData.maxValue} onChange={(e) => setFormData({ ...formData, maxValue: e.target.value })} placeholder="e.g. 1000000" className="modal-input-truck-mobile" />
            </div>
          </section>

          <section className="space-y-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" />
              Compliance & Renewals
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-900">License Renewal</label>
                <Calendar className="w-3.5 h-3.5 text-brand-primary" />
              </div>
              <input
                aria-label="License Renewal"
                title="License Renewal"
                type="date"
                value={formData.licenseRenewalDate}
                onChange={(e) => setFormData({ ...formData, licenseRenewalDate: e.target.value })}
                className="modal-input-truck-mobile bg-white"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Insurance Expiry</label>
                <Shield className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <input
                aria-label="Insurance Expiry"
                title="Insurance Expiry"
                type="date"
                value={formData.insuranceExpiryDate}
                onChange={(e) => setFormData({ ...formData, insuranceExpiryDate: e.target.value })}
                className="modal-input-truck-mobile bg-white"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-900">Next Service Km</label>
                <Gauge className="w-3.5 h-3.5 text-zinc-400" />
              </div>
              <input
                title="Next Service Km"
                type="number"
                value={formData.nextServiceKm}
                onChange={(e) => setFormData({ ...formData, nextServiceKm: e.target.value })}
                placeholder="e.g. 50000"
                className="modal-input-truck-mobile bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Insurance Company</label>
              <input title="Insurance Company" type="text" value={formData.insuranceCompany} onChange={(e) => setFormData({ ...formData, insuranceCompany: e.target.value })} placeholder="Discovery Insure, OUTsurance, etc." className="modal-input-truck-mobile bg-white" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Policy Number</label>
              <input title="Policy Number" type="text" value={formData.insurancePolicyNumber} onChange={(e) => setFormData({ ...formData, insurancePolicyNumber: e.target.value })} placeholder="VHC-123456789" className="modal-input-truck-mobile bg-white" />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">
              <Fuel className="w-3.5 h-3.5" />
              Payload Capacity
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Max Weight (KG)</label>
                <input title="Max Weight" type="number" value={formData.capacityKg} onChange={(e) => setFormData({ ...formData, capacityKg: e.target.value })} placeholder="e.g. 8000" className="modal-input-truck-mobile" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">Volumetric (m³)</label>
                <input title="Volumetric Capacity" type="number" step="0.1" value={formData.volumetricCapacity} onChange={(e) => setFormData({ ...formData, volumetricCapacity: e.target.value })} placeholder="e.g. 35.5" className="modal-input-truck-mobile" />
              </div>
            </div>
          </section>
        </form>
      </MobileSheet>

      <ServiceHistoryModalMobile
        truck={serviceModalTruck}
        isOpen={!!serviceModalTruck}
        onClose={onCloseServiceModal}
      />

      <style>{`
        .modal-input-truck-mobile {
          width: 100%;
          padding: 0.75rem 1rem;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          font-weight: 700;
          transition: all 0.2s;
        }
        .modal-input-truck-mobile:focus {
          outline: none;
          border-color: black;
          background-color: white;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
      `}</style>
    </div>
  );
}
