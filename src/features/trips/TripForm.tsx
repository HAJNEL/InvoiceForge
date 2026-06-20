/// <reference types="google.maps" />
import React, { useState, useEffect, useRef, useMemo, Dispatch, SetStateAction } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Plus, AlertCircle, Warehouse, 
  X, Package, FileText, Search, Truck, Navigation, Calendar as CalendarIcon, TrendingUp,
  Check, RotateCcw, Share2, Filter, AlertTriangle, Clock, Fuel, Bed, Coffee, GripVertical
} from 'lucide-react';
import { PartialConfirmModal } from '../../components/PartialConfirmModal';
import { EditInvoiceModal } from '../../components/EditInvoiceModal';
import { GoogleMapsAutocomplete } from '../../components/GoogleMapsAutocomplete';
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
import { TripStatus, Settings, TripStop } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY);

interface GeocodedInvoice {
  id: string;
  number: string;
  client: string;
  address: string;
  searchAddress?: string;
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

  const [partialModalData, setPartialModalData] = useState<{
    isOpen: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoice: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trip: any;
    itemKeys: string[];
  }>({
    isOpen: false,
    invoice: null,
    trip: null,
    itemKeys: []
  });
  const { trucks } = useTrucks();
  const { invoices, updateInvoice, loading: invoicesLoading } = useInvoices();
  const { settings } = useSettings();

  const isEditMode = Boolean(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalInvoiceIds, setOriginalInvoiceIds] = useState<string[]>([]);
  const hasInitializedRef = useRef(false);
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>({});
  const [copied, setCopied] = useState(false);

  // Custom Trip Stops states
  const [stops, setStops] = useState<TripStop[]>([]);
  const [isStopModalOpen, setIsStopModalOpen] = useState(false);
  const [editingStop, setEditingStop] = useState<TripStop | null>(null);
  const draggedIdxRef = useRef<number | null>(null);

