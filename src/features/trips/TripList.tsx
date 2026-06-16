import { useState, useEffect, Dispatch, SetStateAction, useRef, useMemo } from 'react';
import { Plus, Trash2, Edit3, Loader2, AlertCircle, Calendar as CalendarIcon, Navigation, Warehouse, CheckCircle2, Send, FileText, Package, X, Eye, ExternalLink, History, Filter, Clock, AlertTriangle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { PartialConfirmModal } from '../../components/PartialConfirmModal';
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
import { TripStatus, Trip, Settings } from '../../types';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { validateAndSubtractInventory } from '../../utils/inventory';
import { auth } from '../../lib/firebase';

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

const CYCLE_ORDER = [
  TripStatus.PROPOSED,
  TripStatus.ASSEMBLED,
  TripStatus.ON_ROUTE,
  TripStatus.COMPLETED
];

export function TripList() {
  const navigate = useNavigate();
  const { trips, loading: tripsLoading, deleteTrip, updateTrip } = useTrips();
  const { trucks } = useTrucks();
  const { invoices, updateInvoice, loading: invoicesLoading } = useInvoices();
  const { settings } = useSettings();

  // Inline cycling and confirmation state
  const [pendingStatuses, setPendingStatuses] = useState<{ [tripId: string]: TripStatus }>({});
  const [isPendingSubmitting, setIsPendingSubmitting] = useState<{ [tripId: string]: boolean }>({});

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

  const handleDeleteTrip = async (trip: Trip) => {
    try {
      await deleteTrip(trip.id);
      
      const remainingTrips = trips.filter(t => t.id !== trip.id && t.date === trip.date && t.truckId === trip.truckId);
      const sortedTrips = [...remainingTrips].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      
      const truck = trucks.find(t => t.id === trip.truckId);
      const truckName = truck ? truck.name : 'Truck';
      
      const [year, month, day] = trip.date.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayAbbrev = daysOfWeek[dateObj.getDay()];
      
      for (let i = 0; i < sortedTrips.length; i++) {
        const targetName = `${dayAbbrev} - ${truckName} - ${i + 1}`;
        if (sortedTrips[i].name !== targetName) {
          await updateTrip(sortedTrips[i].id, { name: targetName });
        }
      }
    } catch (err) {
      console.error('[TripList] Error deleting/re-sequencing trip:', err);
    }
  };
  
  const [geocodedInvoices, setGeocodedInvoices] = useState<GeocodedInvoice[]>(() => {
    try {
      const saved = localStorage.getItem('geocoded_invoices');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('[TripList] Error loading cached geocoded invoices:', e);
    }
    return [];
  });

  const [selectedInvoiceForStock, setSelectedInvoiceForStock] = useState<UIInvoice | null>(null);

  // Sync to localStorage on geocodedInvoices updates (keeping it clean of deleted invoices)
  useEffect(() => {
    if (geocodedInvoices.length > 0) {
      let toStore = geocodedInvoices;
      if (!invoicesLoading && invoices.length > 0) {
        toStore = geocodedInvoices.filter(gi => invoices.some(i => i.id === gi.id));
      }
      localStorage.setItem('geocoded_invoices', JSON.stringify(toStore));
    }
  }, [geocodedInvoices, invoices, invoicesLoading]);

  // Map state
  const [selectedInvoice, setSelectedInvoice] = useState<GeocodedInvoice | null>(null);

  // Resolve live state of selected invoice to prevent displaying stale status or details from local storage cache
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
    };
  }, [selectedInvoice, invoices]);
  const [routedTrip, setRoutedTrip] = useState<Trip | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [highlightedTripId, setHighlightedTripId] = useState<string | null>(null);

  const highlightedInvoiceIds = useMemo(() => {
    if (!highlightedTripId) return [];
    const trip = trips.find(t => t.id === highlightedTripId);
    return trip?.invoiceIds || [];
  }, [trips, highlightedTripId]);

  const activeInvoices = useMemo(() => {
    return invoices.filter(inv => inv.status?.toLowerCase() !== 'completed');
  }, [invoices]);

  const displayedTrips = useMemo(() => {
    return trips.filter((trip) => {
      const isHistory = trip.status === TripStatus.COMPLETED || trip.status === TripStatus.INVOICED;
      return showHistory ? isHistory : !isHistory;
    });
  }, [trips, showHistory]);

  const formatTripDateGroupHeader = (dateStr: string) => {
    if (!dateStr) return 'Unknown Date';
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const dateObj = new Date(year, month - 1, day);
      
      const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayAbbrev = daysOfWeek[dateObj.getDay()] || 'Day';
      
      const dd = String(day).padStart(2, '0');
      const mm = String(month).padStart(2, '0');
      const yyyy = year;
      
      return `${dayAbbrev} ${dd}-${mm}-${yyyy}`;
    } catch {
      return dateStr;
    }
  };

  // Groups of trips by date
  const groupedTripsByDate = useMemo(() => {
    const groups: Record<string, { trip: Trip; totalValue: number }[]> = {};
    
    displayedTrips.forEach((trip) => {
      const tripInvoices = invoices.filter(inv => trip.invoiceIds?.includes(inv.id));
      const totalValue = tripInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
      
      const dateKey = trip.date || 'no-date';
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push({ trip, totalValue });
    });

    // Sort trips in each date group from least value to most value
    Object.keys(groups).forEach((dateKey) => {
      groups[dateKey].sort((a, b) => a.totalValue - b.totalValue);
    });

    return groups;
  }, [displayedTrips, invoices]);

  // Sort groups by date: chronological for active, descending for history
  const sortedDateKeys = useMemo(() => {
    const keys = Object.keys(groupedTripsByDate);
    return keys.sort((a, b) => {
      if (showHistory) {
        return b.localeCompare(a); // history: newer first (descending)
      } else {
        return a.localeCompare(b); // active: chronological (ascending)
      }
    });
  }, [groupedTripsByDate, showHistory]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Date cards/groups per page

  useEffect(() => {
    setCurrentPage(1);
  }, [showHistory]);

  const totalPages = Math.ceil(sortedDateKeys.length / itemsPerPage);

  const paginatedDateKeys = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedDateKeys.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedDateKeys, currentPage, itemsPerPage]);

  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-zinc-50 rounded-2xl border border-dashed border-zinc-300">
        <div className="text-center max-w-md p-8">
          <AlertCircle className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Google Maps API Key Required</h2>
          <p className="text-zinc-500 mb-6">
            To view the trips map, please add your Google Maps Platform API key as a secret named <code>GOOGLE_MAPS_PLATFORM_KEY</code> in AI Studio.
          </p>
          <div className="text-left text-sm bg-white p-4 rounded-lg border border-zinc-200">
            <p className="font-semibold mb-2">Steps:</p>
            <ol className="list-decimal list-inside space-y-1 text-zinc-600">
              <li>Get a key from <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" className="text-brand-accent hover:underline">Google Cloud Console</a></li>
              <li>Open <strong>Settings</strong> → <strong>Secrets</strong></li>
              <li>Add <code>GOOGLE_MAPS_PLATFORM_KEY</code></li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-brand-primary tracking-tight uppercase">Trip Management</h1>
            <p className="text-zinc-500 text-sm">Visualize and manage your delivery logistics.</p>
          </div>
          <div className="flex gap-2">
            {routedTrip && (
              <button
                onClick={() => setRoutedTrip(null)}
                className="flex items-center gap-2 bg-zinc-100 text-zinc-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all border border-zinc-200"
              >
                Clear Route
              </button>
            )}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border",
                showHistory 
                  ? "bg-zinc-100 text-zinc-800 border-zinc-300 hover:bg-zinc-200 shadow-inner" 
                  : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
              )}
            >
              <History className="w-4.5 h-4.5 text-zinc-500" />
              {showHistory ? "View Active Trips" : "View History"}
            </button>
            <button
              onClick={() => navigate('/trips/new')}
              className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-brand-primary/90 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Create New Trip
            </button>
          </div>
        </div>

        {/* Map Section */}
        <div className="h-[460px] w-full rounded-2xl overflow-hidden shadow-lg border border-zinc-200 relative bg-zinc-100">
          <MapComponent 
            invoices={activeInvoices} 
            geocodedInvoices={geocodedInvoices}
            setGeocodedInvoices={setGeocodedInvoices}
            onInvoiceClick={setSelectedInvoice}
            warehouse={settings}
            routedTrip={routedTrip}
            highlightedInvoiceIds={highlightedInvoiceIds}
          />
        </div>

        {/* Selected Invoice Details Card */}
        {liveSelectedInvoice && (
           <div className="bg-white p-6 rounded-2xl shadow-xl border border-zinc-200 z-10 animate-in slide-in-from-top-4 duration-300 ring-4 ring-brand-primary/5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xl font-black text-brand-primary uppercase tracking-tight flex items-center gap-2">
                      <FileText className="w-5 h-5 text-brand-primary" strokeWidth={2.5} />
                      Invoice {liveSelectedInvoice.number}
                    </h4>
                    <span className="px-2 py-0.5 bg-brand-primary/5 text-brand-primary rounded-md text-[10px] font-black uppercase tracking-widest border border-brand-primary/10">
                      {liveSelectedInvoice.district || 'No District'}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 leading-relaxed">
                    <span>Delivery Address:</span>
                    <span className="text-zinc-800 normal-case font-extrabold">{liveSelectedInvoice.address}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => navigate(`/invoices/${liveSelectedInvoice.id}`)}
                    className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm group"
                  >
                    <Eye className="w-4 h-4" />
                    View Invoice
                    <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button 
                    onClick={() => setSelectedInvoice(null)}
                    className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Stock Items Section */}
              <div className="bg-zinc-50 rounded-2xl border border-zinc-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white rounded-lg border border-zinc-100 shadow-sm">
                      <Package className="w-3.5 h-3.5 text-brand-accent" />
                    </div>
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Stock Manifest</h5>
                  </div>
                  {liveSelectedInvoice.lineItems && liveSelectedInvoice.lineItems.length > 0 && (
                    <span className="text-[9px] font-black text-zinc-400 bg-white px-2 py-1 rounded-md border border-zinc-200">
                      {liveSelectedInvoice.lineItems.length} ITEMS
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(!liveSelectedInvoice.lineItems || liveSelectedInvoice.lineItems.length === 0) ? (
                    <div className="col-span-full py-8 text-center bg-white rounded-xl border border-dashed border-zinc-200">
                      <Package className="w-6 h-6 text-zinc-200 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">No stock items found</p>
                    </div>
                  ) : (
                    liveSelectedInvoice.lineItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-100 shadow-sm group hover:border-brand-accent/30 transition-all">
                        <div className="px-2 py-1 bg-brand-primary/5 rounded-lg font-mono text-[10px] font-black text-brand-primary border border-brand-primary/10">
                          {item.stockCode}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-zinc-800 truncate leading-tight group-hover:text-brand-primary transition-colors">{item.description}</p>
                          <p className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter mt-1">Qty: <span className="text-zinc-900">{item.qty}</span></p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
           </div>
        )}        {/* Trips Grouped by date in their own Cards */}
        {tripsLoading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-12 text-center">
            <Loader2 className="w-8 h-8 text-brand-accent animate-spin mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">Loading trips...</p>
          </div>
        ) : displayedTrips.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-12 text-center">
            <Navigation className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
            <p className="text-zinc-500 font-medium font-bold uppercase tracking-wide">
              {showHistory ? "No Invoiced Trips in History" : "No Active Trips Planned"}
            </p>
            {!showHistory && (
              <p className="text-zinc-400 text-xs mt-1">Create your first trip or toggle history to view past deliveries.</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {paginatedDateKeys.map((dateKey) => {
              const tripsInGroup = groupedTripsByDate[dateKey] || [];
              
              return (
                <div key={dateKey} className="bg-white rounded-3xl p-6 shadow-xs border border-zinc-200 space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                    <h3 className="text-sm font-black text-brand-primary tracking-tight uppercase flex items-center gap-2">
                      <CalendarIcon className="w-4.5 h-4.5 text-zinc-500" />
                      {formatTripDateGroupHeader(dateKey)}
                    </h3>
                    <span className="bg-zinc-100 text-zinc-800 font-black px-2.5 py-0.5 rounded-full text-[10px] tracking-wider font-sans uppercase border border-zinc-200">
                      {tripsInGroup.length} {tripsInGroup.length === 1 ? 'Trip' : 'Trips'}
                    </span>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-zinc-150 text-[10px] uppercase tracking-widest font-black text-zinc-400">
                          <th className="pb-3 px-4">Trip Name</th>
                          <th className="pb-3 px-4">Truck / Capacity</th>
                          <th className="pb-3 px-4">Invoices</th>
                          <th className="pb-3 px-4">Status</th>
                          <th className="pb-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {tripsInGroup.map(({ trip, totalValue }) => {
                          const truck = trucks.find(t => t.id === trip.truckId);
                          const isHighlighted = highlightedTripId === trip.id;
                          
                          return (
                            <tr 
                              key={trip.id} 
                              onClick={() => setHighlightedTripId(prev => prev === trip.id ? null : trip.id)}
                              className={cn(
                                "transition-colors group cursor-pointer border-l-4",
                                isHighlighted 
                                  ? "bg-amber-50/40 hover:bg-amber-50/60 border-l-amber-500" 
                                  : "hover:bg-zinc-50/50 border-l-transparent"
                              )}
                            >
                              <td className="px-4 py-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                  <span className="font-bold text-zinc-900">{trip.name}</span>
                                  {(() => {
                                    const tripPartialKeys = trip.partialItems 
                                      ? Object.keys(trip.partialItems).filter(k => trip.partialItems[k]?.isPartial)
                                      : [];
                                    if (tripPartialKeys.length === 0) return null;

                                    return (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const firstKey = tripPartialKeys[0];
                                          const pi = trip.partialItems[firstKey];
                                          const matchedInv = invoices.find(inv => 
                                            inv.lineItems?.some(li => 
                                              String(li.stockCode).trim().toLowerCase() === String(pi.stockCode).trim().toLowerCase() &&
                                              String(li.description).trim().toLowerCase() === String(pi.description).trim().toLowerCase()
                                            )
                                          );
                                          if (matchedInv) {
                                            const keys = tripPartialKeys.filter(k => {
                                              const item = trip.partialItems[k];
                                              return matchedInv.lineItems?.some(li => 
                                                String(li.stockCode).trim().toLowerCase() === String(item.stockCode).trim().toLowerCase() &&
                                                String(li.description).trim().toLowerCase() === String(item.description).trim().toLowerCase()
                                              );
                                            });
                                            setPartialModalData({
                                              isOpen: true,
                                              invoice: matchedInv,
                                              trip: trip,
                                              itemKeys: keys
                                            });
                                          } else {
                                            alert("Could not map the partial item to a loaded invoice.");
                                          }
                                        }}
                                        className="p-1 px-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-mono text-[9px] font-black uppercase rounded-lg flex items-center gap-1 inline-flex animate-pulse select-none shrink-0"
                                        title="Review and process partial split"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                        FLAGGED
                                      </button>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <div className="space-y-1.5 w-48">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-zinc-600 font-bold truncate max-w-[100px]">{truck?.name || 'Unknown Truck'}</span>
                                    <span className="text-zinc-400 font-mono font-medium">R {totalValue.toLocaleString()}</span>
                                  </div>
                                  <CapacityProgressBar current={totalValue} max={truck?.maxValue || 0} />
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-xs font-mono bg-zinc-100 px-2 py-1 rounded">
                                  {trip.invoiceIds?.length || 0} items
                                </span>
                              </td>
                              <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const pendingVal = pendingStatuses[trip.id];
                                    const hasPending = pendingVal !== undefined;
                                    const activeStatus = hasPending ? pendingVal : trip.status;
                                    const isSubmitting = isPendingSubmitting[trip.id] || false;

                                    const getNextStatus = (currentStatus: TripStatus): TripStatus => {
                                      const currentIndex = CYCLE_ORDER.indexOf(currentStatus);
                                      if (currentIndex === -1) {
                                        return TripStatus.PROPOSED;
                                      }
                                      const nextIndex = (currentIndex + 1) % CYCLE_ORDER.length;
                                      return CYCLE_ORDER[nextIndex];
                                    };

                                    return (
                                      <>
                                        <StatusBadge 
                                          status={activeStatus} 
                                          onClick={() => {
                                            if (isSubmitting) return;
                                            const currentActive = pendingStatuses[trip.id] !== undefined ? pendingStatuses[trip.id] : trip.status;
                                            const next = getNextStatus(currentActive);
                                            setPendingStatuses(prev => ({
                                              ...prev,
                                              [trip.id]: next
                                            }));
                                          }} 
                                        />
                                        
                                        {hasPending && (
                                          <div className="flex items-center gap-1.5 animate-fade-in shrink-0">
                                            {isSubmitting ? (
                                              <Loader2 className="w-4 h-4 text-brand-primary animate-spin shrink-0" />
                                            ) : (
                                              <>
                                                {/* Direct Confirm Button next to status badge */}
                                                <button
                                                  type="button"
                                                  onClick={async () => {
                                                    const targetStatus = pendingStatuses[trip.id];
                                                    if (!targetStatus) return;
                                                    setIsPendingSubmitting(prev => ({ ...prev, [trip.id]: true }));
                                                    try {
                                                      let invoiceStatus = 'proposed';
                                                      if (targetStatus === TripStatus.ASSEMBLED) {
                                                        invoiceStatus = 'assembled';
                                                      } else if (targetStatus === TripStatus.ON_ROUTE) {
                                                        invoiceStatus = 'on_route';
                                                      } else if (targetStatus === TripStatus.COMPLETED) {
                                                        invoiceStatus = 'delivered'; // make sure it sets the invoices to delivered not complete
                                                         // Validate and subtract inventory for all associated invoices
                                                         if (trip.invoiceIds && trip.invoiceIds.length > 0) {
                                                           const userUid = auth.currentUser?.uid || '';
                                                           for (const invId of trip.invoiceIds) {
                                                             const check = await validateAndSubtractInventory(invId, userUid);
                                                             if (!check.success) {
                                                               alert(`Cannot complete trip: ${check.error}`);
                                                               setIsPendingSubmitting(prev => ({ ...prev, [trip.id]: false }));
                                                               return;
                                                             }
                                                           }
                                                         }
                                                      }

                                                      // 1. Update Trip Status in Firestore
                                                      await updateTrip(trip.id, { 
                                                        status: targetStatus,
                                                        updatedAt: new Date().toISOString()
                                                      });

                                                      // 2. Update all associated Invoice Statuses to the matching status
                                                      if (trip.invoiceIds && trip.invoiceIds.length > 0) {
                                                        await Promise.all(
                                                          trip.invoiceIds.map(id => updateInvoice(id, { 
                                                            status: invoiceStatus,
                                                            updatedAt: new Date().toISOString()
                                                          }))
                                                        );
                                                      }

                                                      // Clear pending status
                                                      setPendingStatuses(prev => {
                                                        const updated = { ...prev };
                                                        delete updated[trip.id];
                                                        return updated;
                                                      });
                                                    } catch (err) {
                                                      console.error("Failed to update status directly:", err);
                                                    } finally {
                                                      setIsPendingSubmitting(prev => ({ ...prev, [trip.id]: false }));
                                                    }
                                                  }}
                                                  className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-sans text-[10px] font-black uppercase rounded-lg flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 animate-fade-in"
                                                  title="Confirm Status Update"
                                                >
                                                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                                  Confirm
                                                </button>

                                                {/* Cancel button */}
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setPendingStatuses(prev => {
                                                      const updated = { ...prev };
                                                      delete updated[trip.id];
                                                      return updated;
                                                    });
                                                  }}
                                                  className="p-1 hover:bg-zinc-100 border border-zinc-200 text-zinc-500 rounded-lg cursor-pointer transition-all animate-fade-in"
                                                  title="Cancel"
                                                >
                                                  <X className="w-3.5 h-3.5" />
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className={cn(
                                  "flex justify-end gap-2 transition-opacity duration-200",
                                  isHighlighted 
                                    ? "opacity-100 pointer-events-auto" 
                                    : "opacity-0 pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto"
                                )}>
                                  <button
                                    onClick={() => setRoutedTrip(trip)}
                                    title="Show Shortest Route"
                                    className={cn(
                                      "p-2 rounded-lg border transition-all",
                                      routedTrip?.id === trip.id 
                                        ? "text-brand-accent bg-brand-accent/10 border-brand-accent" 
                                        : "text-zinc-400 hover:text-brand-accent hover:bg-white border-transparent hover:border-zinc-200"
                                    )}
                                  >
                                    <Navigation className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => navigate(`/trips/edit/${trip.id}`)}
                                    className="p-2 text-zinc-400 hover:text-brand-primary hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                                  >
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                  {deleteConfirmId === trip.id ? (
                                    <button
                                      onClick={() => {
                                        handleDeleteTrip(trip);
                                        setDeleteConfirmId(null);
                                      }}
                                      className="p-2 text-white bg-red-500 rounded-lg border border-red-600 transition-all animate-pulse"
                                      title="Confirm Delete"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmId(trip.id)}
                                      className="p-2 text-zinc-400 hover:text-red-500 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                                      title="Delete Trip"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                  {deleteConfirmId === trip.id && (
                                    <button
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                                      title="Cancel"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border border-zinc-200 rounded-2xl bg-zinc-50/50">
                <span className="text-xs text-zinc-500 font-medium font-sans">
                  Showing <span className="font-bold text-zinc-800">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-zinc-800">{Math.min(currentPage * itemsPerPage, sortedDateKeys.length)}</span> of <span className="font-bold text-zinc-800">{sortedDateKeys.length}</span> date groups
                </span>
                <div className="flex gap-2 font-sans">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition cursor-pointer"
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
                            "w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg border transition cursor-pointer",
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
                    className="p-1.5 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}


        
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
              // Successfully processed, page will update via live subscription
            }}
          />
        )}


      </div>
    </APIProvider>
  );
}

function CapacityProgressBar({ current, max, height = "h-2", showLabel = false }: { current: number, max: number, height?: string, showLabel?: boolean }) {
  const percentage = max > 0 ? (current / max) * 100 : 0;
  const isOver = percentage > 100;
  
  // Professional color calculation
  const getBarColor = (pct: number) => {
    if (pct > 100) return "bg-red-500";
    if (pct > 90) return "bg-orange-500";
    if (pct > 75) return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-1.5 w-full">
      <div className={cn("w-full bg-zinc-200 rounded-full overflow-hidden", height)}>
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percentage, 100)}%` }}
          className={cn("h-full transition-all duration-500", getBarColor(percentage))}
        />
      </div>
      {(showLabel || isOver) && (
        <div className="flex justify-between items-center">
          <span className={cn(
            "text-[9px] font-black uppercase tracking-tighter",
            isOver ? "text-red-500" : "text-zinc-400"
          )}>
            {isOver ? "⚠️ OVER LIMIT" : `${Math.round(percentage)}% CAPACITY`}
          </span>
          {isOver && (
            <span className="text-[9px] font-mono text-red-500 font-bold">
              + R {(current - max).toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function StockModal({ invoice, onClose }: { invoice: UIInvoice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-xl font-black text-brand-primary uppercase tracking-tight">Stock Manifest</h3>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">
              {invoice.number} • {invoice.client}
            </p>
          </div>
          <button 
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
                <th className="pb-4 px-2">Code</th>
                <th className="pb-4 px-4">Description</th>
                <th className="pb-4 px-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {(!invoice.lineItems || invoice.lineItems.length === 0) ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-zinc-400 text-sm italic font-medium p-8">
                    <Package className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
                    No line items extracted for this invoice.
                  </td>
                </tr>
              ) : (
                invoice.lineItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="py-4 px-2 text-xs font-mono font-bold text-brand-primary">{item.stockCode}</td>
                    <td className="py-4 px-4 text-xs font-medium text-zinc-600">{item.description}</td>
                    <td className="py-4 px-2 text-xs font-black text-right tabular-nums bg-zinc-50 group-hover:bg-zinc-100 transition-colors w-20 rounded-lg">{item.qty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-zinc-100 bg-zinc-50/30 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-zinc-200 rounded-xl font-bold text-sm text-zinc-600 hover:bg-zinc-50 transition-all shadow-sm"
          >
            Close manifest
          </button>
        </div>
      </div>
    </div>
  );
}

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
  'invoiced': { bg: '#10b981', border: '#047857', label: 'Complete' }
};

function InvoicePin({ 
  status, 
  number, 
  isHighlighted, 
  isTripStop, 
  stopNumber 
}: { 
  status: string; 
  number: string; 
  isHighlighted?: boolean;
  isTripStop?: boolean;
  stopNumber?: number;
}) {
  const getStatusConfig = (statusName: string) => {
    if (isTripStop) {
      return {
        background: '#F59E0B', // Highlight/Selected Amber
        borderColor: '#B45309', // Dark Amber
        icon: (
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#B45309] font-black text-[11px] font-mono shadow-sm">
            {stopNumber}
          </div>
        )
      };
    }
    if (isHighlighted) {
      return {
        background: '#EF4444', // Highlight Red
        borderColor: '#991B1B', // Dark Red
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-white" />
      };
    }
    const norm = (statusName || '').toLowerCase();
    const config = STATUS_COLORS[norm] || { bg: '#71717a', border: '#3f3f46' };
    
    // Choose icon based on status
    let icon = <FileText className="w-3 h-3 text-white" />;
    if (norm === 'complete' || norm === 'completed' || norm === 'delivered' || norm === 'invoiced') {
      icon = <CheckCircle2 className="w-3 h-3 text-white" />;
    } else if (norm === 'on-route' || norm === 'on route' || norm === 'on_route') {
      icon = <Send className="w-3 h-3 text-white" />;
    } else if (norm === 'assembled' || norm === 'assembly') {
      icon = <Package className="w-3 h-3 text-white" />;
    } else if (norm === 'proposed') {
      icon = <Clock className="w-3.5 h-3.5 text-white" />;
    } else if (norm === 'partially_complete' || norm === 'partially complete' || norm === 'loaded') {
      icon = <AlertCircle className="w-3 h-3 text-white" />;
    }
    
    return {
      background: config.bg,
      borderColor: config.border,
      icon
    };
  };

  const config = getStatusConfig(status);

  return (
    <Pin background={config.background} glyphColor="#fff" borderColor={config.borderColor} scale={(isTripStop || isHighlighted) ? 1.4 : 1.2}>
      <div className="flex flex-col items-center gap-0.5">
        {config.icon}
        <span className="text-[7px] font-black text-white uppercase leading-none">{number.slice(-3)}</span>
      </div>
    </Pin>
  );
}

function MapComponent({ invoices, geocodedInvoices, setGeocodedInvoices, onInvoiceClick, warehouse, routedTrip, highlightedInvoiceIds }: { 
  invoices: UIInvoice[], 
  geocodedInvoices: GeocodedInvoice[], 
  setGeocodedInvoices: Dispatch<SetStateAction<GeocodedInvoice[]>>,
  onInvoiceClick: (inv: GeocodedInvoice) => void,
  warehouse: Settings | null,
  routedTrip: Trip | null,
  highlightedInvoiceIds: string[]
}) {
  const map = useMap();
  const geocodingLib = useMapsLibrary('geocoding');
  const routesLib = useMapsLibrary('routes');
  const processingIds = useRef<Set<string>>(new Set());
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);

  // Filter state for dynamic legend clicks
  const [selectedLegendStatuses, setSelectedLegendStatuses] = useState<string[]>([]);

  // Automatically reset selectedLegendStatuses to empty when a new routedTrip is activated
  const prevRoutedTripIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = routedTrip?.id || null;
    if (currentId !== prevRoutedTripIdRef.current) {
      prevRoutedTripIdRef.current = currentId;
      if (currentId) {
        setSelectedLegendStatuses([]);
      }
    }
  }, [routedTrip]);

  useEffect(() => {
    if (!map || !routesLib || !routedTrip || !warehouse?.warehouseLat) {
      if (directionsRenderer.current) {
        directionsRenderer.current.setMap(null);
      }
      return;
    }

    const calculateRoute = async () => {
      // Sort trip invoices according to the order of routedTrip.invoiceIds exactly
      const tripInvoices = geocodedInvoices
        .filter(gi => routedTrip.invoiceIds?.includes(gi.id))
        .sort((a, b) => {
          const indexA = routedTrip.invoiceIds?.indexOf(a.id) ?? 0;
          const indexB = routedTrip.invoiceIds?.indexOf(b.id) ?? 0;
          return indexA - indexB;
        });

      if (tripInvoices.length === 0) return;

      const directionsService = new routesLib.DirectionsService();
      
      if (!directionsRenderer.current) {
        directionsRenderer.current = new routesLib.DirectionsRenderer({
          map,
          suppressMarkers: true, // Suppress default icons so our high-fidelity pin sequence numbers are not duplicated/overlapped
          polylineOptions: {
            strokeColor: '#f59e0b',
            strokeWeight: 5,
            strokeOpacity: 0.8
          }
        });
      } else {
        directionsRenderer.current.setMap(map);
        directionsRenderer.current.setOptions({ suppressMarkers: true });
      }

      const origin = { lat: warehouse.warehouseLat!, lng: warehouse.warehouseLng! };
      
      const waypoints = tripInvoices.map(inv => ({
        location: inv.position,
        stopover: true
      }));

      try {
        const result = await directionsService.route({
          origin: origin,
          destination: origin,
          waypoints: waypoints,
          optimizeWaypoints: false, // Maintain exact trip stop sequence sequence order as defined in the trip
          travelMode: google.maps.TravelMode.DRIVING
        });

        directionsRenderer.current.setDirections(result);
      } catch (err) {
        console.error("Directions request failed:", err);
      }
    };

    calculateRoute();
  }, [map, routesLib, routedTrip, warehouse, geocodedInvoices]);

  useEffect(() => {
    if (!geocodingLib || !invoices.length) return;

    const invoicesToGeocode = invoices.filter((inv) => 
      !geocodedInvoices.some((gi) => gi.id === inv.id) && 
      !processingIds.current.has(inv.id)
    );

    if (invoicesToGeocode.length === 0) return;

    // Mark as processing
    invoicesToGeocode.forEach(inv => processingIds.current.add(inv.id));

    // Batch geocoding
    const geocodeInvoices = async () => {
      const results: GeocodedInvoice[] = [];
      for (const inv of invoicesToGeocode) {
        // Construct a searchable address
        const fullAddress = [
          inv.deliveryAddressLine1,
          inv.deliveryAddressLine2,
          inv.district,
          'South Africa'
        ].filter(Boolean).join(', ');

        if (!fullAddress || fullAddress.length < 5) {
          // If no specific address, at least try customer name + district
          const fallbackAddress = [inv.client, inv.district, 'South Africa'].filter(Boolean).join(', ');
          try {
            const { results: fallbackResults } = await new geocodingLib.Geocoder().geocode({ 
              address: fallbackAddress 
            });
            if (fallbackResults && fallbackResults[0]) {
               results.push({
                id: inv.id,
                number: inv.number,
                client: inv.client,
                status: inv.status,
                address: fallbackResults[0].formatted_address,
                position: {
                  lat: fallbackResults[0].geometry.location.lat(),
                  lng: fallbackResults[0].geometry.location.lng()
                },
                district: inv.district,
                lineItems: inv.lineItems
              });
            }
          } catch {
            console.error(`Fallback geocoding failed for ${inv.number}`);
          }
          continue;
        }

        try {
          const { results: geoResults } = await new geocodingLib.Geocoder().geocode({ 
            address: fullAddress 
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

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-1 min-h-0 relative">
        <Map
          defaultCenter={{ lat: -25.7479, lng: 28.2293 }} // Pretoria/Centurion area
          defaultZoom={11}
          mapId="INVOICE_MAP"
          style={{ width: '100%', height: '100%' }}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        >
          {geocodedInvoices.filter(gi => {
            // Hide pins on the map when the invoice status is completed
            const actualInvoice = invoices.find(inv => inv.id === gi.id);
            const liveStatus = (actualInvoice?.status || gi.status || '').toLowerCase();
            if (liveStatus === 'completed' || liveStatus === 'complete' || liveStatus === 'invoiced') {
              return false;
            }

            // Legend multi-select filter logic
            const statusKey = (liveStatus === 'assembly' ? 'assembled' : 
                               (liveStatus === 'loaded' ? 'partially_complete' : 
                                (liveStatus === 'partially complete' ? 'partially_complete' : 
                                 (liveStatus === 'completed' || liveStatus === 'invoiced' ? 'complete' : liveStatus)))).toLowerCase();
            
            const isTripStop = Boolean(routedTrip && routedTrip.invoiceIds?.includes(gi.id));
            if (routedTrip) {
              // 1. "Selected trip stop" pins are always shown
              if (isTripStop) return true;

              // 2. Other pins are shown only if their status is explicitly toggled ON in selectedLegendStatuses
              return selectedLegendStatuses.includes(statusKey);
            } else {
              // Standard behavior of the legend multi-select
              if (selectedLegendStatuses.length > 0 && !selectedLegendStatuses.includes(statusKey)) {
                return false;
              }
            }

            return gi.status?.toLowerCase() !== 'completed';
          }).map((inv) => {
            const actualInvoice = invoices.find(i => i.id === inv.id);
            const liveStatus = actualInvoice?.status || inv.status;
            const liveNumber = actualInvoice?.number || inv.number;
            const liveClient = actualInvoice?.client || inv.client;
            const liveLineItems = actualInvoice?.lineItems || inv.lineItems;
            const liveDistrict = actualInvoice?.district || inv.district;
            
            const isTripStop = Boolean(routedTrip && routedTrip.invoiceIds?.includes(inv.id));
            const stopNumber = isTripStop && routedTrip ? routedTrip.invoiceIds.indexOf(inv.id) + 1 : undefined;
            
            return (
              <AdvancedMarker 
                key={inv.id} 
                position={inv.position}
                onClick={() => onInvoiceClick({ 
                  ...inv, 
                  status: liveStatus,
                  number: liveNumber,
                  client: liveClient,
                  lineItems: liveLineItems,
                  district: liveDistrict
                })}
              >
                <InvoicePin 
                  status={liveStatus} 
                  number={liveNumber} 
                  isHighlighted={highlightedInvoiceIds.includes(inv.id)}
                  isTripStop={isTripStop}
                  stopNumber={stopNumber}
                />
              </AdvancedMarker>
            );
          })}

          {warehouse?.warehouseLat && warehouse?.warehouseLng && (
            <AdvancedMarker 
              position={{ lat: warehouse.warehouseLat, lng: warehouse.warehouseLng }}
            >
               <Pin background="#1e1b4b" glyphColor="#fff" borderColor="#312e81" scale={1.5}>
                  <Warehouse className="w-4 h-4 text-white" />
               </Pin>
            </AdvancedMarker>
          )}
        </Map>
      </div>

      {/* Dynamic Filter Status Legend under Map */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white border-t border-zinc-200 justify-between shrink-0 select-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3 text-zinc-400" />
            Filter Statuses:
          </span>
          {(routedTrip || highlightedInvoiceIds.length > 0) && (
            <div
              className="px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 shadow-sm text-white border-transparent"
              style={{
                backgroundColor: '#F59E0B',
                boxShadow: '0 2px 4px #F59E0B30'
              }}
            >
              <CheckCircle2 className="w-3 h-3 text-white" />
              Selected Trip Stop
            </div>
          )}
          {['partially_complete', 'draft', 'proposed', 'assembled', 'on_route', 'delivered', 'complete'].map(status => {
            const isSelected = routedTrip 
              ? selectedLegendStatuses.includes(status)
              : (selectedLegendStatuses.length === 0 || selectedLegendStatuses.includes(status));
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
                    : "bg-white text-zinc-400 border-zinc-200 hover:text-zinc-650 hover:border-zinc-350 opacity-60 hover:opacity-90"
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

function StatusBadge({ status, onClick }: { status: TripStatus; onClick?: () => void }) {
  const styles = {
    [TripStatus.PROPOSED]: "bg-blue-50 text-blue-600 border-blue-100",
    [TripStatus.ASSEMBLED]: "bg-indigo-50 text-indigo-600 border-indigo-100",
    [TripStatus.ON_ROUTE]: "bg-amber-50 text-amber-600 border-amber-100",
    [TripStatus.PARTIALLY_COMPLETED]: "bg-sky-50 text-sky-600 border-sky-100",
    [TripStatus.COMPLETED]: "bg-emerald-50 text-emerald-600 border-emerald-100",
    [TripStatus.INVOICED]: "bg-zinc-100 text-zinc-600 border-zinc-200"
  };

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border whitespace-nowrap transition-all text-left",
        styles[status],
        onClick ? "cursor-pointer hover:shadow-sm hover:scale-105 active:scale-95 hover:bg-opacity-80" : ""
      )}
      title={onClick ? "Click to toggle next status" : undefined}
    >
      {status.replace(/-/g, ' ')}
    </button>
  );
}
