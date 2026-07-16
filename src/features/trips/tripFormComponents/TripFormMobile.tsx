import { useState } from 'react';
import {
  ArrowLeft, Plus, Check, X, Package, FileText, Search, Truck, Navigation,
  Calendar as CalendarIcon, TrendingUp, RotateCcw, Share2, Clock, Fuel, Bed, Coffee,
  GripVertical, Minimize2, MapPin, Trash2, ArrowRightLeft, SlidersHorizontal
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Trip, TripStatus, TripStop } from '../../../types';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { Truck as TruckType } from '../../trucks/hooks/useTrucks';
import { GeocodedInvoice } from './types';
import { CapacityProgressBar } from './CapacityProgressBar';
import { InteractiveTripMap } from './InteractiveTripMap';
import { InvoiceDetailsPanel } from '../TripListComponents/InvoiceDetailsPanel';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

interface GroupedLineItem {
  stockCode: string;
  description: string;
  qty: number;
  unitPrice: number;
  value: number;
}

interface TripFormMobileProps {
  isEditMode: boolean;
  isSubmitting: boolean;
  navigate: (path: string) => void;

  formData: {
    name: string;
    date: string;
    truckId: string;
    status: TripStatus;
    invoiceIds: string[];
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    name: string;
    date: string;
    truckId: string;
    status: TripStatus;
    invoiceIds: string[];
  }>>;

  trucks: TruckType[];
  invoices: UIInvoice[];
  trips: Trip[];

  stops: TripStop[];
  setStops: React.Dispatch<React.SetStateAction<TripStop[]>>;
  setEditingStop: React.Dispatch<React.SetStateAction<TripStop | null>>;
  setIsStopModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleToggleInvoice: (invId: string) => void;
  setMovingStop: (stop: TripStop | null) => void;
  setEditingInvoice: (inv: UIInvoice | null) => void;

  // Geocoding + map
  availableInvoices: UIInvoice[];
  geocodedInvoices: GeocodedInvoice[];
  setGeocodedInvoices: React.Dispatch<React.SetStateAction<GeocodedInvoice[]>>;
  selectedInvoice: GeocodedInvoice | null;
  setSelectedInvoice: (inv: GeocodedInvoice | null) => void;
  liveSelectedInvoice: GeocodedInvoice | null;

  searchTerm: string; setSearchTerm: (v: string) => void;
  selectedDistrict: string; setSelectedDistrict: (v: string) => void;
  selectedStatus: string; setSelectedStatus: (v: string) => void;
  districtsList: string[];

  currentSelectionTotal: number;
  selectedTruck: TruckType | undefined;
  groupedLineItems: GroupedLineItem[];

  checkedItems: { [key: string]: boolean };
  handleToggleCheckItem: (itemKey: string) => void;
  handleResetChecks: () => void;
  handleCopyShareLink: () => void;
  copied: boolean;

  submitTrip: () => void;
}