  // Form states
  const [formData, setFormData] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const prefillDate = params.get('date');
    const prefillTruck = params.get('truckId');
    const lastTruckId = localStorage.getItem('last_selected_truck_id') || '';
    return {
      name: '',
      date: prefillDate || new Date().toISOString().split('T')[0],
      truckId: prefillTruck || lastTruckId,
      status: TripStatus.PROPOSED as TripStatus,
      invoiceIds: [] as string[]
    };
  });

  // Map Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Geocoding and Map state
  const [geocodedInvoices, setGeocodedInvoices] = useState<GeocodedInvoice[]>(() => {
    try {
      const saved = localStorage.getItem('geocoded_invoices');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed as GeocodedInvoice[];
      }
    } catch (e) {
      console.error('[TripForm] Error loading cached geocoded invoices:', e);
    }
    return [];
  });
  const [selectedInvoice, setSelectedInvoice] = useState<GeocodedInvoice | null>(null);
  const [selectedInvoiceForStock, setSelectedInvoiceForStock] = useState<GeocodedInvoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<UIInvoice | null>(null);

  // Resolve the live state of selected invoice to prevent displaying stale status or details from local storage cache
  const liveSelectedInvoice = useMemo(() => {
    if (!selectedInvoice) return null;
    const live = invoices.find(inv => inv.id === selectedInvoice.id);
    if (!live) return selectedInvoice;
    return {
      ...selectedInvoice,
      status: live.status,
      client: live.client,
      number: live.number,
      lineItems: live.lineItems,
      district: live.district,
      amount: live.amount
    };
  }, [selectedInvoice, invoices]);

  // Load editing trip details
  useEffect(() => {
    if (isEditMode && trips.length > 0 && !hasInitializedRef.current && invoices.length > 0) {
      const trip = trips.find(t => t.id === id);
      if (trip) {
        setFormData({
          name: trip.name,
          date: trip.date,
          truckId: trip.truckId || '',
          status: trip.status,
          invoiceIds: trip.invoiceIds || []
        });
        setOriginalInvoiceIds(trip.invoiceIds || []);
        if (trip.checkedItems) {
          setCheckedItems(trip.checkedItems);
        }

        if (trip.stops && trip.stops.length > 0) {
          setStops(trip.stops);
        } else if (trip.invoiceIds) {
          const fallbackStops = trip.invoiceIds.map((invId: string) => {
            const matched = invoices.find(inv => inv.id === invId);
            const address = matched ? [matched.deliveryAddressLine1, matched.deliveryAddressLine2, matched.district].filter(Boolean).join(', ') : '';
            return {
              id: 'stop-' + Math.random().toString(36).substr(2, 9),
              location: address || matched?.client || '',
              type: 'Delivery',
              startTime: '',
              endTime: '',
              invoiceId: invId,
              client: matched?.client || '',
              number: matched?.number || '',
              amount: matched?.amount || 0,
              address: address
            };
          });
          setStops(fallbackStops);
        }

        hasInitializedRef.current = true;
        if (trip.truckId) {
          localStorage.setItem('last_selected_truck_id', trip.truckId);
        }
      }
    }
  }, [id, isEditMode, trips, invoices]);

  // Sync checklist and status changes in real-time
  useEffect(() => {
    if (isEditMode && trips.length > 0) {
      const trip = trips.find(t => t.id === id);
      if (trip) {
        if (trip.checkedItems && JSON.stringify(trip.checkedItems) !== JSON.stringify(checkedItems)) {
          setCheckedItems(trip.checkedItems);
        }
        if (trip.status && trip.status !== formData.status) {
          setFormData(prev => ({ ...prev, status: trip.status }));
        }
      }
    }
  }, [id, isEditMode, trips, checkedItems, formData.status]);

  // Auto-sync invoice details into the stops list in real-time whenever invoices list changes,
  // to prevent stale info being saved/locked in state
  useEffect(() => {
    if (invoices.length === 0 || stops.length === 0) return;
    
    let changed = false;
    const newStops = stops.map(stop => {
      if (!stop.invoiceId) return stop;
      const matched = invoices.find(inv => inv.id === stop.invoiceId);
      if (!matched) return stop;
      
      const invoiceAddress = [matched.deliveryAddressLine1, matched.deliveryAddressLine2, matched.district].filter(Boolean).join(', ');
      const sd = matched.stopDetails || {};
      
      const updatedLocation = sd.location || invoiceAddress || matched.client || '';
      const updatedType = sd.type || 'Delivery';
      const updatedStartTime = sd.startTime || '';
      const updatedEndTime = sd.endTime || '';
      const updatedDuration = sd.duration || '';
      const updatedClient = matched.client || '';
      const updatedNumber = matched.number || '';
      const updatedAmount = matched.amount || 0;
      
      if (
        stop.location !== updatedLocation ||
        stop.type !== updatedType ||
        stop.startTime !== updatedStartTime ||
        stop.endTime !== updatedEndTime ||
        stop.duration !== updatedDuration ||
        stop.client !== updatedClient ||
        stop.number !== updatedNumber ||
        stop.amount !== updatedAmount ||
        stop.address !== invoiceAddress
      ) {
        changed = true;
        return {
          ...stop,
          location: updatedLocation,
          type: updatedType,
          startTime: updatedStartTime,
          endTime: updatedEndTime,
          duration: updatedDuration,
          client: updatedClient,
          number: updatedNumber,
          amount: updatedAmount,
          address: invoiceAddress
        };
      }
      return stop;
    });
    
    if (changed) {
      setStops(newStops);
    }
  }, [invoices, stops]);

  // Save selected truck ID to localStorage for future defaults
  useEffect(() => {
    if (formData.truckId) {
      localStorage.setItem('last_selected_truck_id', formData.truckId);
    }
  }, [formData.truckId]);

  // Set default truck if none selected
  useEffect(() => {
    if (trucks.length > 0) {
      const lastTruckId = localStorage.getItem('last_selected_truck_id');
      const defaultId = lastTruckId && trucks.some(t => t.id === lastTruckId) ? lastTruckId : trucks[0].id;

      if (!isEditMode && !formData.truckId) {
        setFormData(prev => ({ ...prev, truckId: defaultId }));
      } else if (isEditMode && hasInitializedRef.current && !formData.truckId) {
        setFormData(prev => ({ ...prev, truckId: defaultId }));
      }
    }
  }, [trucks, formData.truckId, isEditMode]);

  // Auto-generate trip name on truck selection or date change based on convention: (Day abbreviation) - (Truck Name) - (trip number)
  useEffect(() => {
    if ((!isEditMode || hasInitializedRef.current) && formData.truckId && formData.date && trucks.length > 0) {
      const activeTruck = trucks.find(t => t.id === formData.truckId);
      if (activeTruck) {
        // Find other trips for this truck on the same day
        const sameDayTripsForTruck = trips.filter(
          t => t.date === formData.date && t.truckId === formData.truckId
        );
        
        // Sort them chronologically by createdAt to establish sequence
        const sortedTrips = [...sameDayTripsForTruck].sort((a, b) => 
          (a.createdAt || '').localeCompare(b.createdAt || '')
        );

        let tripNumber: number;
        if (isEditMode && id) {
          const currentIndex = sortedTrips.findIndex(t => t.id === id);
          if (currentIndex !== -1) {
            tripNumber = currentIndex + 1;
          } else {
            // If the edited trip has newly moved to this day/truck, put it at the end of the sequence
            tripNumber = sortedTrips.length + 1;
          }
        } else {
          tripNumber = sortedTrips.length + 1;
        }

        const [year, month, day] = formData.date.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayAbbrev = daysOfWeek[dateObj.getDay()];

        const generatedName = `${dayAbbrev} - ${activeTruck.name} - ${tripNumber}`;

        setFormData(prev => {
          if (prev.name !== generatedName) {
            return { ...prev, name: generatedName };
          }
          return prev;
        });
      }
    }
  }, [formData.truckId, formData.date, trucks, trips, isEditMode, id]);

  // Sync geocodedInvoices to localStorage whenever it is updated
  useEffect(() => {
    if (geocodedInvoices.length > 0) {
      let toStore = geocodedInvoices;
      if (!invoicesLoading && invoices.length > 0) {
        toStore = geocodedInvoices.filter(gi => invoices.some(i => i.id === gi.id));
      }
      localStorage.setItem('geocoded_invoices', JSON.stringify(toStore));
    }
  }, [geocodedInvoices, invoices, invoicesLoading]);

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

  // Active invoices and their consolidated line items for the trip
  const selectedInvoices = useMemo(() => {
    return invoices.filter(inv => formData.invoiceIds.includes(inv.id));
  }, [invoices, formData.invoiceIds]);

  const groupedLineItems = useMemo(() => {
    const groups: { [key: string]: { stockCode: string; description: string; qty: number; unitPrice: number; value: number } } = {};
    
    selectedInvoices.forEach(inv => {
      if (inv.lineItems && Array.isArray(inv.lineItems)) {
        inv.lineItems.forEach(item => {
          const key = (item.stockCode || '').trim() || item.description || 'UNKNOWN';
          if (!groups[key]) {
            groups[key] = {
              stockCode: item.stockCode || '',
              description: item.description || '',
              qty: 0,
              unitPrice: item.unitPrice || 0,
              value: 0
            };
          }
          groups[key].qty += (item.qty || 0);
          groups[key].value += (item.value || 0);
        });
      }
    });
    
    return Object.values(groups);
  }, [selectedInvoices]);

  // Toggle checklist item
  const handleToggleCheckItem = async (itemKey: string) => {
    const isChecked = checkedItems[itemKey] || false;
    const newCheckedItems = { ...checkedItems, [itemKey]: !isChecked };
    setCheckedItems(newCheckedItems);

    // Auto-transition to ON_ROUTE if all items are checked
    const allChecked = groupedLineItems.length > 0 && groupedLineItems.every(item => {
      const key = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
      return newCheckedItems[key] === true;
    });

    let nextStatus = formData.status;
    if (allChecked && formData.status !== TripStatus.ON_ROUTE) {
      nextStatus = TripStatus.ON_ROUTE;
      setFormData(prev => ({ ...prev, status: TripStatus.ON_ROUTE }));
    }

    if (isEditMode && id) {
      await updateTrip(id, {
        checkedItems: newCheckedItems,
        status: nextStatus
      });
    }
  };

  // Reset checklist items
  const handleResetChecks = async () => {
    setCheckedItems({});
    if (isEditMode && id) {
      await updateTrip(id, {
        checkedItems: {}
      });
    }
  };

  // Copy share web link
  const handleCopyShareLink = () => {
    if (!id) {
      alert("Please save this trip first before generating a shareable link.");
      return;
    }
    const link = `${window.location.origin}/shared-checklist/${id}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy link:", err);
      alert("Could not copy link to clipboard automatically. Link is: " + link);
    });
  };

  // Toggle selection of invoice in trip form
  const handleToggleInvoice = (invId: string) => {
    const isSelected = formData.invoiceIds.includes(invId);
    if (isSelected) {
      setFormData(prev => ({
        ...prev,
        invoiceIds: prev.invoiceIds.filter(id => id !== invId)
      }));
      setStops(prev => prev.filter(s => s.invoiceId !== invId));
    } else {
      const matched = invoices.find(inv => inv.id === invId);
      const invoiceAddress = matched ? [matched.deliveryAddressLine1, matched.deliveryAddressLine2, matched.district].filter(Boolean).join(', ') : '';
      const invoiceStopDetails = matched?.stopDetails || {};

      const newStop: TripStop = {
        id: 'stop-' + Math.random().toString(36).substr(2, 9),
        location: invoiceStopDetails.location || invoiceAddress || matched?.client || '',
        type: invoiceStopDetails.type || 'Delivery',
        startTime: invoiceStopDetails.startTime || '',
        endTime: invoiceStopDetails.endTime || '',
        duration: invoiceStopDetails.duration || '30m',
        invoiceId: invId,
        client: matched?.client || '',
        number: matched?.number || '',
        amount: matched?.amount || 0,
        address: invoiceAddress
      };

      setFormData(prev => ({
        ...prev,
        invoiceIds: [...prev.invoiceIds, invId]
      }));
      setStops(prev => [...prev, newStop]);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    draggedIdxRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = draggedIdxRef.current;
    if (sourceIndex === null || sourceIndex === targetIndex) return;

    setStops(prev => {
      const list = [...prev];
      const [draggedItem] = list.splice(sourceIndex, 1);
      list.splice(targetIndex, 0, draggedItem);

      // Sync the invoiceIds matching the new order
      const updInvoiceIds = list.filter(s => s.invoiceId).map(s => s.invoiceId!);
      setFormData(sPrev => ({ ...sPrev, invoiceIds: updInvoiceIds }));
      
      return list;
    });

    draggedIdxRef.current = null;
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
      const payload = {
        ...formData,
        truckName: selectedTruck ? selectedTruck.name : '',
        stops: stops, // Persist rich stop sequence & Custom Category stops and timelines
        manifestItems: groupedLineItems.map(item => ({
          stockCode: item.stockCode || 'N/A',
          description: item.description || '',
          qty: item.qty || 0
        })),
        checkedItems
      };

      if (isEditMode && id) {
        await updateTrip(id, payload);
      } else {
        await addTrip(payload);
      }

      // Handle custom draft/proposed transitions when a trip is saved:
      // 1. Any draft status invoice added to the trip turns to 'proposed'
      const addedInvoiceIds = formData.invoiceIds.filter(invId => !originalInvoiceIds.includes(invId));
      const draftAddedInvoices = addedInvoiceIds.filter(invId => {
        const liveInv = invoices.find(inv => inv.id === invId);
        const st = (liveInv?.status || '').toLowerCase();
        return st === 'draft' || st === 'darft';
      });
      if (draftAddedInvoices.length > 0) {
        await Promise.all(
          draftAddedInvoices.map(invId => updateInvoice(invId, { status: 'proposed' }))
        );
      }

      // 2. Any invoice removed from the trip changes to 'draft'
      const removedInvoiceIds = originalInvoiceIds.filter(invId => !formData.invoiceIds.includes(invId));
      if (removedInvoiceIds.length > 0) {
        await Promise.all(
          removedInvoiceIds.map(invId => updateInvoice(invId, { status: 'draft' }))
        );
      }

      // If status is set directly to DELIVERED or COMPLETED, update all the linked invoices
      if (formData.status === TripStatus.DELIVERED || formData.status === TripStatus.COMPLETED) {
        if (formData.invoiceIds && formData.invoiceIds.length > 0) {
          await Promise.all(
            formData.invoiceIds.map(invId => updateInvoice(invId, { status: 'delivered' }))
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
              <select aria-label="District"
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
              <select aria-label="Status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs bg-white border border-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 w-fit"
              >
                <option value="all">All Statuses</option>
                <option value="partially_complete">Partially Complete</option>
                <option value="draft">Draft</option>
                <option value="proposed">Proposed</option>
                <option value="assembled">Assembled</option>
                <option value="on_route">On Route</option>
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
          <div className="h-[480px] w-full relative bg-zinc-100 rounded-2xl overflow-hidden border border-zinc-200 shadow-md">
            <InteractiveTripMap 
              invoices={availableInvoices}
              geocodedInvoices={geocodedInvoices}
              setGeocodedInvoices={setGeocodedInvoices}
              onInvoiceClick={setSelectedInvoice}
              onInvoiceToggle={handleToggleInvoice}
              warehouse={settings}
              filters={{ searchTerm, selectedDistrict, selectedStatus }}
              stops={stops}
              setStops={setStops}
              setEditingStop={setEditingStop}
              setIsStopModalOpen={setIsStopModalOpen}
            />
          </div>
        </div>

        {/* Selected Invoice information panel - ALWAYS below the Map */}
        <AnimatePresence mode="wait">
          {liveSelectedInvoice && (
            <motion.div
              key={liveSelectedInvoice.id}
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
                      Invoice {liveSelectedInvoice.number}
                    </h4>
                    <span className="px-2 py-0.5 bg-brand-primary/5 text-brand-primary rounded-md text-[10px] font-black uppercase tracking-widest border border-brand-primary/10">
                      {liveSelectedInvoice.district || 'Unassigned District'}
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border",
                      liveSelectedInvoice.status.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      liveSelectedInvoice.status.toLowerCase() === 'overdue' ? 'bg-red-50 text-red-600 border-red-100' :
                      'bg-blue-50 text-blue-600 border-blue-100'
                    )}>
                      {liveSelectedInvoice.status}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5">
                    <span>Delivery Address:</span>
                    <span className="text-zinc-700 font-extrabold">{liveSelectedInvoice.address}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    type="button"
                    onClick={() => handleToggleInvoice(liveSelectedInvoice.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs shadow-sm transition-all border",
                      formData.invoiceIds.includes(liveSelectedInvoice.id)
                        ? "bg-red-50 text-red-600 border-red-100 hover:bg-red-100"
                        : "bg-brand-primary text-white border-transparent hover:bg-brand-primary/95"
                    )}
                  >
                    {formData.invoiceIds.includes(liveSelectedInvoice.id) ? (
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
                    onClick={() => setSelectedInvoiceForStock(liveSelectedInvoice)}
                    className="flex items-center gap-2 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 px-3 py-2 rounded-xl font-bold text-xs transition-all border border-zinc-200"
                  >
                    <Package className="w-4 h-4 text-brand-accent" />
                    Inspect Stock List
                  </button>
                  <button 
                    title='Select Invoice'
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
                    Route Sequences ({stops.length} stops)
                  </h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Use the map or drag sequence order to plan execution.</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStop(null);
                      setIsStopModalOpen(true);
                    }}
                    className="text-[10px] font-black uppercase text-zinc-650 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                    Add Stop
                  </button>
                  {stops.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setStops([]);
                        setFormData(prev => ({ ...prev, invoiceIds: [] }));
                      }}
                      className="text-[10px] font-black uppercase text-red-500 border border-red-100 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {stops.length === 0 ? (
                <div className="text-center py-16 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  <Navigation className="w-10 h-10 text-zinc-300 mx-auto mb-3 animate-bounce" />
                  <p className="text-zinc-500 text-sm font-bold uppercase tracking-tight">No Stops Selected</p>
                  <p className="text-zinc-400 text-xs mt-1 max-w-sm mx-auto p-2">
                    Your trip stop list is empty. Map markers are available above. Simply tap any pin representing an active invoice client location to record it, or click Add Stop to create custom waypoints.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {stops.map((stop, idx) => {
                    const isInvoice = Boolean(stop.invoiceId);
                    
                    return (
                      <div 
                        key={`${stop.id || 'stop'}-${idx}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        onClick={() => {
                          if (isInvoice) {
                            const matchedInv = invoices.find(inv => inv.id === stop.invoiceId);
                            if (matchedInv) {
                              setEditingInvoice(matchedInv);
                            }
                          } else {
                            setEditingStop(stop);
                            setIsStopModalOpen(true);
                          }
                        }}
                        className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-sm hover:border-zinc-300 hover:bg-zinc-50/40 transition-all cursor-pointer group select-none relative"
                      >
                        {/* Drag Handle Icon */}
                        <div className="text-zinc-350 group-hover:text-zinc-550 shrink-0 pr-0.5 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4" />
                        </div>

                        {/* Queue Position badge */}
                        <div className="flex items-center justify-center w-7 h-7 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-black font-mono text-xs rounded-xl shrink-0">
                          {idx + 1}
                        </div>

                        {/* Category Icon */}
                        <div className="p-2 bg-zinc-100 rounded-xl shrink-0 group-hover:bg-brand-primary/10 transition-colors">
                          {stop.type === 'Refuel' && <Fuel className="w-4 h-4 text-amber-500" />}
                          {stop.type === 'Sleep' && <Bed className="w-4 h-4 text-blue-500" />}
                          {stop.type === 'Rest' && <Coffee className="w-4 h-4 text-emerald-500" />}
                          {stop.type === 'Delivery' && <Package className="w-4 h-4 text-zinc-600" />}
                          {stop.type === 'Pickup' && <Truck className="w-4 h-4 text-indigo-500" />}
                          {!['Refuel', 'Sleep', 'Rest', 'Delivery', 'Pickup'].includes(stop.type || '') && <Clock className="w-4 h-4 text-purple-500" />}
                        </div>

                        {/* Stop details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-zinc-900 text-xs truncate uppercase tracking-tight group-hover:text-brand-primary transition-colors flex items-center gap-1.5 min-w-0">
                              {isInvoice ? (
                                <span className="text-zinc-900 font-bold shrink-0 select-none font-mono text-xs">
                                  #{stop.number}
                                </span>
                              ) : (
                                <span className="truncate">{stop.location || stop.client || stop.type}</span>
                              )}
                            </p>
                            <span className="text-[10px] font-mono font-black text-brand-primary shrink-0">
                              {isInvoice ? `R ${stop.amount?.toLocaleString() || 0}` : stop.type}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-zinc-400 justify-between">
                            <span className="truncate flex items-center gap-1.5 font-medium">
                              {isInvoice ? (
                                <span className="font-semibold text-zinc-600">
                                  {invoices.find(inv => inv.id === stop.invoiceId)?.schoolName || stop.client || "Unknown School"}
                                </span>
                              ) : `Scheduled Stop: Custom Waypoint`}
                              {isInvoice && (() => {
                                for (const t of trips) {
                                  if (stop.invoiceId && t.invoiceIds?.includes(stop.invoiceId) && t.partialItems) {
                                    const partialItems = t.partialItems;
                                    const tripPartialKeys = Object.keys(partialItems).filter(k => partialItems[k]?.isPartial);
                                    if (tripPartialKeys.length > 0) {
                                      return (
                                        <span className="ml-1 p-0.5 px-1 bg-amber-50 border border-amber-200 text-amber-700 font-mono text-[8px] font-black uppercase rounded flex items-center gap-0.5 animate-pulse">
                                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                                          FLAGGED
                                        </span>
                                      );
                                    }
                                  }
                                }
                                return null;
                              })()}
                            </span>
                            {stop.startTime ? (
                              <span className="shrink-0 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] font-black text-emerald-700 flex items-center gap-1 uppercase tracking-wider leading-none">
                                <Clock className="w-3 h-3 text-emerald-650" />
                                {stop.duration || '30m'} ({stop.startTime?.split('T')[1]} - {stop.endTime?.split('T')[1]})
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* Inline Actions */}
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          
                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isInvoice) {
                                handleToggleInvoice(stop.invoiceId!);
                              } else {
                                setStops(prev => prev.filter(s => s.id !== stop.id));
                              }
                            }}
                            className="p-1.5 hover:bg-red-50 text-zinc-450 hover:text-red-500 rounded-xl transition-colors shrink-0 border border-transparent hover:border-red-100 cursor-pointer"
                            title="Delete stop"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Consolidated Loading Manifest / Summary Card under Route Sequences */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-brand-primary uppercase tracking-tight flex items-center gap-2">
                    <Package className="w-5 h-5 text-brand-accent pb-0.5 animate-pulse" />
                    Trip Summary
                  </h3>
                  <p className="text-zinc-500 text-xs mt-0.5">Consolidated packing list for vehicle loading check-off.</p>
                </div>
              </div>

              {groupedLineItems.length === 0 ? (
                <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                  <FileText className="w-10 h-10 text-zinc-300 mx-auto mb-2.5" />
                  <p className="text-zinc-500 text-xs font-bold uppercase tracking-tight">No Items to Group</p>
                  <p className="text-zinc-400 text-[11px] mt-1 max-w-sm mx-auto px-4">
                    Assigned stops do not contain active invoice line items. Link invoices to this trip to load a loading checklist.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 pb-16">
                    {groupedLineItems.map((item) => {
                      const itemKey = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
                      const isChecked = checkedItems[itemKey] || false;
                      return (
                        <div 
                          key={itemKey}
                          className={cn(
                            "flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer select-none",
                            isChecked 
                              ? "bg-zinc-50/70 border-zinc-200 opacity-60" 
                              : "bg-white border-zinc-200 hover:border-zinc-300 shadow-sm"
                          )}
                          onClick={() => handleToggleCheckItem(itemKey)}
                        >
                          {/* Custom Checkbox */}
                          <div className={cn(
                            "w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                            isChecked 
                              ? "bg-brand-primary border-brand-primary text-white" 
                              : "border-zinc-300 bg-white"
                          )}>
                            {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>

                          {/* Item Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-xs font-mono font-bold text-brand-primary break-all">
                                {item.stockCode || 'N/A'}
                              </span>
                              <span className="text-xs font-black text-right bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded font-mono tabular-nums">
                                Qty: {item.qty}
                              </span>
                            </div>
                            <p className="text-[11px] font-semibold text-zinc-500 mt-1 lines-clamp-1 truncate uppercase">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* FAB Button Group */}
                  <div className="absolute bottom-2 right-2 z-10 flex gap-2.5">
                    {/* Reset FAB */}
                    <button
                      type="button"
                      onClick={handleResetChecks}
                      className="w-12 h-12 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-650 hover:text-zinc-900 shadow-lg border border-zinc-200 flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
                      title="Reset Checklist"
                    >
                      <RotateCcw className="w-5 h-5 transition-transform group-hover:-rotate-45" />
                    </button>

                    {/* Share FAB */}
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="w-12 h-12 rounded-full bg-brand-primary hover:bg-brand-primary/95 text-white shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 relative group"
                      title="Share Live Checklist Link"
                    >
                      <Share2 className="w-5 h-5" />
                      {copied && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-md whitespace-nowrap animate-bounce">
                          Copied Link!
                        </div>
                      )}
                    </button>
                  </div>
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
                      placeholder='From date'
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
                      title='Truck'
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
                    title='Status'
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

        {partialModalData.isOpen && (
          <PartialConfirmModal
            isOpen={partialModalData.isOpen}
            onClose={() => setPartialModalData(prev => ({ ...prev, isOpen: false }))}
            invoice={partialModalData.invoice}
            trip={partialModalData.trip}
            itemKeys={partialModalData.itemKeys}
            onSuccess={() => {
              // Successfully updated
            }}
          />
        )}

        {editingInvoice && (
          <EditInvoiceModal
            isOpen={true}
            onClose={() => setEditingInvoice(null)}
            invoice={editingInvoice}
            trips={trips}
          />
        )}

        {isStopModalOpen && (
          <CustomStopModal
            isOpen={true}
            onClose={() => {
              setIsStopModalOpen(false);
              setEditingStop(null);
            }}
            stop={editingStop}
            onSave={(data) => {
              const getStopDurationString = (start: string, end: string) => {
                if (!start || !end) return '';
                const diff = new Date(end).getTime() - new Date(start).getTime();
                if (isNaN(diff) || diff < 0) return '0 mins';
                const totalMinutes = Math.floor(diff / 60000);
                const hrs = Math.floor(totalMinutes / 60);
                const mins = totalMinutes % 60;
                if (hrs === 0) return `${mins} mins`;
                if (mins === 0) return `${hrs} hours`;
                return `${hrs}h ${mins}m`;
              };

              if (editingStop) {
                const updated = {
                  ...editingStop,
                  location: data.location,
                  type: data.type,
                  startTime: data.startTime,
                  endTime: data.endTime,
                  duration: getStopDurationString(data.startTime, data.endTime),
                  address: data.location,
                  client: data.type,
                  amount: editingStop.amount || 0
                };
                setStops(prev => prev.map(s => s.id === editingStop.id ? updated : s));
              } else {
                const newStop: TripStop = {
                  id: 'stop-' + Math.random().toString(36).substr(2, 9),
                  location: data.location,
                  type: data.type,
                  startTime: data.startTime,
                  endTime: data.endTime,
                  duration: getStopDurationString(data.startTime, data.endTime),
                  address: data.location,
                  client: data.type,
                  amount: 0,
                  number: data.type === 'Refuel' ? 'REF' : (data.type === 'Sleep' ? 'SLP' : (data.type === 'Rest' ? 'RST' : 'STP'))
                };
                setStops(prev => [...prev, newStop]);
              }
            }}
          />
        )}

        {/* Printable checklist container (hidden on screen, visible during browser printing processes) */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body {
              background: white !important;
              color: black !important;
            }
            /* Hide the primary layout wrapper, sidebar, map, buttons, filters, etc. */
            body > *:not(#printable-trip-checklist),
            #root > *:not(#printable-trip-checklist),
            .no-print {
              display: none !important;
              height: 0 !important;
              overflow: hidden !important;
              visibility: hidden !important;
            }
            #printable-trip-checklist {
              display: block !important;
              visibility: visible !important;
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              height: auto !important;
              background: white !important;
              color: black !important;
              font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
              padding: 20px !important;
            }
            /* Ensure tables and borders print properly */
            table {
              border-collapse: collapse !important;
              width: 100% !important;
            }
            th, td {
              border-bottom: 1px solid #e4e4e7 !important;
              text-align: left !important;
              padding: 8px 4px !important;
            }
          }
        ` }} />

        <div id="printable-trip-checklist" className="hidden print:block bg-white text-zinc-900 p-8 font-sans">
          {/* Header */}
          <div className="border-b-2 border-zinc-900 pb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-900">
                {formData.name || 'Unnamed Trip'}
              </h1>
              <p className="text-xs font-mono font-bold text-zinc-500 uppercase mt-1">
                Logistics Dispatch Manifest & Vehicle Loading Checklist
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-zinc-800">
                Date: <span className="font-mono text-zinc-900">{formData.date}</span>
              </p>
              <span className="inline-block mt-1 px-3 py-1 bg-zinc-900 text-white text-[10px] uppercase font-black tracking-widest rounded-lg">
                {formData.status}
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-6 mt-6 pb-6 border-b border-zinc-200">
            <div>
              <span className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Assigned Truck</span>
              <p className="font-bold text-xs text-zinc-800 mt-1">{selectedTruck ? selectedTruck.name : 'Unassigned'}</p>
              <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">Value Cap: R {(selectedTruck?.maxValue || 0).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Load Accounting</span>
              <p className="font-bold text-xs text-zinc-800 mt-1">R {currentSelectionTotal.toLocaleString()}</p>
              <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">
                Util: {selectedTruck?.maxValue ? `${Math.round((currentSelectionTotal / selectedTruck.maxValue) * 100)}%` : '0%'}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-black text-zinc-400 tracking-wider">Execution Route</span>
              <p className="font-bold text-xs text-zinc-800 mt-1">{formData.invoiceIds.length} Scheduled Stops</p>
              <p className="text-[10px] font-semibold text-zinc-500 mt-0.5">Manifest Approved for Transit</p>
            </div>
          </div>

          {/* Stop Sequences */}
          <div className="space-y-4 mt-8">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900 border-b border-zinc-300 pb-1.5 flex justify-between items-center">
              <span>Scheduled Stop Delivery Route</span>
              <span className="text-xs font-normal text-zinc-500 normal-case italic">Follow specified stop sequences</span>
            </h2>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[9px] uppercase font-black tracking-wider text-zinc-400 border-b border-zinc-300">
                  <th className="py-2 w-10 text-center">Stop</th>
                  <th className="py-2 px-2">Client / Destination</th>
                  <th className="py-2">Invoice No</th>
                  <th className="py-2 px-2">Delivery Location</th>
                  <th className="py-2 text-right">Invoice Value</th>
                </tr>
              </thead>
              <tbody>
                {formData.invoiceIds.map((invId, idx) => {
                  const matchedInv = invoices.find(inv => inv.id === invId);
                  if (!matchedInv) return null;
                  return (
                    <tr key={invId} className="border-b border-zinc-200">
                      <td className="py-3 text-center font-mono font-black">{idx + 1}</td>
                      <td className="py-3 px-2 font-bold text-zinc-900">{matchedInv.client}</td>
                      <td className="py-3 font-mono text-zinc-650">{matchedInv.number}</td>
                      <td className="py-3 px-2 text-zinc-650 max-w-xs truncate">
                        {[matchedInv.deliveryAddressLine1, matchedInv.deliveryAddressLine2, matchedInv.district].filter(Boolean).join(', ')}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-zinc-900">R {matchedInv.amount.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Grouped check sheet */}
          <div className="space-y-4 mt-8 break-before-page">
            <h2 className="text-sm font-black uppercase tracking-wider text-zinc-900 border-b border-zinc-300 pb-1.5">
              Consolidated Loading & Packing Checksheet
            </h2>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Verify counts and physical item integrity during truck load assembly. Check each row off below before truck leaves warehouse.
            </p>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[9px] uppercase font-black tracking-wider text-zinc-400 border-b border-zinc-300 font-bold">
                  <th className="py-2 w-16 text-center">Loaded</th>
                  <th className="py-2 px-2 w-32">Stock Key</th>
                  <th className="py-2 px-2 border-b">Item Description</th>
                  <th className="py-2 text-right w-24">Total Qty</th>
                </tr>
              </thead>
              <tbody>
                {groupedLineItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-zinc-200">
                    <td className="py-3 text-center">
                      <span className="inline-block w-4 h-4 border border-zinc-500 rounded-sm"></span>
                    </td>
                    <td className="py-3 px-2 font-mono font-bold text-zinc-700">{item.stockCode || 'N/A'}</td>
                    <td className="py-3 px-2 text-zinc-850">{item.description}</td>
                    <td className="py-3 text-right font-black text-sm tabular-nums text-zinc-900">{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sign offs */}
          <div className="mt-16 pt-12 border-t-2 border-zinc-300 grid grid-cols-2 gap-12 text-xs">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Warehouse Head Verification</p>
              <div className="mt-8 border-b border-dashed border-zinc-400 h-6"></div>
              <p className="text-[9px] mt-1.5 text-zinc-500">Signature & Date</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Dispatch Driver Sign-off</p>
              <div className="mt-8 border-b border-dashed border-zinc-400 h-6"></div>
              <p className="text-[9px] mt-1.5 text-zinc-500">Signature & Date</p>
            </div>
          </div>
        </div>
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
            aria-label="Close"
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
  onInvoiceClick,
  onInvoiceToggle,
  warehouse,
  filters,
  stops = [],
  setStops,
  setEditingStop,
  setIsStopModalOpen
}: { 
  invoices: UIInvoice[], 
  geocodedInvoices: GeocodedInvoice[], 
  setGeocodedInvoices: Dispatch<SetStateAction<GeocodedInvoice[]>>,
  onInvoiceClick: (inv: GeocodedInvoice) => void,
  onInvoiceToggle?: (id: string) => void,
  warehouse: Settings | null,
  filters: { searchTerm: string, selectedDistrict: string, selectedStatus: string },
  stops: TripStop[],
  setStops: Dispatch<SetStateAction<TripStop[]>>,
  setEditingStop: Dispatch<SetStateAction<TripStop | null>>,
  setIsStopModalOpen: Dispatch<SetStateAction<boolean>>
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const processingIds = useRef<Set<string>>(new Set());
  const lastClickRef = useRef<{ [invId: string]: number }>({});

  // Geocode all invoices and custom stops
  useEffect(() => {
    if (!geocodingLib) return;

    // 1. Invoices to geocode using priority logic
    const invoicesToGeocode = invoices.filter((inv) => {
      const existing = geocodedInvoices.find(gi => gi.id === inv.id);
      
      const stopLoc = inv.stopDetails?.location;
      const schoolName = inv.schoolName;
      const fullAddress = [
        inv.deliveryAddressLine1,
        inv.deliveryAddressLine2,
        inv.district,
        'South Africa'
      ].filter(Boolean).join(', ');
      
      const expectedAddress = (stopLoc && stopLoc.trim()) 
        ? stopLoc.trim() 
        : ((schoolName && schoolName.trim()) 
          ? [schoolName.trim(), inv.district, 'South Africa'].filter(Boolean).join(', ')
          : (fullAddress && fullAddress.length >= 5 
            ? fullAddress 
            : [inv.client, inv.district, 'South Africa'].filter(Boolean).join(', ')));

      if (!existing) {
        return !processingIds.current.has(inv.id + "_" + expectedAddress);
      }
      
      const isOutdated = existing.searchAddress !== expectedAddress;
      return isOutdated && !processingIds.current.has(inv.id + "_" + expectedAddress);
    });

    // 2. Custom stops to geocode
    const customStopsToGeocode = (stops || []).filter((stop) => {
      if (stop.invoiceId) return false; // Handled by invoice geocoding
      if (!stop.location) return false;
      
      const existing = geocodedInvoices.find(gi => gi.id === stop.id);
      const expectedAddress = stop.location.trim();

      if (!existing) {
        return !processingIds.current.has(stop.id + "_" + expectedAddress);
      }
      
      const isOutdated = existing.searchAddress !== expectedAddress;
      return isOutdated && !processingIds.current.has(stop.id + "_" + expectedAddress);
    });

    if (invoicesToGeocode.length === 0 && customStopsToGeocode.length === 0) return;

    // Mark as processing with address hashes
    invoicesToGeocode.forEach(inv => {
      const stopLoc = inv.stopDetails?.location;
      const schoolName = inv.schoolName;
      const fullAddress = [
        inv.deliveryAddressLine1,
        inv.deliveryAddressLine2,
        inv.district,
        'South Africa'
      ].filter(Boolean).join(', ');
      
      const expectedAddress = (stopLoc && stopLoc.trim()) 
        ? stopLoc.trim() 
        : ((schoolName && schoolName.trim()) 
          ? [schoolName.trim(), inv.district, 'South Africa'].filter(Boolean).join(', ')
          : (fullAddress && fullAddress.length >= 5 
            ? fullAddress 
            : [inv.client, inv.district, 'South Africa'].filter(Boolean).join(', ')));
      processingIds.current.add(inv.id + "_" + expectedAddress);
    });
    
    customStopsToGeocode.forEach(stop => {
      const expectedAddress = stop.location.trim();
      processingIds.current.add(stop.id + "_" + expectedAddress);
    });

    const geocodeLocations = async () => {
      const results: GeocodedInvoice[] = [];

      // Geocode Invoices
      for (const inv of invoicesToGeocode) {
        const stopLoc = inv.stopDetails?.location;
        const schoolName = inv.schoolName;
        const fullAddress = [
          inv.deliveryAddressLine1,
          inv.deliveryAddressLine2,
          inv.district,
          'South Africa'
        ].filter(Boolean).join(', ');
        
        const expectedAddress = (stopLoc && stopLoc.trim()) 
          ? stopLoc.trim() 
          : ((schoolName && schoolName.trim()) 
            ? [schoolName.trim(), inv.district, 'South Africa'].filter(Boolean).join(', ')
            : (fullAddress && fullAddress.length >= 5 
              ? fullAddress 
              : [inv.client, inv.district, 'South Africa'].filter(Boolean).join(', ')));

        try {
          const { results: geoResults } = await new geocodingLib.Geocoder().geocode({ 
            address: expectedAddress 
          });
          
          if (geoResults && geoResults[0]) {
            results.push({
              id: inv.id,
              number: inv.number,
              client: inv.client,
              status: inv.status,
              address: geoResults[0].formatted_address,
              searchAddress: expectedAddress,
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
          console.error(`Geocoding failed for invoice ${inv.number}:`, err);
        }
      }

      // Geocode Custom Stops
      for (const stop of customStopsToGeocode) {
        const expectedAddress = stop.location.trim();
        try {
          const { results: geoResults } = await new geocodingLib.Geocoder().geocode({ 
            address: expectedAddress 
          });
          
          if (geoResults && geoResults[0]) {
            results.push({
              id: stop.id,
              number: stop.type === 'Refuel' ? 'REF' : (stop.type === 'Sleep' ? 'SLP' : (stop.type === 'Rest' ? 'RST' : 'STP')),
              client: stop.location,
              status: 'custom_stop',
              address: geoResults[0].formatted_address,
              searchAddress: expectedAddress,
              position: {
                lat: geoResults[0].geometry.location.lat(),
                lng: geoResults[0].geometry.location.lng()
              },
              district: 'Custom Stop',
              lineItems: []
            });
          }
          await new Promise(r => setTimeout(r, 200));
        } catch (err) {
          console.error(`Geocoding failed for custom stop ${stop.location}:`, err);
        }
      }
      
      if (results.length > 0) {
        setGeocodedInvoices((prev) => {
          const newIds = results.map(r => r.id);
          const filteredPrev = prev.filter(p => !newIds.includes(p.id));
          return [...filteredPrev, ...results];
        });
      }
    };

    geocodeLocations();
  }, [geocodingLib, invoices, stops, geocodedInvoices, setGeocodedInvoices]);

  // Fit bounds when map or geocodedInvoices loads
  useEffect(() => {
    if (!map) return;

    if (geocodedInvoices.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      geocodedInvoices.forEach((gi) => {
        // Only extend if it belongs to actively filtered/rendered pins
        const matchesInvoice = invoices.some(i => i.id === gi.id);
        const matchesCustom = gi.status === 'custom_stop' && (stops || []).some(s => s.id === gi.id);
        if (matchesInvoice || matchesCustom) {
          bounds.extend(gi.position);
        }
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
  }, [map, geocodedInvoices, warehouse, invoices, stops]);

  // Apply filters on the geocoded list to decide which pins to render
  const [selectedLegendStatuses, setSelectedLegendStatuses] = useState<string[]>([]);

  const filteredPins = useMemo(() => {
    const pins: GeocodedInvoice[] = [];
    const seenIds = new Set<string>();
    
    geocodedInvoices.forEach(pin => {
      if (seenIds.has(pin.id)) return;
      seenIds.add(pin.id);

      if (pin.status === 'custom_stop') {
        pins.push(pin);
        return;
      }

      const liveInv = invoices.find(inv => inv.id === pin.id);
      if (!liveInv) return;
      pins.push({
        ...pin,
        status: liveInv.status,
        client: liveInv.client,
        number: liveInv.number,
        lineItems: liveInv.lineItems,
        district: liveInv.district,
      });
    });

    return pins.filter(pin => {
      if (pin.status === 'custom_stop') {
        // ALWAYS show custom stops on the map if they are part of our current trip stops list!
        const isPartofTrip = (stops || []).some(s => s.id === pin.id);
        return isPartofTrip;
      }

      // Do not display invoices on the map that have a status of delivered or invoiced
      const statusLower = (pin.status || '').toLowerCase();
      if (statusLower === 'delivered' || statusLower === 'invoiced' || statusLower === 'complete' || statusLower === 'completed') {
        return false;
      }

      // 1. Text Search
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = !filters.searchTerm || 
        pin.number.toLowerCase().includes(searchLower) ||
        pin.client.toLowerCase().includes(searchLower) ||
        (pin.district?.toLowerCase() || '').includes(searchLower);

      // 2. District filter
      const matchesDistrict = filters.selectedDistrict === 'all' || pin.district === filters.selectedDistrict;

      // 3. Status filter
      const matchesStatus = filters.selectedStatus === 'all' || (() => {
        const normFilterStatus = filters.selectedStatus.toLowerCase();
        const normPinStatus = (statusLower === 'assembly' ? 'assembled' : 
                               (statusLower === 'loaded' ? 'partially_complete' : 
                                (statusLower === 'partially complete' ? 'partially_complete' : 
                                 (statusLower === 'completed' || statusLower === 'invoiced' ? 'complete' : statusLower)))).toLowerCase();
        return normPinStatus === normFilterStatus;
      })();

      // 4. Legend status filter
      const normPinStatus = (statusLower === 'assembly' ? 'assembled' : 
                             (statusLower === 'loaded' ? 'partially_complete' : 
                              (statusLower === 'partially complete' ? 'partially_complete' : 
                               (statusLower === 'completed' || statusLower === 'invoiced' ? 'complete' : statusLower)))).toLowerCase();
      const matchesLegendStatus = selectedLegendStatuses.length === 0 || selectedLegendStatuses.includes(normPinStatus);

      return matchesSearch && matchesDistrict && matchesStatus && matchesLegendStatus;
    });
  }, [geocodedInvoices, filters, invoices, stops, selectedLegendStatuses]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 relative">
        <Map
          defaultCenter={{ lat: -25.7479, lng: 28.2293 }}
          defaultZoom={11}
          mapId="INVOICE_TRIP_RECORDER_MAP"
          style={{ width: '100%', height: '100%' }}
          disableDoubleClickZoom={true}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          {/* Render matching filtered pins */}
          {filteredPins.map((inv, pIdx) => {
            const orderIndex = (stops || []).findIndex(s => s.id === inv.id || (s.invoiceId && s.invoiceId === inv.id));
            const isSelected = orderIndex !== -1;
            const isCustomStop = inv.status === 'custom_stop';
            
            return (
              <AdvancedMarker 
                key={`${inv.id}-${pIdx}`} 
                position={inv.position}
                onClick={(e) => {
                  if (isCustomStop) {
                    const matchedStop = (stops || []).find(s => s.id === inv.id);
                    if (matchedStop) {
                      setEditingStop(matchedStop);
                      setIsStopModalOpen(true);
                    }
                    return;
                  }
                  const now = Date.now();
                  const lastClick = lastClickRef.current[inv.id] || 0;
                  lastClickRef.current[inv.id] = now;
                  
                  const isFastClick = (now - lastClick < 350);
                  const isNativeDbl = e.domEvent && (e.domEvent as unknown as { detail?: number }).detail !== undefined && (e.domEvent as unknown as { detail: number }).detail >= 2;
                  
                  if (isFastClick || isNativeDbl) {
                    if (onInvoiceToggle) {
                      onInvoiceToggle(inv.id);
                    }
                  } else {
                    onInvoiceClick(inv);
                  }
                }}
              >
                {/* Custom interactive pin layout */}
                <div 
                  className={cn(
                    "cursor-pointer group relative transition-transform duration-300",
                    isSelected ? "scale-125 z-40" : "hover:scale-110 z-10"
                  )}
                  title={isCustomStop ? `${inv.client} (Double-click to remove, click to edit)` : `${inv.client} (Double-click to toggle, click to view details)`}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    if (isCustomStop) {
                      setStops(prev => prev.filter(s => s.id !== inv.id));
                    } else {
                      if (onInvoiceToggle) {
                        onInvoiceToggle(inv.id);
                      }
                    }
                  }}
                >
                  <Pin 
                    background={isSelected ? (isCustomStop ? '#4338ca' : '#f59e0b') : getStatusColor(inv.status)} 
                    glyphColor="#fff" 
                    borderColor={isSelected ? (isCustomStop ? '#312e81' : '#d97706') : getStatusBorderColor(inv.status)} 
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
                    {isCustomStop ? `${inv.client} (${inv.number})` : `${inv.client} (Inv: ${inv.number})`}
                    {isSelected && ` • Stop ${orderIndex + 1}`}
                  </div>
                </div>
              </AdvancedMarker>
            );
          })}

          {/* Warehouse Center marker */}
          {warehouse?.warehouseLat && warehouse?.warehouseLng && (
            <AdvancedMarker 
              key="warehouse-center-marker"
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
      </div>

      {/* Interactive Legend with dynamic filter toggle */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border-t border-zinc-200 justify-between shrink-0 select-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-zinc-400" />
            Filter Statuses:
          </span>
          {['partially_complete', 'draft', 'proposed', 'assembled', 'on_route'].map(status => {
            const isSelected = selectedLegendStatuses.length === 0 || selectedLegendStatuses.includes(status);
            const colorConfig = STATUS_COLORS[status] || { bg: '#71717a', border: '#3f3f46', label: status };
            const label = colorConfig.label;
            
            return (
              <button
                key={status}
                type="button"
                onClick={() => {
                  setSelectedLegendStatuses(prev => {
                    if (prev.includes(status)) {
                      return prev.filter(s => s !== status);
                    } else {
                      return [...prev, status];
                    }
                  });
                }}
                className={cn(
                  "px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95",
                  isSelected 
                    ? "text-white border-transparent" 
                    : "bg-white text-zinc-450 border-zinc-200 hover:text-zinc-650 hover:border-zinc-350 opacity-60 hover:opacity-90"
                )}
                style={{
                  backgroundColor: isSelected ? colorConfig.bg : undefined,
                  boxShadow: isSelected ? `0 2px 4px ${colorConfig.bg}30` : undefined
                }}
              >
                <span 
                  className="w-1.5 h-1.5 rounded-full shrink-0" 
                  style={{ backgroundColor: isSelected ? '#fff' : colorConfig.bg }} 
                />
                {label}
              </button>
            );
          })}
        </div>

        {selectedLegendStatuses.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedLegendStatuses([])}
            className="text-[10px] font-black uppercase text-red-500 hover:text-red-650 tracking-wider hover:underline px-2.5 py-1 leading-none border border-red-150 bg-red-50/50 rounded-lg shadow-sm font-bold scale-95 transition-all"
          >
            Show All
          </button>
        )}
      </div>
    </div>
  );
}

// Master status mapping helper
const STATUS_COLORS: { [key: string]: { bg: string; border: string; label: string } } = {
  'partially_complete': { bg: '#f43f5e', border: '#be123c', label: 'Partially Complete' },
  'partially complete': { bg: '#f43f5e', border: '#be123c', label: 'Partially Complete' },
  'loaded': { bg: '#f43f5e', border: '#be123c', label: 'Partially Complete' },
  'draft': { bg: '#94a3b8', border: '#475569', label: 'Draft' },
  'darft': { bg: '#94a3b8', border: '#475569', label: 'Draft' },
  'proposed': { bg: '#f97316', border: '#ea580c', label: 'Proposed' },
  'assembled': { bg: '#3b82f6', border: '#1d4ed8', label: 'Assembled' },
  'assembly': { bg: '#3b82f6', border: '#1d4ed8', label: 'Assembled' },
  'on-route': { bg: '#0ea5e9', border: '#0369a1', label: 'On Route' },
  'on route': { bg: '#0ea5e9', border: '#0369a1', label: 'On Route' },
  'on_route': { bg: '#0ea5e9', border: '#0369a1', label: 'On Route' },
  'delivered': { bg: '#0d9488', border: '#0f766e', label: 'Delivered' },
  'complete': { bg: '#10b981', border: '#047857', label: 'Complete' },
  'completed': { bg: '#10b981', border: '#047857', label: 'Complete' },
  'invoiced': { bg: '#10b981', border: '#047857', label: 'Complete' },
  'custom_stop': { bg: '#6366f1', border: '#4338ca', label: 'Waypoint' }
};

// Helper colors for pins
function getStatusColor(status: string) {
  const norm = (status || '').toLowerCase();
  return STATUS_COLORS[norm]?.bg || '#71717a';
}

function getStatusBorderColor(status: string) {
  const norm = (status || '').toLowerCase();
  return STATUS_COLORS[norm]?.border || '#3f3f46';
}

interface CustomStopModalProps {
  isOpen: boolean;
  onClose: () => void;
  stop: TripStop | null;
  onSave: (data: { location: string; type: string; startTime: string; endTime: string }) => void;
}

export function CustomStopModal({ isOpen, onClose, stop, onSave }: CustomStopModalProps) {
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Refuel');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (stop) {
      setLocation(stop.location || '');
      setType(stop.type || 'Refuel');
      setStartTime(stop.startTime || '');
      setEndTime(stop.endTime || '');
    } else {
      setLocation('');
      setType('Refuel');
      setStartTime('');
      setEndTime('');
    }
  }, [stop, isOpen]);

  const getStopDurationString = (start: string, end: string) => {
    if (!start || !end) return '';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    if (isNaN(diff) || diff < 0) return '0 mins';
    const totalMinutes = Math.floor(diff / 60000);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs === 0) return `${mins} mins`;
    if (mins === 0) return `${hrs} hours`;
    return `${hrs}h ${mins}m`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] text-zinc-900 animate-fade-in font-sans">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden border border-zinc-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div>
            <h3 className="font-sans font-black text-xs uppercase tracking-wider text-brand-primary">
              {stop ? 'Edit Custom Stop' : 'Add Custom Stop'}
            </h3>
            <p className="text-[10px] text-zinc-400 font-mono mt-0.5 uppercase">Specify waypoint parameters</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 px-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-4 h-4 text-zinc-500" />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="p-6 space-y-4 text-xs text-left">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 block">Stop Location Name</label>
            <GoogleMapsAutocomplete
              value={location}
              onChange={setLocation}
              placeholder="Search location (fuel stop, address, etc.)..."
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 block">Stop Category / Type</label>
            <select aria-label="Stop Category / Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-xl font-bold focus:ring-2 focus:ring-brand-accent/20 text-xs text-zinc-900 cursor-pointer"
            >
              <option value="Refuel">Refuel</option>
              <option value="Sleep">Sleep</option>
              <option value="Rest">Rest</option>
              <option value="Pickup">Pickup</option>
              <option value="Delivery">Delivery</option>
              <option value="Service">Service</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 block">Start Date & Time</label>
              <input aria-label="Start Date and Time"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-xs text-zinc-900"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 block">End Date & Time</label>
              <input aria-label="End Date and Time"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-xl font-bold text-xs text-zinc-900"
              />
            </div>
          </div>

          {startTime && endTime && (
            <div className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider inline-flex items-center gap-1.5 self-start">
              <Clock className="w-3.5 h-3.5 text-emerald-650" />
              Calculated Duration: {getStopDurationString(startTime, endTime)}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-200 hover:bg-zinc-250 rounded-xl text-zinc-700 font-bold transition-all cursor-pointer text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!location.trim()}
            onClick={() => {
              onSave({
                location,
                type,
                startTime,
                endTime
              });
              onClose();
            }}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/95 text-white rounded-xl font-black transition-all cursor-pointer text-xs disabled:opacity-50"
          >
            Save Stop
          </button>
        </div>
      </div>
    </div>
  );
}
