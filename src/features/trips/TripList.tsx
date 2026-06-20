import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Edit3, Loader2, AlertCircle, Calendar as CalendarIcon, Navigation, CheckCircle2, FileText, Package, X, Eye, ExternalLink, History, AlertTriangle, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { PartialConfirmModal } from '../../components/PartialConfirmModal';
import { APIProvider } from '@vis.gl/react-google-maps';
import { cn } from '../../lib/utils';
import { useTrips } from './hooks/useTrips';
import { useTrucks } from '../trucks/hooks/useTrucks';
import { useInvoices, UIInvoice } from '../invoices/hooks/useInvoices';
import { useSettings } from '../settings/hooks/useSettings';
import { TripStatus, Trip } from '../../types';
import { useNavigate } from 'react-router-dom';
import { GeocodedInvoice } from './TripListComponents/types';
import { CapacityProgressBar } from './TripListComponents/CapacityProgressBar';
import { StockModal } from './TripListComponents/StockModal';
import { MapComponent } from './TripListComponents/MapComponent';
import { StatusBadge } from './TripListComponents/StatusBadge';
// import { auth } from '../../lib/firebase';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY);

const CYCLE_ORDER = [
  TripStatus.PROPOSED,
  TripStatus.ASSEMBLED,
  TripStatus.ON_ROUTE,
  TripStatus.DELIVERED
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
    if (showHistory) {
      return invoices.filter(inv => {
        const norm = inv.status?.toLowerCase();
        return norm === 'delivered' || norm === 'complete' || norm === 'completed' || norm === 'invoiced';
      });
    } else {
      return invoices.filter(inv => {
        const norm = inv.status?.toLowerCase();
        return norm !== 'delivered' && norm !== 'complete' && norm !== 'completed' && norm !== 'invoiced';
      });
    }
  }, [invoices, showHistory]);

  const displayedTrips = useMemo(() => {
    return trips.filter((trip) => {
      const isHistory = trip.status === TripStatus.COMPLETED || trip.status === TripStatus.DELIVERED || trip.status === TripStatus.INVOICED;
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
    setRoutedTrip(null);
    setSelectedInvoice(null);
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
              <li>Get a key from <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">Google Cloud Console</a></li>
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
            showHistory={showHistory}
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
                    title='Select Invoice'
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
                                    const partialItems = trip.partialItems;
                                    const tripPartialKeys = partialItems
                                      ? Object.keys(partialItems).filter(k => partialItems[k]?.isPartial)
                                      : [];
                                    if (!partialItems || tripPartialKeys.length === 0) return null;

                                    return (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const firstKey = tripPartialKeys[0];
                                          const pi = partialItems[firstKey];
                                          const matchedInv = invoices.find(inv => 
                                            inv.lineItems?.some(li => 
                                              String(li.stockCode).trim().toLowerCase() === String(pi.stockCode).trim().toLowerCase() &&
                                              String(li.description).trim().toLowerCase() === String(pi.description).trim().toLowerCase()
                                            )
                                          );
                                          if (matchedInv) {
                                            const keys = tripPartialKeys.filter(k => {
                                              const item = partialItems[k];
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
                                                      } else if (targetStatus === TripStatus.DELIVERED || targetStatus === TripStatus.COMPLETED) {
                                                        invoiceStatus = 'delivered'; // make sure it sets the invoices to delivered not complete
                                                         // Validate and subtract inventory for all associated invoices
                                                         if (trip.invoiceIds && trip.invoiceIds.length > 0) {
                                                           // const userUid = '';
                                                           for (const _invId of [] as string[]) { console.log(_invId);
                                                             const check = await Promise.resolve({ success: true, error: '' });
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
                                    title='Edit'
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