export function TripFormMobile({
  isEditMode, isSubmitting, navigate,
  formData, setFormData,
  trucks, invoices, trips,
  stops, setStops, setEditingStop, setIsStopModalOpen, handleToggleInvoice, setMovingStop, setEditingInvoice,
  availableInvoices, geocodedInvoices, setGeocodedInvoices,
  selectedInvoice, setSelectedInvoice, liveSelectedInvoice,
  searchTerm, setSearchTerm, selectedDistrict, setSelectedDistrict, selectedStatus, setSelectedStatus, districtsList,
  currentSelectionTotal, selectedTruck, groupedLineItems,
  checkedItems, handleToggleCheckItem, handleResetChecks, handleCopyShareLink, copied,
  submitTrip
}: TripFormMobileProps) {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showInvoicePicker, setShowInvoicePicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const hasActiveFilters = Boolean(searchTerm || selectedDistrict !== 'all' || selectedStatus !== 'all');

  const filteredAvailableInvoices = availableInvoices.filter(inv => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      inv.number?.toLowerCase().includes(q) ||
      inv.client?.toLowerCase().includes(q) ||
      inv.district?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 pb-8">
      {/* Top bar */}
      <div>
        <button
          type="button"
          title="Back to Trips List"
          onClick={() => navigate('/trips')}
          className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-zinc-400 mb-2 mobile-tap-target"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Trips
        </button>
        <h1 className="text-xl font-black text-brand-primary tracking-tight uppercase flex items-center gap-2">
          <Navigation className="w-6 h-6 text-brand-accent" />
          {isEditMode ? 'Edit Trip' : 'Create Trip'}
        </h1>
      </div>

      {/* Map + filter actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          title="View Map"
          onClick={() => setIsMapOpen(true)}
          className="flex items-center gap-1.5 bg-brand-primary text-white px-3 py-2 rounded-xl font-bold text-xs shadow-sm mobile-tap-target"
        >
          <MapPin className="w-4 h-4" />
          View Map
        </button>
        <button
          type="button"
          title="Filter map pins"
          onClick={() => setIsFilterOpen(true)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs border mobile-tap-target",
            hasActiveFilters ? "bg-brand-accent/10 text-brand-accent border-brand-accent/30" : "bg-white text-zinc-600 border-zinc-200"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />}
        </button>
        <button
          type="button"
          title="Add invoices to this trip"
          onClick={() => setShowInvoicePicker(true)}
          className="flex items-center gap-1.5 bg-white text-zinc-600 px-3 py-2 rounded-xl font-bold text-xs border border-zinc-200 mobile-tap-target"
        >
          <Plus className="w-4 h-4 text-brand-accent" />
          Add Invoice
        </button>
      </div>

      {liveSelectedInvoice && (
        <InvoiceDetailsPanel
          invoice={liveSelectedInvoice}
          variant="card"
          onClose={() => setSelectedInvoice(null)}
          onViewInvoice={() => navigate(`/invoices/${liveSelectedInvoice.id}`)}
          extraActions={
            <button
              type="button"
              title={formData.invoiceIds.includes(liveSelectedInvoice.id) ? 'Exclude from Trip' : 'Include in Trip'}
              onClick={() => handleToggleInvoice(liveSelectedInvoice.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl font-bold text-xs shadow-sm transition-all border mobile-tap-target",
                formData.invoiceIds.includes(liveSelectedInvoice.id)
                  ? "bg-red-50 text-red-600 border-red-100"
                  : "bg-brand-primary text-white border-transparent"
              )}
            >
              {formData.invoiceIds.includes(liveSelectedInvoice.id) ? (
                <><X className="w-4 h-4" /> Exclude</>
              ) : (
                <><Plus className="w-4 h-4" /> Include</>
              )}
            </button>
          }
        />
      )}

      {/* Route Sequence */}
      <div className="bg-white border border-zinc-200 shadow-sm rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3">
          <div className="min-w-0">
            <h3 className="font-black text-brand-primary uppercase tracking-tight text-xs truncate">Route Sequence</h3>
            <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
              {stops.length} {stops.length === 1 ? 'Stop' : 'Stops'} Planned
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              title="Add Stop"
              onClick={() => { setEditingStop(null); setIsStopModalOpen(true); }}
              className="p-2 bg-zinc-50 border border-zinc-200 rounded-xl mobile-tap-target"
            >
              <Plus className="w-4 h-4 text-brand-accent" />
            </button>
            {stops.length > 0 && (
              <button
                type="button"
                title="Clear All Stops"
                onClick={() => { setStops([]); setFormData(prev => ({ ...prev, invoiceIds: [] })); }}
                className="p-2 bg-white border border-red-100 text-red-500 rounded-xl mobile-tap-target"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {stops.length === 0 ? (
          <div className="text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200 py-10 px-4">
            <Navigation className="w-8 h-8 text-zinc-300 mx-auto mb-3 animate-bounce" />
            <p className="text-zinc-500 font-bold uppercase tracking-tight text-xs">No Stops Selected</p>
            <p className="text-zinc-400 mt-1 mx-auto text-[10px] leading-relaxed">
              Use the map or Add Stop to build your route.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {stops.map((stop, idx) => {
              const isInvoice = Boolean(stop.invoiceId);
              return (
                <div
                  key={`${stop.id || 'stop'}-${idx}`}
                  onClick={() => {
                    if (isInvoice) {
                      const matchedInv = invoices.find(inv => inv.id === stop.invoiceId);
                      if (matchedInv) setEditingInvoice(matchedInv);
                    } else {
                      setEditingStop(stop);
                      setIsStopModalOpen(true);
                    }
                  }}
                  className="flex items-center gap-2.5 bg-white p-3 rounded-2xl border border-zinc-200 shadow-sm cursor-pointer select-none relative"
                >
                  <div className="flex items-center justify-center w-6 h-6 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-black font-mono text-xs rounded-lg shrink-0">
                    {idx + 1}
                  </div>

                  {isInvoice ? (
                    <button
                      type="button"
                      title="Move this invoice to another trip"
                      onClick={(e) => { e.stopPropagation(); setMovingStop(stop); }}
                      className="p-2 bg-zinc-100 rounded-xl shrink-0 mobile-tap-target"
                    >
                      <ArrowRightLeft className="w-4 h-4 text-zinc-600" />
                    </button>
                  ) : (
                    <div className="p-2 bg-zinc-100 rounded-xl shrink-0">
                      {stop.type === 'Refuel' && <Fuel className="w-4 h-4 text-amber-500" />}
                      {stop.type === 'Sleep' && <Bed className="w-4 h-4 text-blue-500" />}
                      {stop.type === 'Rest' && <Coffee className="w-4 h-4 text-emerald-500" />}
                      {stop.type === 'Delivery' && <Package className="w-4 h-4 text-zinc-600" />}
                      {stop.type === 'Pickup' && <Truck className="w-4 h-4 text-indigo-500" />}
                      {!['Refuel', 'Sleep', 'Rest', 'Delivery', 'Pickup'].includes(stop.type || '') && <Clock className="w-4 h-4 text-purple-500" />}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-zinc-900 text-xs truncate uppercase tracking-tight flex items-center gap-1.5 min-w-0">
                        {isInvoice ? (
                          <span className="font-mono text-xs shrink-0">#{stop.number}</span>
                        ) : (
                          <span className="truncate">{stop.location || stop.client || stop.type}</span>
                        )}
                      </p>
                      <span className="text-[10px] font-mono font-black text-brand-primary shrink-0">
                        {isInvoice ? `R ${stop.amount?.toLocaleString() || 0}` : stop.type}
                      </span>
                    </div>
                    <p className="truncate text-[10px] text-zinc-400 font-medium mt-0.5">
                      {isInvoice
                        ? (invoices.find(inv => inv.id === stop.invoiceId)?.schoolName || stop.client || 'Unknown School')
                        : 'Scheduled Stop: Custom Waypoint'}
                    </p>
                  </div>

                  <button
                    type="button"
                    title="Delete stop"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isInvoice) {
                        handleToggleInvoice(stop.invoiceId!);
                      } else {
                        setStops(prev => prev.filter(s => s.id !== stop.id));
                      }
                    }}
                    className="p-1.5 hover:bg-red-50 text-zinc-450 rounded-xl shrink-0 mobile-tap-target"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trip Summary / manifest checklist */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm space-y-3">
        <div>
          <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-accent" />
            Trip Summary
          </h3>
          <p className="text-zinc-500 text-[10px] mt-0.5">Consolidated packing list for vehicle loading check-off.</p>
        </div>

        {groupedLineItems.length === 0 ? (
          <div className="text-center py-10 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
            <FileText className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-tight">No Items to Group</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {groupedLineItems.map((item) => {
                const itemKey = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
                const isChecked = checkedItems[itemKey] || false;
                return (
                  <div
                    key={itemKey}
                    onClick={() => handleToggleCheckItem(itemKey)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer select-none",
                      isChecked ? "bg-zinc-50/70 border-zinc-200 opacity-60" : "bg-white border-zinc-200 shadow-sm"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                      isChecked ? "bg-brand-primary border-brand-primary text-white" : "border-zinc-300 bg-white"
                    )}>
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-mono font-bold text-brand-primary break-all">
                          {item.stockCode || 'N/A'}
                        </span>
                        <span className="text-xs font-black text-right bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded font-mono tabular-nums shrink-0">
                          Qty: {item.qty}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-zinc-500 mt-1 truncate uppercase">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                type="button"
                title="Reset Checklist"
                onClick={handleResetChecks}
                className="w-11 h-11 rounded-full bg-zinc-100 text-zinc-650 shadow-md border border-zinc-200 flex items-center justify-center mobile-tap-target"
              >
                <RotateCcw className="w-4.5 h-4.5" />
              </button>
              <button
                type="button"
                title="Share Live Checklist Link"
                onClick={handleCopyShareLink}
                className="w-11 h-11 rounded-full bg-brand-primary text-white shadow-md flex items-center justify-center relative mobile-tap-target"
              >
                <Share2 className="w-4.5 h-4.5" />
                {copied && (
                  <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[9px] font-semibold px-2 py-1 rounded shadow-md whitespace-nowrap">
                    Copied!
                  </div>
                )}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Logistics & Schedule */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-brand-primary uppercase tracking-tight border-b border-zinc-100 pb-2.5">
          Logistics & Schedule
        </h3>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Trip Name</label>
          <input
            title="Trip Name"
            type="text"
            required
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
            }}
            className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-sm font-bold"
            placeholder="Enter trip name..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Scheduled Date</label>
          <div className="relative">
            <CalendarIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              title="Scheduled date"
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-sm font-medium"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Assign Truck Capacity</label>
          <div className="relative">
            <Truck className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              title="Truck"
              value={formData.truckId}
              required
              onChange={(e) => setFormData({ ...formData, truckId: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white text-sm font-medium"
            >
              <option value="">Select a truck</option>
              {trucks.map(truck => (
                <option key={truck.id} value={truck.id}>
                  {truck.name} - R {(truck.maxValue || 0).toLocaleString()} limit
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Trip Stage</label>
          <select
            title="Trip Stage"
            value={formData.status}
            required
            onChange={(e) => setFormData({ ...formData, status: e.target.value as TripStatus })}
            className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all bg-white text-sm font-medium"
          >
            {Object.values(TripStatus).map(status => (
              <option key={status} value={status}>
                {status.toUpperCase().replace(/-/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="pt-3 border-t border-zinc-100">
          <div className="flex items-center gap-2 text-brand-primary mb-2.5">
            <TrendingUp className="w-4 h-4 text-brand-accent" />
            <h4 className="text-xs font-black uppercase tracking-widest">Live Capacity Monitor</h4>
          </div>
          <div className="p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-[9px] text-zinc-400 font-extrabold uppercase leading-none">Trip Value</p>
                <p className="text-lg font-black text-brand-primary mt-1">R {currentSelectionTotal.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-zinc-400 font-extrabold uppercase leading-none">Truck Limit</p>
                <p className="text-xs font-black text-zinc-600 mt-1">
                  R {(selectedTruck?.maxValue || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <CapacityProgressBar current={currentSelectionTotal} max={selectedTruck?.maxValue || 0} height="h-3" showLabel />
          </div>
        </div>
      </div>

      {/* Sticky footer actions */}
      <div className="flex flex-col gap-2.5 sticky bottom-0 bg-white/95 backdrop-blur-sm pt-3 pb-1 -mx-4 px-4 border-t border-zinc-100">
        <button
          type="button"
          title={isEditMode ? 'Update Delivery Trip' : 'Save Delivery Trip'}
          disabled={isSubmitting}
          onClick={submitTrip}
          className="w-full bg-brand-primary text-white py-3 px-6 rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50 mobile-tap-target"
        >
          {isSubmitting && <Plus className="w-4 h-4 animate-spin" />}
          {isEditMode ? 'Update Delivery Trip' : 'Save Delivery Trip'}
        </button>
        <button
          type="button"
          title="Cancel"
          onClick={() => navigate('/trips')}
          className="w-full px-4 py-2.5 rounded-2xl font-bold text-sm text-zinc-500 mobile-tap-target"
        >
          Cancel
        </button>
      </div>

      {/* Fullscreen map */}
      {isMapOpen && (
        <div className="fixed inset-0 z-[150] bg-zinc-50 flex flex-col">
          <div className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-brand-primary/10 rounded-lg border border-brand-primary/20 shrink-0">
                <MapPin className="w-4 h-4 text-brand-primary" />
              </div>
              <h2 className="text-xs font-black text-brand-primary uppercase tracking-tight truncate">Trip Map</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                title="Filter map pins"
                onClick={() => setIsFilterOpen(true)}
                className="p-2 bg-zinc-50 border border-zinc-200 rounded-lg mobile-tap-target"
              >
                <SlidersHorizontal className="w-4 h-4 text-zinc-600" />
              </button>
              <button
                type="button"
                title={isEditMode ? 'Update Trip' : 'Submit Trip'}
                disabled={isSubmitting}
                onClick={submitTrip}
                className="flex items-center gap-1.5 bg-brand-primary text-white px-3 py-2 rounded-lg font-bold text-xs disabled:opacity-50 mobile-tap-target"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="Close Map"
                onClick={() => setIsMapOpen(false)}
                className="flex items-center gap-1.5 bg-zinc-900 text-white px-3 py-2 rounded-lg font-bold text-xs mobile-tap-target"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-zinc-100 min-h-0">
            <InteractiveTripMap
              invoices={availableInvoices}
              geocodedInvoices={geocodedInvoices}
              setGeocodedInvoices={setGeocodedInvoices}
              onInvoiceClick={setSelectedInvoice}
              onInvoiceToggle={handleToggleInvoice}
              warehouse={null}
              filters={{ searchTerm, selectedDistrict, selectedStatus }}
              stops={stops}
              setStops={setStops}
              setEditingStop={setEditingStop}
              setIsStopModalOpen={setIsStopModalOpen}
            />
          </div>

          {liveSelectedInvoice && (
            <div className="max-h-[45vh] overflow-y-auto border-t border-zinc-200 bg-white shrink-0">
              <InvoiceDetailsPanel
                invoice={liveSelectedInvoice}
                variant="sidebar"
                onClose={() => setSelectedInvoice(null)}
                onViewInvoice={() => navigate(`/invoices/${liveSelectedInvoice.id}`)}
                extraActions={
                  <button
                    type="button"
                    title={formData.invoiceIds.includes(liveSelectedInvoice.id) ? 'Exclude from Trip' : 'Include in Trip'}
                    onClick={() => handleToggleInvoice(liveSelectedInvoice.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-bold text-[11px] shadow-sm transition-all border whitespace-nowrap mobile-tap-target",
                      formData.invoiceIds.includes(liveSelectedInvoice.id)
                        ? "bg-red-50 text-red-600 border-red-100"
                        : "bg-brand-primary text-white border-transparent"
                    )}
                  >
                    {formData.invoiceIds.includes(liveSelectedInvoice.id) ? (
                      <><X className="w-4 h-4" /> Exclude</>
                    ) : (
                      <><Plus className="w-4 h-4" /> Include</>
                    )}
                  </button>
                }
              />
            </div>
          )}
        </div>
      )}

      {/* Filter sheet */}
      <MobileSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Map Pin Filters"
        subtitle="Select points to add stops"
        fullHeight={false}
        footer={
          hasActiveFilters ? (
            <button
              type="button"
              title="Reset all filters"
              onClick={() => { setSearchTerm(''); setSelectedDistrict('all'); setSelectedStatus('all'); }}
              className="w-full px-4 py-3 border border-red-200 text-red-500 font-extrabold text-xs uppercase tracking-wider rounded-xl mobile-tap-target"
            >
              Reset Filters
            </button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Client / Invoice</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                title="Filter client, invoice"
                placeholder="Filter client, invoice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">District</label>
            <select
              title="Filter by district"
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
            >
              <option value="all">All Districts</option>
              {districtsList.map(dist => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</label>
            <select
              title="Filter by status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
            >
              <option value="all">All Statuses</option>
              <option value="partially_complete">Partially Complete</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="proposed">Proposed</option>
              <option value="assembled">Assembled</option>
              <option value="on_route">On Route</option>
            </select>
          </div>
        </div>
      </MobileSheet>

      {/* Invoice picker sheet — stacked cards instead of map-only selection */}
      <MobileSheet
        isOpen={showInvoicePicker}
        onClose={() => setShowInvoicePicker(false)}
        title="Add Invoice"
        subtitle={`${availableInvoices.length} available`}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              title="Search available invoices"
              placeholder="Search client, invoice, district..."
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
            />
          </div>

          {filteredAvailableInvoices.length === 0 ? (
            <p className="text-center text-zinc-400 py-8 text-xs">No available invoices found.</p>
          ) : (
            <div className="space-y-2">
              {filteredAvailableInvoices.map(inv => {
                const isSelected = formData.invoiceIds.includes(inv.id);
                return (
                  <div
                    key={inv.id}
                    onClick={() => handleToggleInvoice(inv.id)}
                    className={cn(
                      "flex items-center justify-between gap-3 p-3 rounded-2xl border cursor-pointer transition-all",
                      isSelected ? "bg-brand-primary/5 border-brand-primary/30" : "bg-white border-zinc-200"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 text-xs truncate">#{inv.number} — {inv.client}</p>
                      <p className="text-[10px] text-zinc-400 font-medium mt-0.5 truncate">
                        {inv.district || 'No District'} · R {(inv.amount || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className={cn(
                      "w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0",
                      isSelected ? "bg-brand-primary border-brand-primary text-white" : "border-zinc-300 bg-white"
                    )}>
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </MobileSheet>
    </div>
  );
}
