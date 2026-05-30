import { useState, useEffect, Dispatch, SetStateAction, useRef, useMemo } from 'react';
import { Plus, Trash2, Edit3, Loader2, AlertCircle, Calendar as CalendarIcon, Navigation, Warehouse, CheckCircle2, Send, FileText, Package, X, Eye, ExternalLink, History } from 'lucide-react';
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

export function TripList() {
  const navigate = useNavigate();
  const { trips, loading: tripsLoading, deleteTrip, updateTrip } = useTrips();
  const { trucks } = useTrucks();
  const { invoices, updateInvoice } = useInvoices();
  const { settings } = useSettings();
  
  const [geocodedInvoices, setGeocodedInvoices] = useState<GeocodedInvoice[]>([]);
  const [selectedInvoiceForStock, setSelectedInvoiceForStock] = useState<UIInvoice | null>(null);

  // Map state
  const [selectedInvoice, setSelectedInvoice] = useState<GeocodedInvoice | null>(null);
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

  const handleStatusClick = async (trip: Trip) => {
    const statuses = [
      TripStatus.PROPOSED,
      TripStatus.ASSEMBLED,
      TripStatus.ON_ROUTE,
      TripStatus.PARTIALLY_COMPLETED,
      TripStatus.COMPLETED,
      TripStatus.INVOICED
    ];
    const currentIndex = statuses.indexOf(trip.status);
    const nextIndex = (currentIndex + 1) % statuses.length;
    const nextStatus = statuses[nextIndex];

    await updateTrip(trip.id, { status: nextStatus });

    // When status changes to COMPLETED, update all invoices on this trip to 'completed'
    if (nextStatus === TripStatus.COMPLETED) {
      if (trip.invoiceIds && trip.invoiceIds.length > 0) {
        await Promise.all(
          trip.invoiceIds.map(id => updateInvoice(id, { status: 'completed' }))
        );
      }
    }
  };

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
        <div className="h-[400px] w-full rounded-2xl overflow-hidden shadow-lg border border-zinc-200 relative bg-zinc-100">
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
        {selectedInvoice && (
           <div className="bg-white p-6 rounded-2xl shadow-xl border border-zinc-200 z-10 animate-in slide-in-from-top-4 duration-300 ring-4 ring-brand-primary/5">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xl font-black text-brand-primary uppercase tracking-tight flex items-center gap-2">
                      <FileText className="w-5 h-5 text-brand-primary" strokeWidth={2.5} />
                      Invoice {selectedInvoice.number}
                    </h4>
                    <span className="px-2 py-0.5 bg-brand-primary/5 text-brand-primary rounded-md text-[10px] font-black uppercase tracking-widest border border-brand-primary/10">
                      {selectedInvoice.district || 'No District'}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 leading-relaxed">
                    <span>Delivery Address:</span>
                    <span className="text-zinc-800 normal-case font-extrabold">{selectedInvoice.address}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => navigate(`/invoices/${selectedInvoice.id}`)}
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
                  {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 && (
                    <span className="text-[9px] font-black text-zinc-400 bg-white px-2 py-1 rounded-md border border-zinc-200">
                      {selectedInvoice.lineItems.length} ITEMS
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(!selectedInvoice.lineItems || selectedInvoice.lineItems.length === 0) ? (
                    <div className="col-span-full py-8 text-center bg-white rounded-xl border border-dashed border-zinc-200">
                      <Package className="w-6 h-6 text-zinc-200 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">No stock items found</p>
                    </div>
                  ) : (
                    selectedInvoice.lineItems.map((item, idx) => (
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
        )}

        {/* Trips Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase tracking-widest font-black text-zinc-400">
                  <th className="px-6 py-4">Trip Name</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Truck / Capacity</th>
                  <th className="px-6 py-4">Invoices</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {tripsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-8 h-8 text-brand-accent animate-spin mx-auto mb-2" />
                      <p className="text-zinc-500 text-sm">Loading trips...</p>
                    </td>
                  </tr>
                ) : displayedTrips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Navigation className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                      <p className="text-zinc-500 font-medium font-bold uppercase tracking-wide">
                        {showHistory ? "No Invoiced Trips in History" : "No Active Trips Planned"}
                      </p>
                      {!showHistory && (
                        <p className="text-zinc-400 text-xs mt-1">Create your first trip or toggle history to view past deliveries.</p>
                      )}
                    </td>
                  </tr>
                ) : (
                  displayedTrips.map((trip) => {
                    const truck = trucks.find(t => t.id === trip.truckId);
                    const tripInvoices = invoices.filter(inv => trip.invoiceIds?.includes(inv.id));
                    const totalValue = tripInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
                    const isHighlighted = highlightedTripId === trip.id;
                    
                    return (
                      <tr 
                        key={trip.id} 
                        onClick={() => setHighlightedTripId(prev => prev === trip.id ? null : trip.id)}
                        className={cn(
                          "transition-colors group cursor-pointer border-l-4",
                          isHighlighted 
                            ? "bg-emerald-50/40 hover:bg-emerald-50/60 border-l-emerald-500" 
                            : "hover:bg-zinc-50/50 border-l-transparent"
                        )}
                      >
                        <td className="px-6 py-4">
                          <span className="font-bold text-zinc-900">{trip.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-zinc-600 text-sm">
                            <CalendarIcon className="w-3 h-3" />
                            {trip.date}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1.5 w-48">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="text-zinc-600 font-bold truncate max-w-[100px]">{truck?.name || 'Unknown Truck'}</span>
                              <span className="text-zinc-400 font-mono">R {totalValue.toLocaleString()}</span>
                            </div>
                            <CapacityProgressBar current={totalValue} max={truck?.maxValue || 0} />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-mono bg-zinc-100 px-2 py-1 rounded">
                            {trip.invoiceIds?.length || 0} items
                          </span>
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <StatusBadge 
                            status={trip.status} 
                            onClick={() => handleStatusClick(trip)} 
                          />
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                                  deleteTrip(trip.id);
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>


        
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

function InvoicePin({ status, number, isHighlighted }: { status: string; number: string; isHighlighted?: boolean }) {
  const getStatusConfig = (status: string) => {
    if (isHighlighted) {
      return {
        background: '#22c55e', // Vibrant Green 500
        borderColor: '#15803d', // Green 700
        icon: <CheckCircle2 className="w-3 h-3 text-white" />
      };
    }
    switch (status.toLowerCase()) {
      case 'paid':
        return {
          background: '#10b981', // Emerald 500
          borderColor: '#047857', // Emerald 700
          icon: <CheckCircle2 className="w-3 h-3 text-white" />
        };
      case 'overdue':
        return {
          background: '#ef4444', // Red 500
          borderColor: '#b91c1c', // Red 700
          icon: <AlertCircle className="w-3 h-3 text-white" />
        };
      case 'sent':
        return {
          background: '#3b82f6', // Blue 500
          borderColor: '#1d4ed8', // Blue 700
          icon: <Send className="w-3 h-3 text-white" />
        };
      default:
        return {
          background: '#71717a', // Zinc 500
          borderColor: '#3f3f46', // Zinc 700
          icon: <FileText className="w-3 h-3 text-white" />
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Pin background={config.background} glyphColor="#fff" borderColor={config.borderColor} scale={isHighlighted ? 1.4 : 1.2}>
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

  useEffect(() => {
    if (!map || !routesLib || !routedTrip || !warehouse?.warehouseLat) {
      if (directionsRenderer.current) {
        directionsRenderer.current.setMap(null);
      }
      return;
    }

    const calculateRoute = async () => {
      const tripInvoices = geocodedInvoices.filter(gi => 
        routedTrip.invoiceIds?.includes(gi.id)
      );

      if (tripInvoices.length === 0) return;

      const directionsService = new routesLib.DirectionsService();
      
      if (!directionsRenderer.current) {
        directionsRenderer.current = new routesLib.DirectionsRenderer({
          map,
          suppressMarkers: false,
          polylineOptions: {
            strokeColor: '#f59e0b',
            strokeWeight: 5,
            strokeOpacity: 0.8
          }
        });
      } else {
        directionsRenderer.current.setMap(map);
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
          optimizeWaypoints: true,
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
        if (actualInvoice && actualInvoice.status?.toLowerCase() === 'completed') {
          return false;
        }
        return gi.status?.toLowerCase() !== 'completed';
      }).map((inv) => (
        <AdvancedMarker 
          key={inv.id} 
          position={inv.position}
          onClick={() => onInvoiceClick(inv)}
        >
          <InvoicePin 
            status={inv.status} 
            number={inv.number} 
            isHighlighted={highlightedInvoiceIds.includes(inv.id)}
          />
        </AdvancedMarker>
      ))}

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
