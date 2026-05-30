import React, { useState, useEffect, useRef, useMemo, Dispatch, SetStateAction } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Plus, AlertCircle, Warehouse, 
  X, Package, FileText, Search, Truck, Navigation, Calendar as CalendarIcon, TrendingUp
} from 'lucide-react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';
import { cn } from '../../lib/utils';
import { useTrips } from './hooks/useTrips';
import { useTrucks } from '../trucks/hooks/useTrucks';
import { useInvoices, UIInvoice } from '../invoices/hooks/useInvoices';
import { useSettings } from '../settings/hooks/useSettings';
import { TripStatus, Settings } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY);

interface GeocodedInvoice {
  id: string;
  number: string;
  client: string;
  address: string;
  status: string;
  position: google.maps.LatLngLiteral;
  district?: string;
  lineItems?: {
    stockCode: string;
    description: string;
    qty: number;
    unitPrice: number;
    value: number;
  }[];
}

export function TripForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { trips, addTrip, updateTrip } = useTrips();
  const { trucks } = useTrucks();
  const { invoices, updateInvoice } = useInvoices();
  const { settings } = useSettings();

  const isEditMode = Boolean(id);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const prefillDate = params.get('date');
    const prefillTruck = params.get('truckId');
    return {
      name: '',
      date: prefillDate || new Date().toISOString().split('T')[0],
      truckId: prefillTruck || '',
      status: TripStatus.PROPOSED as TripStatus,
      invoiceIds: [] as string[]
    };
  });

  // Map Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Geocoding and Map state
  const [geocodedInvoices, setGeocodedInvoices] = useState<GeocodedInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<GeocodedInvoice | null>(null);
  const [selectedInvoiceForStock, setSelectedInvoiceForStock] = useState<GeocodedInvoice | null>(null);

  // Load editing trip details
  useEffect(() => {
    if (isEditMode && trips.length > 0) {
      const trip = trips.find(t => t.id === id);
      if (trip) {
        setFormData({
          name: trip.name,
          date: trip.date,
          truckId: trip.truckId,
          status: trip.status,
          invoiceIds: trip.invoiceIds || []
        });
      }
    }
  }, [id, isEditMode, trips]);

  // Set default truck if none selected
  useEffect(() => {
    if (!formData.truckId && trucks.length > 0) {
      setFormData(prev => ({ ...prev, truckId: trucks[0].id }));
    }
  }, [trucks, formData.truckId]);

  // Auto-generate trip name on truck selection if not in edit mode
  useEffect(() => {
    if (!isEditMode && formData.truckId && trucks.length > 0) {
      const activeTruck = trucks.find(t => t.id === formData.truckId);
      if (activeTruck) {
        // Find other trips for this truck
        const otherTripsCount = trips.filter(t => t.truckId === formData.truckId).length;
        const generatedName = `${activeTruck.name} - Trip ${otherTripsCount + 1}`;
        setFormData(prev => {
          if (prev.name !== generatedName) {
            return { ...prev, name: generatedName };
          }
          return prev;
        });
      }
    }
  }, [formData.truckId, trucks, trips, isEditMode]);

  // Invoices that are NOT assigned to other trips
  const availableInvoices = useMemo(() => {
    const assignedIds = new Set<string>();
    trips.forEach((t) => {
      if (isEditMode && t.id === id) {
        return;
      }
      if (t.invoiceIds) {
        t.invoiceIds.forEach((invId) => assignedIds.add(invId));
      }
    });

    return invoices.filter(inv => !assignedIds.has(inv.id));
  }, [invoices, trips, isEditMode, id]);

  // Unique Districts from geocoded invoices or full invoices
  const districtsList = useMemo(() => {
    const districtsSet = new Set<string>();
    invoices.forEach(inv => {
      if (inv.district) districtsSet.add(inv.district);
    });
    return Array.from(districtsSet).sort();
  }, [invoices]);

  // Live Capacity Calculations
  const currentSelectionTotal = useMemo(() => {
    return invoices
      .filter(inv => formData.invoiceIds.includes(inv.id))
      .reduce((sum, inv) => sum + (inv.amount || 0), 0);
  }, [invoices, formData.invoiceIds]);

  const selectedTruck = useMemo(() => {
    return trucks.find(t => t.id === formData.truckId);
  }, [trucks, formData.truckId]);

  // Toggle selection of invoice in trip form
  const handleToggleInvoice = (invId: string) => {
    setFormData(prev => {
      const isSelected = prev.invoiceIds.includes(invId);
      const updated = isSelected
        ? prev.invoiceIds.filter(id => id !== invId)
        : [...prev.invoiceIds, invId];
      return { ...prev, invoiceIds: updated };
    });
  };

  // Drag stop order helpers
  const moveStop = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= formData.invoiceIds.length) return;

    setFormData(prev => {
      const list = [...prev.invoiceIds];
      const temp = list[index];
      list[index] = list[newIdx];
      list[newIdx] = temp;
      return { ...prev, invoiceIds: list };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a trip name.');
      return;
    }
    if (!formData.truckId) {
      alert('Please select a truck.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && id) {
        await updateTrip(id, formData);
      } else {
        await addTrip(formData);
      }

      // If status is set directly to COMPLETED, update all the linked invoices
      if (formData.status === TripStatus.COMPLETED) {
        if (formData.invoiceIds && formData.invoiceIds.length > 0) {
          await Promise.all(
            formData.invoiceIds.map(invId => updateInvoice(invId, { status: 'completed' }))
          );
        }
      }

      navigate('/trips');
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving the trip.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render check for valid Google Maps configuration
  if (!hasValidKey) {
    return (
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <button 
          onClick={() => navigate('/trips')}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-850 font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
        <div className="flex items-center justify-center min-h-[400px] bg-zinc-50 rounded-2xl border border-dashed border-zinc-300">
          <div className="text-center max-w-md p-8">
            <AlertCircle className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Google Maps API Key Required</h2>
            <p className="text-zinc-500 mb-6">
              To utilize the visual interactive trip builder and map recorder, please add your Google Maps key as a secret named <code>GOOGLE_MAPS_PLATFORM_KEY</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button 
              onClick={() => navigate('/trips')}
              className="group flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-zinc-400 hover:text-brand-primary transition-all mb-2"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              Back to Trips List
            </button>
            <h1 className="text-3xl font-black text-brand-primary tracking-tight uppercase flex items-center gap-3">
              <Navigation className="w-8 h-8 text-brand-accent" />
              {isEditMode ? 'Edit Trip Recorder' : 'Create New Trip Recorder'}
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              {isEditMode 
                ? 'Update coordinates, assign vehicle capacity, and re-order delivery stops.' 
                : 'Click pins on the map directly to build delivery routes, track capacities, and schedule.'}
            </p>
          </div>
        </div>

        {/* Map panel (Full width layout at the top) */}
        <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-lg relative">
          {/* Filter Bar overlay/panel integrated directly with the map */}
          <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Map Pin Filters</span>
              <span className="h-4 w-px bg-zinc-200" />
              <p className="text-xs text-zinc-500 font-medium">Select points below to add stops to this trip route.</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Keyword Search */}
              <div className="relative w-full md:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input 
                  type="text"
                  placeholder="Filter client, invoice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
                />
              </div>

              {/* District Dropdown */}
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="text-xs bg-white border border-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 w-fit"
              >
                <option value="all">All Districts</option>
                {districtsList.map(dist => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
              </select>

              {/* Status Dropdown */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs bg-white border border-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 w-fit"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="sent">Sent</option>
              </select>

              {/* Clear filters shortcut */}
              {(searchTerm || selectedDistrict !== 'all' || selectedStatus !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedDistrict('all');
                    setSelectedStatus('all');
                  }}
                  className="text-[10px] font-black uppercase text-red-500 hover:text-red-600 tracking-wider hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Interactive Map Grid */}
          <div className="h-[430px] w-full relative bg-zinc-100">
            <InteractiveTripMap 
              invoices={availableInvoices}
              geocodedInvoices={geocodedInvoices}
              setGeocodedInvoices={setGeocodedInvoices}
              selectedInvoiceIds={formData.invoiceIds}
              onInvoiceClick={setSelectedInvoice}
              warehouse={settings}
              filters={{ searchTerm, selectedDistrict, selectedStatus }}
            />
          </div>
        </div>

        {/* Selected Invoice information panel - ALWAYS below the Map */}
        <AnimatePresence mode="wait">
          {selectedInvoice && (
            <motion.div
              key={selectedInvoice.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="bg-white p-6 rounded-2xl shadow-xl border border-zinc-200 ring-4 ring-brand-primary/5"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h4 className="text-xl font-black text-brand-primary uppercase tracking-tight flex items-center gap-2">
                      <FileText className="w-5 h-5 text-brand-primary" strokeWidth={2.5} />
                      Invoice {selectedInvoice.number}
                    </h4>
                    <span className="px-2 py-0.5 bg-brand-primary/5 text-brand-primary rounded-md text-[10px] font-black uppercase tracking-widest border border-brand-primary/10">
                      {selectedInvoice.district || 'Unassigned District'}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border",
                      selectedInvoice.status.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      selectedInvoice.status.toLowerCase() === 'overdue' ? 'bg-red-50 text-red-600 border-red-100' :
                      'bg-blue-50 text-blue-600 border-blue-100'
                    )}>
                      {selectedInvoice.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                    <span>Delivery Address:</span>
                    <span className="text-zinc-700 font-extrabold">{selectedInvoice.address}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    type="button"
                    onClick={() => handleToggleInvoice(selectedInvoice.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all border",
                      formData.invoiceIds.includes(selectedInvoice.id)
                        ? "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                        : "bg-brand-primary text-white border-transparent hover:bg-brand-primary/95"
                    )}
                  >
                    {formData.invoiceIds.includes(selectedInvoice.id) ? (
                      <>
                        <X className="w-4 h-4" />
                        Exclude from Trip
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Include in Trip
                      </>
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedInvoiceForStock(selectedInvoice)}
                    className="flex items-center gap-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 px-3 py-2 rounded-xl font-bold text-xs transition-all border border-zinc-200"
                  >
                    <Package className="w-4 h-4 text-brand-accent" />
                    Inspect Stock List
                  </button>
                  <button 
                    type="button"
                    onClick={() => setSelectedInvoice(null)}
                    className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-450 transition-all border border-transparent hover:border-zinc-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dynamic Split Action Form Layout */}
        <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left panel: Routing stops & queue sequence (7 Columns) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-brand-primary uppercase tracking-tight">
                    Route Sequences ({formData.invoiceIds.length} stops)
                  </h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Use the map or drag sequence order to plan execution.</p>
                </div>
                
                {formData.invoiceIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, invoiceIds: [] }))}
                    className="text-[10px] font-black uppercase text-red-500 border border-red-100 hover:bg-red-50 px-2.5 py-1 rounded-xl transition-all"
                  >
                    Clear All stops
                  </button>
                )}
              </div>

              {formData.invoiceIds.length === 0 ? (
                <div className="text-center py-16 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  <Navigation className="w-10 h-10 text-zinc-300 mx-auto mb-3 animate-bounce" />
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-tight">No Stops Selected</p>
                  <p className="text-zinc-400 text-xs mt-1 max-w-sm mx-auto p-2">
                    Your trip stop list is empty. Map markers are available above. Simply tap any pin representing an active invoice client location to record it.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {formData.invoiceIds.map((invId, idx) => {
                    const matchedInv = invoices.find(inv => inv.id === invId);
                    if (!matchedInv) return null;
                    
                    return (
                      <div 
                        key={invId}
                        className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm hover:border-zinc-300 transition-all"
                      >
                        {/* Queue Position badge */}
                        <div className="flex items-center justify-center w-7 h-7 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-black font-mono text-xs rounded-xl shrink-0">
                          {idx + 1}
                        </div>

                        {/* Stop details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-zinc-900 text-sm truncate uppercase tracking-tight">
                              {matchedInv.client}
                            </p>
                            <span className="text-xs font-mono font-black text-brand-primary">
                              R {matchedInv.amount.toLocaleString()}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-400 justify-between">
                            <span className="truncate">Invoice: {matchedInv.number}</span>
                            <span className="shrink-0 bg-zinc-100 px-1.5 py-0.5 rounded text-[10px] font-semibold text-zinc-650">
                              {matchedInv.district || 'No District'}
                            </span>
                          </div>
                        </div>

                        {/* Stop Reordering Controls */}
                        <div className="flex flex-col gap-0.5 shrink-0">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveStop(idx, 'up')}
                            className="p-1 hover:bg-zinc-100 rounded text-zinc-400 disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move Up"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === formData.invoiceIds.length - 1}
                            onClick={() => moveStop(idx, 'down')}
                            className="p-1 hover:bg-zinc-100 rounded text-zinc-400 disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move Down"
                          >
                            ▼
                          </button>
                        </div>

                        {/* Remove button */}
                        <button
                          type="button"
                          onClick={() => handleToggleInvoice(invId)}
                          className="p-2 hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-xl transition-colors shrink-0 border border-transparent hover:border-red-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Meta Settings / Vehicles (5 Columns) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-5">
              <h3 className="text-lg font-black text-brand-primary uppercase tracking-tight border-b border-zinc-100 pb-3">
                Logistics & Schedule
              </h3>

              <div className="space-y-4">
                {/* Trip name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Trip Name (Auto-Generated)</label>
                  <input
                    type="text"
                    required
                    disabled
                    value={formData.name}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 text-zinc-500 rounded-xl cursor-not-allowed text-sm font-bold shadow-inner"
                    placeholder="Auto-generating name based on selected truck..."
                  />
                </div>

                {/* Delivery Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Scheduled Date</label>
                  <div className="relative">
                    <CalendarIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Truck selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Assign Truck Capacity</label>
                  <div className="relative">
                    <Truck className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <select
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

                {/* Trip Status options */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Trip Stage</label>
                  <select
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
              </div>

              {/* Dynamic live capacity gauge */}
              <div className="pt-4 border-t border-zinc-100">
                <div className="flex items-center gap-2 text-brand-primary mb-3">
                  <TrendingUp className="w-4 h-4 text-brand-accent" />
                  <h4 className="text-xs font-black uppercase tracking-widest">Live Capacity Monitor</h4>
                </div>
                
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                   <div className="flex justify-between items-end mb-2">
                     <div>
                       <p className="text-[9px] text-zinc-400 font-extrabold uppercase leading-none">Trip Merchandise Value</p>
                       <p className="text-xl font-black text-brand-primary mt-1">R {currentSelectionTotal.toLocaleString()}</p>
                     </div>
                     <div className="text-right">
                       <p className="text-[9px] text-zinc-400 font-extrabold uppercase leading-none">Truck Limit</p>
                       <p className="text-xs font-black text-zinc-600 mt-1">
                         R {(selectedTruck?.maxValue || 0).toLocaleString()}
                       </p>
                     </div>
                   </div>
                   
                   <CapacityProgressBar 
                     current={currentSelectionTotal} 
                     max={selectedTruck?.maxValue || 0} 
                     height="h-3.5" 
                     showLabel 
                   />
                </div>
              </div>

              {/* Submit panel */}
              <div className="pt-4 border-t border-zinc-100 flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/trips')}
                  className="w-full sm:w-1/3 px-4 py-3 rounded-2xl font-bold text-sm text-zinc-500 hover:bg-zinc-100 transition-all border border-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-2/3 bg-brand-primary hover:bg-brand-primary/95 text-white py-3 px-6 rounded-2xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 hover:shadow-lg disabled:opacity-50"
                >
                  {isSubmitting && <Plus className="w-4 h-4 animate-spin" />}
                  {isEditMode ? 'Update Delivery Trip' : 'Save Delivery Trip'}
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Modal for viewing items manifest */}
        {selectedInvoiceForStock && (
          <StockModal 
            invoice={selectedInvoiceForStock} 
            onClose={() => setSelectedInvoiceForStock(null)} 
          />
        )}
      </div>
    </APIProvider>
  );
}

// Capacity bar helper
function CapacityProgressBar({ current, max, height = "h-2", showLabel = false }: { current: number, max: number, height?: string, showLabel?: boolean }) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const isOver = percentage > 100;
  
  const getBarColor = (pct: number) => {
    if (pct > 100) return "bg-red-500";
    if (pct > 90) return "bg-orange-500";
    if (pct > 75) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-1 w-full">
      <div className={cn("w-full bg-zinc-200 rounded-full overflow-hidden", height)}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          className={cn("h-full transition-all duration-300", getBarColor(percentage))}
        />
      </div>
      {(showLabel || isOver) && (
        <div className="flex justify-between items-center text-[9px] mt-1 font-bold">
          <span className={cn(
            "uppercase tracking-tighter",
            isOver ? "text-red-500 animate-pulse" : "text-zinc-400"
          )}>
            {isOver ? "⚠️ OVER VEHICLE CAPACITY" : `${Math.round(percentage)}% Space Utilized`}
          </span>
          {isOver && (
            <span className="font-mono text-red-500 font-extrabold pr-0.5">
              + R {(current - max).toLocaleString()} OVER
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Reuse Stock Modal structure
function StockModal({ invoice, onClose }: { invoice: GeocodedInvoice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/45 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-xl font-black text-brand-primary uppercase tracking-tight">Invoice Line Items Manifest</h3>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">
              {invoice.number} • {invoice.client}
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                <th className="pb-4 px-2">Stock Key</th>
                <th className="pb-4 px-4">Description</th>
                <th className="pb-4 px-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {(!invoice.lineItems || invoice.lineItems.length === 0) ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-zinc-400 text-sm italic font-medium p-8">
                    <Package className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
                    No line items found for this invoice.
                  </td>
                </tr>
              ) : (
                invoice.lineItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="py-4 px-2 text-xs font-mono font-bold text-brand-primary">{item.stockCode}</td>
                    <td className="py-4 px-4 text-xs font-medium text-zinc-650">{item.description}</td>
                    <td className="py-4 px-2 text-xs font-black text-right tabular-nums bg-zinc-50 group-hover:bg-zinc-100 transition-colors w-20 rounded-lg">{item.qty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-zinc-100 bg-zinc-50/30 flex justify-end">
          <button 
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-zinc-200 rounded-xl font-bold text-xs text-zinc-600 hover:bg-zinc-50 transition-all shadow-sm"
          >
            Close Manifest
          </button>
        </div>
      </div>
    </div>
  );
}

// Interactive Map component with custom sequence indicators
function InteractiveTripMap({ 
  invoices, 
  geocodedInvoices, 
  setGeocodedInvoices, 
  selectedInvoiceIds = [],
  onInvoiceClick,
  warehouse,
  filters
}: { 
  invoices: UIInvoice[], 
  geocodedInvoices: GeocodedInvoice[], 
  setGeocodedInvoices: Dispatch<SetStateAction<GeocodedInvoice[]>>,
  selectedInvoiceIds: string[],
  onInvoiceClick: (inv: GeocodedInvoice) => void,
  warehouse: Settings | null,
  filters: { searchTerm: string, selectedDistrict: string, selectedStatus: string }
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const processingIds = useRef<Set<string>>(new Set());

  // Geocode all invoices
  useEffect(() => {
    if (!geocodingLib || !invoices.length) return;

    const invoicesToGeocode = invoices.filter((inv) => 
      !geocodedInvoices.some((gi) => gi.id === inv.id) && 
      !processingIds.current.has(inv.id)
    );

    if (invoicesToGeocode.length === 0) return;

    // Mark as processing
    invoicesToGeocode.forEach(inv => processingIds.current.add(inv.id));

    const geocodeInvoices = async () => {
      const results: GeocodedInvoice[] = [];
      for (const inv of invoicesToGeocode) {
        const fullAddress = [
          inv.deliveryAddressLine1,
          inv.deliveryAddressLine2,
          inv.district,
          'South Africa'
        ].filter(Boolean).join(', ');

        const addressToSearch = fullAddress && fullAddress.length >= 5 
          ? fullAddress 
          : [inv.client, inv.district, 'South Africa'].filter(Boolean).join(', ');

        try {
          const { results: geoResults } = await new geocodingLib.Geocoder().geocode({ 
            address: addressToSearch 
          });
          
          if (geoResults && geoResults[0]) {
            results.push({
              id: inv.id,
              number: inv.number,
              client: inv.client,
              status: inv.status,
              address: geoResults[0].formatted_address,
              position: {
                lat: geoResults[0].geometry.location.lat(),
                lng: geoResults[0].geometry.location.lng()
              },
              district: inv.district,
              lineItems: inv.lineItems
            });
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`Geocoding failed for ${inv.number}:`, err);
        }
      }
      
      if (results.length > 0) {
        setGeocodedInvoices((prev) => [...prev, ...results]);
      }
    };

    geocodeInvoices();
  }, [geocodingLib, invoices, geocodedInvoices, setGeocodedInvoices]);

  // Fit bounds when map or geocodedInvoices loads
  useEffect(() => {
    if (!map) return;

    if (geocodedInvoices.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      geocodedInvoices.forEach((gi) => {
        bounds.extend(gi.position);
      });

      if (warehouse?.warehouseLat && warehouse?.warehouseLng) {
        bounds.extend({ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng });
      }

      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

      // Prevent extreme zoom-in if points are too close or single point
      const limitZoom = () => {
        if (map.getZoom() && map.getZoom()! > 14) {
          map.setZoom(12);
        }
      };
      if (typeof google !== 'undefined' && google.maps?.event) {
        google.maps.event.addListenerOnce(map, 'idle', limitZoom);
      }
    } else if (warehouse?.warehouseLat && warehouse?.warehouseLng) {
      // Loader/fallback to prevent loading zoomed-in exactly on the warehouse point
      map.setCenter({ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng });
      map.setZoom(11);
    } else {
      map.setCenter({ lat: -25.7479, lng: 28.2293 });
      map.setZoom(11);
    }
  }, [map, geocodedInvoices, warehouse]);

  // Apply filters on the geocoded list to decide which pins to render
  const filteredPins = useMemo(() => {
    return geocodedInvoices.filter(pin => {
      // Hide pins that are already part of another trip by checking against active current invoices list
      const isAvailable = invoices.some(inv => inv.id === pin.id);
      if (!isAvailable) return false;

      // 1. Text Search
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = !filters.searchTerm || 
        pin.number.toLowerCase().includes(searchLower) ||
        pin.client.toLowerCase().includes(searchLower) ||
        (pin.district?.toLowerCase() || '').includes(searchLower);

      // 2. District filter
      const matchesDistrict = filters.selectedDistrict === 'all' || pin.district === filters.selectedDistrict;

      // 3. Status filter
      const matchesStatus = filters.selectedStatus === 'all' || pin.status?.toLowerCase() === filters.selectedStatus.toLowerCase();

      return matchesSearch && matchesDistrict && matchesStatus;
    });
  }, [geocodedInvoices, filters, invoices]);

  return (
    <Map
      defaultCenter={{ lat: -25.7479, lng: 28.2293 }}
      defaultZoom={11}
      mapId="INVOICE_TRIP_RECORDER_MAP"
      style={{ width: '100%', height: '100%' }}
      internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
    >
      {/* Render matching filtered pins */}
      {filteredPins.map((inv) => {
        const orderIndex = selectedInvoiceIds.indexOf(inv.id);
        const isSelected = orderIndex !== -1;
        
        return (
          <AdvancedMarker 
            key={inv.id} 
            position={inv.position}
            onClick={() => {
              // Click focuses the information card below the map
              onInvoiceClick(inv);
            }}
          >
            {/* Custom interactive pin layout */}
            <div 
              className={cn(
                "cursor-pointer group relative transition-transform duration-300",
                isSelected ? "scale-125 z-40" : "hover:scale-110 z-10"
              )}
              title={`${inv.client} (Click pin to view details)`}
            >
              <Pin 
                background={isSelected ? '#f59e0b' : getStatusColor(inv.status)} 
                glyphColor="#fff" 
                borderColor={isSelected ? '#d97706' : getStatusBorderColor(inv.status)} 
                scale={isSelected ? 1.35 : 1.1}
              >
                <div className="flex flex-col items-center justify-center">
                  {isSelected ? (
                    // Sequence order badge on the pin
                    <span className="text-[11px] font-black leading-none text-white font-mono shrink-0">
                      {orderIndex + 1}
                    </span>
                  ) : (
                    <span className="text-[7px] font-black text-white uppercase leading-none">
                      {inv.number.slice(-3)}
                    </span>
                  )}
                </div>
              </Pin>

              {/* Custom floating label on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-zinc-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
                {inv.client} (Inv: {inv.number})
                {isSelected && ` • Stop ${orderIndex + 1}`}
              </div>
            </div>
          </AdvancedMarker>
        );
      })}

      {/* Warehouse Center marker */}
      {warehouse?.warehouseLat && warehouse?.warehouseLng && (
        <AdvancedMarker 
          position={{ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng }}
        >
          <div className="relative group">
            <Pin background="#1e1b4b" glyphColor="#fff" borderColor="#312e81" scale={1.4}>
              <Warehouse className="w-3.5 h-3.5 text-white" />
            </Pin>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-indigo-950 text-white text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded shadow-md whitespace-nowrap z-50">
              Main Warehouse Center
            </div>
          </div>
        </AdvancedMarker>
      )}
    </Map>
  );
}

// Helper colors for pins
function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'paid': return '#10b981';
    case 'overdue': return '#ef4444';
    case 'sent': return '#3b82f6';
    default: return '#71717a';
  }
}

function getStatusBorderColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'paid': return '#047857';
    case 'overdue': return '#b91c1c';
    case 'sent': return '#1d4ed8';
    default: return '#3f3f46';
  }
}
