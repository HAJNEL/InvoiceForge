import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Edit3, Loader2, AlertCircle, Calendar as CalendarIcon, Navigation, CheckCircle2, Package, X, History, AlertTriangle, Check, ChevronLeft, ChevronRight, RefreshCw, Search, Maximize2, Minimize2, MapPin, ClipboardList, Send } from 'lucide-react';
import { toast } from 'sonner';
import { PartialConfirmModal } from '../../components/PartialConfirmModal';
import { PartialConfirmModalMobile } from '../../components/PartialConfirmModalMobile';
import { APIProvider } from '@vis.gl/react-google-maps';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useTrips } from './hooks/useTrips';
import { useTrucks } from '../trucks/hooks/useTrucks';
import { useInvoices, UIInvoice } from '../invoices/hooks/useInvoices';
import { useSettings } from '../settings/hooks/useSettings';
import { useAuth } from '../../core/hooks/useAuth';
import { useDayPlanners } from './hooks/useDayPlanners';
import { TripStatus, Trip } from '../../types';
import { useNavigate } from 'react-router-dom';
import { GeocodedInvoice } from './TripListComponents/types';
import { CapacityProgressBar } from './TripListComponents/CapacityProgressBar';
import { StockModal } from './TripListComponents/StockModal';
import { StockModalMobile } from './TripListComponents/StockModalMobile';
import { MapComponent } from './TripListComponents/MapComponent';
import { StatusBadge } from './TripListComponents/StatusBadge';
import { InvoiceDetailsPanel } from './TripListComponents/InvoiceDetailsPanel';
import { DayPlannerModal } from './TripListComponents/DayPlannerModal';
import { DayPlannerModalMobile } from './TripListComponents/DayPlannerModalMobile';
import { TripListMobile } from './TripListComponents/TripListMobile';
import { restoreInventoryForItems } from '../../utils/inventory';
import { buildSchoolLookupAddress, buildPinSearchAddress, geocodeAddress } from '../../lib/geocoding';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY);

const CYCLE_ORDER = [
  TripStatus.PENDING,
  TripStatus.PROPOSED,
  TripStatus.ASSEMBLED,
  TripStatus.ON_ROUTE,
  TripStatus.DELIVERED
];

const needsInventoryRestore = (status: string) =>
  status === TripStatus.ASSEMBLED ||
  status === TripStatus.ON_ROUTE ||
  status === TripStatus.DELIVERED;

// Shared "Map Pin Filters" controls, reused in both the standard map panel and the
// fullscreen map's top bar so filtering behaves identically in either view.
function MapPinFiltersControls({
  searchTerm, setSearchTerm,
  lineItemFilter, setLineItemFilter,
  selectedDistrict, setSelectedDistrict,
  selectedStatus, setSelectedStatus,
  districtsList, showHistory
}: {
  searchTerm: string; setSearchTerm: (v: string) => void;
  lineItemFilter: string; setLineItemFilter: (v: string) => void;
  selectedDistrict: string; setSelectedDistrict: (v: string) => void;
  selectedStatus: string; setSelectedStatus: (v: string) => void;
  districtsList: string[]; showHistory: boolean;
}) {
  return (
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

      {/* Line Item Search */}
      <div className="relative w-full md:w-48">
        <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
        <input
          type="text"
          placeholder="Filter line item..."
          value={lineItemFilter}
          onChange={(e) => setLineItemFilter(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
        />
      </div>

      {/* District Dropdown */}
      <select
        title="Filter by district"
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
        title="Filter by status"
        value={selectedStatus}
        onChange={(e) => setSelectedStatus(e.target.value)}
        className="text-xs bg-white border border-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 w-fit"
      >
        <option value="all">All Statuses</option>
        <option value="partially_complete">Partially Complete</option>
        <option value="draft">Draft</option>
        <option value="pending">Pending</option>
        <option value="proposed">Proposed</option>
        <option value="assembled">Assembled</option>
        <option value="on_route">On Route</option>
        {showHistory && <option value="complete">Delivered / Complete</option>}
      </select>

      {/* Clear filters shortcut */}
      {(searchTerm || lineItemFilter || selectedDistrict !== 'all' || selectedStatus !== 'all') && (
        <button
          type="button"
          title="Reset map pin filters"
          onClick={() => {
            setSearchTerm('');
            setLineItemFilter('');
            setSelectedDistrict('all');
            setSelectedStatus('all');
          }}
          className="text-[10px] font-black uppercase text-red-500 hover:text-red-600 tracking-wider hover:underline shrink-0"
        >
          Reset
        </button>
      )}
    </div>
  );
}

export function TripList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trips, loading: tripsLoading, deleteTrip, updateTrip } = useTrips();
  const { trucks } = useTrucks();
  const { invoices, updateInvoice, loading: invoicesLoading } = useInvoices();
  const { settings } = useSettings();
  // Orphan-planner cleanup (no trips left for a date) lives centrally in useDayPlanners
  // so it applies wherever planners are read from, not just this screen.
  const { planners, saveEntries: savePlannerEntries, moveEntries: movePlannerEntries } = useDayPlanners();
  const [plannerModalDate, setPlannerModalDate] = useState<string | null>(null);
  // Recorded on planner entries when the account owner ticks them, so it's clear who
  // completed it even when that's the owner themselves (not just team members).
  const ownerDisplayName = user?.displayName || user?.email?.split('@')[0] || 'Account Owner';

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
      if (needsInventoryRestore(trip.status) && trip.invoiceIds?.length) {
        const itemMap: Record<string, { stockCode: string; qty: number }> = {};
        trip.invoiceIds.forEach(id => {
          const inv = invoices.find(i => i.id === id);
          inv?.lineItems?.forEach(li => {
            const code = String(li.stockCode || '').trim().toUpperCase();
            if (!code || code === 'N/A') return;
            if (itemMap[code]) {
              itemMap[code].qty += li.qty;
            } else {
              itemMap[code] = { stockCode: li.stockCode, qty: li.qty };
            }
          });
        });
        await restoreInventoryForItems(Object.values(itemMap), user?.uid || '');
      }

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

  const [isRefreshingPins, setIsRefreshingPins] = useState(false);
  const prevGeocodedCountRef = useRef(0);

  // Re-pins every invoice. For invoices without a manually-entered delivery
  // address it re-looks-up the school name on Google Maps and writes the fresh
  // result back onto the invoice (`deliveryAddress`). Invoices whose delivery
  // address was set by hand (`deliveryAddressManual`) are preserved: their pin is
  // rebuilt from that address but the stored address is never overwritten.
  // The invoice write happens BEFORE the pin is committed so that once Firestore's
  // snapshot reflects the new `deliveryAddress`, the map's own staleness check sees
  // the pin as already up-to-date (searchAddress === deliveryAddress) and doesn't
  // immediately re-geocode it.
  const handleRefreshPins = async () => {
    localStorage.removeItem('geocoded_invoices');
    setGeocodedInvoices([]);
    prevGeocodedCountRef.current = 0;
    setIsRefreshingPins(true);

    // Biases geocoding toward the warehouse's region so a same-named school in
    // another province doesn't outrank the real, nearby one (see geocoding.ts).
    const warehouseBias = settings?.warehouseLat !== undefined && settings?.warehouseLng !== undefined
      ? { lat: settings.warehouseLat, lng: settings.warehouseLng }
      : undefined;

    const toRefresh = [...invoices];
    for (const inv of toRefresh) {
      const manualAddress = inv.deliveryAddressManual ? inv.deliveryAddress?.trim() : '';

      // Manual override: geocode the saved address as-is (don't touch the school).
      // Otherwise force the school-name lookup so an outdated saved address gets
      // refreshed to the latest Google result.
      const lookupAddress = manualAddress || buildSchoolLookupAddress(inv) || buildPinSearchAddress(inv);
      let geo = await geocodeAddress(lookupAddress, warehouseBias);
      // If the primary search found nothing, fall back to the full priority chain
      // (delivery address, street address, then client name).
      if (!geo && lookupAddress !== buildPinSearchAddress(inv)) {
        geo = await geocodeAddress(buildPinSearchAddress(inv), warehouseBias);
      }

      if (geo) {
        // Only auto-managed invoices get their stored deliveryAddress rewritten;
        // a manual override is left exactly as the user entered it.
        if (!manualAddress) {
          // Persist first (latency-compensated snapshot updates almost immediately).
          await updateInvoice(inv.id, { deliveryAddress: geo.formattedAddress, deliveryAddressManual: false });
        }

        const pin: GeocodedInvoice = {
          id: inv.id,
          number: inv.number,
          client: inv.client,
          status: inv.status,
          address: geo.formattedAddress,
          // Keep searchAddress equal to whatever buildPinSearchAddress will return
          // for this invoice, so the map doesn't consider the fresh pin stale.
          searchAddress: manualAddress || geo.formattedAddress,
          position: geo.position,
          district: inv.district,
          lineItems: inv.lineItems,
        };
        setGeocodedInvoices((prev) => [...prev.filter(p => p.id !== pin.id), pin]);
      }

      // Match MapComponent's request pacing to stay under Google's rate limits.
      await new Promise(r => setTimeout(r, 200));
    }

    // If nothing resolved, the settle-timer effect never fires (count stayed 0),
    // so clear the overlay here.
    setGeocodedInvoices((prev) => {
      if (prev.length === 0) setIsRefreshingPins(false);
      return prev;
    });
  };

  const [selectedInvoiceForStock, setSelectedInvoiceForStock] = useState<UIInvoice | null>(null);

  // Map Pin Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [lineItemFilter, setLineItemFilter] = useState('');

  // Sort order for the mobile trip list
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'value'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fullscreen map mode: shows the same pin filters plus a left sidebar with the
  // selected invoice's details, instead of the details card below the map.
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // Lock body scroll and allow Escape to exit while the fullscreen map is open
  useEffect(() => {
    if (!isMapFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMapFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMapFullscreen]);

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

  // Detect when a refresh-triggered geocoding batch has settled
  const refreshSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isRefreshingPins) return;
    if (refreshSettleTimerRef.current) clearTimeout(refreshSettleTimerRef.current);
    // If count is still growing, reset the settle timer
    if (geocodedInvoices.length !== prevGeocodedCountRef.current) {
      prevGeocodedCountRef.current = geocodedInvoices.length;
      refreshSettleTimerRef.current = setTimeout(() => {
        // Give an extra 2 s after the last batch arrives before hiding the overlay
        setIsRefreshingPins(false);
      }, 2000);
    }
    return () => {
      if (refreshSettleTimerRef.current) clearTimeout(refreshSettleTimerRef.current);
    };
  }, [geocodedInvoices.length, isRefreshingPins]);

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

  // Clicking a map pin shows its invoice details and, if that invoice belongs to a
  // trip, selects that trip exactly like clicking its row in the table below —
  // same toggle behavior, so all of that trip's pins highlight green on the map.
  const handleMapInvoiceClick = (inv: GeocodedInvoice) => {
    setSelectedInvoice(inv);
    const trip = trips.find(t => t.invoiceIds?.includes(inv.id));
    if (trip) {
      setHighlightedTripId(prev => (prev === trip.id ? null : trip.id));
    }
  };

  // Unique Districts across all invoices, for the Map Pin Filters district dropdown
  const districtsList = useMemo(() => {
    const districtsSet = new Set<string>();
    invoices.forEach(inv => {
      if (inv.district) districtsSet.add(inv.district.trim().toUpperCase());
    });
    return Array.from(districtsSet).sort();
  }, [invoices]);

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

  // Groups of trips by date (desktop table — untouched by the mobile sort controls)
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

  // Mobile-only variants: honor the "Sort By" dropdown in the mobile filter sheet
  // (default Scheduled Date, descending), independent of the desktop table's ordering.
  const mobileGroupedTripsByDate = useMemo(() => {
    const groups: Record<string, { trip: Trip; totalValue: number }[]> = {};
    Object.entries(groupedTripsByDate).forEach(([dateKey, entries]) => {
      groups[dateKey] = [...entries];
    });

    Object.keys(groups).forEach((dateKey) => {
      if (sortBy === 'name') {
        groups[dateKey].sort((a, b) => sortOrder === 'asc'
          ? a.trip.name.localeCompare(b.trip.name)
          : b.trip.name.localeCompare(a.trip.name));
      } else if (sortBy === 'value') {
        groups[dateKey].sort((a, b) => sortOrder === 'asc'
          ? a.totalValue - b.totalValue
          : b.totalValue - a.totalValue);
      }
    });

    return groups;
  }, [groupedTripsByDate, sortBy, sortOrder]);

  const mobileSortedDateKeys = useMemo(() => {
    const keys = Object.keys(mobileGroupedTripsByDate);
    if (sortBy === 'date') {
      return keys.sort((a, b) => sortOrder === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
    }
    return keys.sort((a, b) => a.localeCompare(b));
  }, [mobileGroupedTripsByDate, sortBy, sortOrder]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5; // Date cards/groups per page

  useEffect(() => {
    setCurrentPage(1);
    setRoutedTrip(null);
    setSelectedInvoice(null);
    setSearchTerm('');
    setLineItemFilter('');
    setSelectedDistrict('all');
    setSelectedStatus('all');
    setSortBy('date');
    setSortOrder('desc');
  }, [showHistory]);

  const totalPages = Math.ceil(sortedDateKeys.length / itemsPerPage);

  const paginatedDateKeys = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedDateKeys.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedDateKeys, currentPage, itemsPerPage]);

  const mobilePaginatedDateKeys = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return mobileSortedDateKeys.slice(startIndex, startIndex + itemsPerPage);
  }, [mobileSortedDateKeys, currentPage, itemsPerPage]);

  const isMobile = useIsMobile();

  // --- Handlers shared with TripListMobile (identical logic to the inline JSX below,
  // just extracted into named functions since the mobile card list can't reuse IIFEs
  // embedded in desktop table cells) ---

  const getNextStatus = (currentStatus: TripStatus): TripStatus => {
    const currentIndex = CYCLE_ORDER.indexOf(currentStatus);
    if (currentIndex === -1) return TripStatus.PROPOSED;
    const nextIndex = (currentIndex + 1) % CYCLE_ORDER.length;
    return CYCLE_ORDER[nextIndex];
  };

  const handleCycleStatus = (trip: Trip) => {
    if (isPendingSubmitting[trip.id]) return;
    const currentActive = pendingStatuses[trip.id] !== undefined ? pendingStatuses[trip.id] : trip.status;
    const next = getNextStatus(currentActive);
    setPendingStatuses(prev => ({ ...prev, [trip.id]: next }));
  };

  const handleCancelPendingStatus = (tripId: string) => {
    setPendingStatuses(prev => {
      const updated = { ...prev };
      delete updated[tripId];
      return updated;
    });
  };

  const handleConfirmStatus = async (trip: Trip) => {
    const targetStatus = pendingStatuses[trip.id];
    if (!targetStatus) return;
    setIsPendingSubmitting(prev => ({ ...prev, [trip.id]: true }));
    try {
      let invoiceStatus = 'proposed';
      if (targetStatus === TripStatus.PENDING) {
        invoiceStatus = 'pending';
      } else if (targetStatus === TripStatus.ASSEMBLED) {
        invoiceStatus = 'assembled';
      } else if (targetStatus === TripStatus.ON_ROUTE) {
        invoiceStatus = 'on_route';
      } else if (targetStatus === TripStatus.DELIVERED || targetStatus === TripStatus.COMPLETED) {
        invoiceStatus = 'delivered';
      }

      // Reverting to an early planning stage (Pending/Proposed) returns any assembled
      // stock to inventory so it is not double-counted when the trip is re-assembled.
      const isRevertToPlanning = targetStatus === TripStatus.PROPOSED || targetStatus === TripStatus.PENDING;
      if (isRevertToPlanning && needsInventoryRestore(trip.status) && trip.invoiceIds?.length) {
        const itemMap: Record<string, { stockCode: string; qty: number }> = {};
        trip.invoiceIds.forEach(id => {
          const inv = invoices.find(i => i.id === id);
          inv?.lineItems?.forEach(li => {
            const code = String(li.stockCode || '').trim().toUpperCase();
            if (!code || code === 'N/A') return;
            if (itemMap[code]) {
              itemMap[code].qty += li.qty;
            } else {
              itemMap[code] = { stockCode: li.stockCode, qty: li.qty };
            }
          });
        });
        await restoreInventoryForItems(Object.values(itemMap), user?.uid || '');
      }

      await updateTrip(trip.id, {
        status: targetStatus,
        ...(isRevertToPlanning ? { checkedItems: {}, partialItems: {} } : {}),
        updatedAt: new Date().toISOString()
      });

      if (trip.invoiceIds && trip.invoiceIds.length > 0) {
        await Promise.all(
          trip.invoiceIds.map(id => updateInvoice(id, {
            status: invoiceStatus,
            updatedAt: new Date().toISOString()
          }))
        );
      }

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
  };

  // Publish a pending trip: promote the trip and all its linked invoices to 'proposed'
  // so they become visible to the team dashboard.
  const handlePublishTrip = async (trip: Trip) => {
    if (isPendingSubmitting[trip.id]) return;
    setIsPendingSubmitting(prev => ({ ...prev, [trip.id]: true }));
    try {
      await updateTrip(trip.id, {
        status: TripStatus.PROPOSED,
        updatedAt: new Date().toISOString()
      });
      if (trip.invoiceIds && trip.invoiceIds.length > 0) {
        await Promise.all(
          trip.invoiceIds.map(id => updateInvoice(id, {
            status: 'proposed',
            updatedAt: new Date().toISOString()
          }))
        );
      }
      // Drop any queued cycle change so the badge reflects the freshly published status.
      setPendingStatuses(prev => {
        const updated = { ...prev };
        delete updated[trip.id];
        return updated;
      });
      toast.success('Trip Published', { description: `"${trip.name}" is now visible to your team.` });
    } catch (err) {
      console.error("Failed to publish trip:", err);
      toast.error('Publish Failed', { description: 'Could not publish this trip. Please try again.' });
    } finally {
      setIsPendingSubmitting(prev => ({ ...prev, [trip.id]: false }));
    }
  };

  const handleFlaggedClick = (trip: Trip) => {
    const partialItems = trip.partialItems;
    const tripPartialKeys = partialItems
      ? Object.keys(partialItems).filter(k => partialItems[k]?.isPartial)
      : [];
    if (!partialItems || tripPartialKeys.length === 0) return;

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
      toast.error('Mapping Error', { description: 'Could not link this partial item to a loaded invoice.' });
    }
  };

  const plannerCountByDate = useMemo(() => {
    const map: Record<string, number> = {};
    planners.forEach(p => {
      map[p.date] = p.entries?.length || 0;
    });
    return map;
  }, [planners]);

  if (isMobile) {
    return (
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
        <TripListMobile
          routedTrip={routedTrip}
          setRoutedTrip={setRoutedTrip}
          handleRefreshPins={handleRefreshPins}
          isRefreshingPins={isRefreshingPins}
          invoicesLoading={invoicesLoading}
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          onCreateTrip={() => navigate('/trips/new')}
          GOOGLE_MAPS_API_KEY={GOOGLE_MAPS_API_KEY}
          activeInvoices={activeInvoices}
          invoices={invoices}
          geocodedInvoices={geocodedInvoices}
          setGeocodedInvoices={setGeocodedInvoices}
          handleMapInvoiceClick={handleMapInvoiceClick}
          warehouse={settings}
          highlightedInvoiceIds={highlightedInvoiceIds}
          liveSelectedInvoice={liveSelectedInvoice}
          setSelectedInvoice={setSelectedInvoice}
          onViewInvoice={(id) => navigate(`/invoices/${id}`)}
          searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          lineItemFilter={lineItemFilter} setLineItemFilter={setLineItemFilter}
          selectedDistrict={selectedDistrict} setSelectedDistrict={setSelectedDistrict}
          selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus}
          sortBy={sortBy} setSortBy={setSortBy}
          sortOrder={sortOrder} setSortOrder={setSortOrder}
          districtsList={districtsList}
          tripsLoading={tripsLoading}
          displayedTrips={displayedTrips}
          paginatedDateKeys={mobilePaginatedDateKeys}
          groupedTripsByDate={mobileGroupedTripsByDate}
          formatTripDateGroupHeader={formatTripDateGroupHeader}
          getTruckById={(truckId) => trucks.find(t => t.id === truckId)}
          plannerCountByDate={plannerCountByDate}
          onOpenPlanner={(dateKey) => setPlannerModalDate(dateKey)}
          highlightedTripId={highlightedTripId}
          setHighlightedTripId={setHighlightedTripId}
          pendingStatuses={pendingStatuses}
          isPendingSubmitting={isPendingSubmitting}
          onCycleStatus={handleCycleStatus}
          onConfirmStatus={handleConfirmStatus}
          onCancelPendingStatus={handleCancelPendingStatus}
          onPublishTrip={handlePublishTrip}
          onShowRoute={(trip) => setRoutedTrip(trip)}
          onEditTrip={(trip) => navigate(`/trips/edit/${trip.id}`)}
          onDeleteTrip={(trip) => handleDeleteTrip(trip)}
          onFlaggedClick={handleFlaggedClick}
          currentPage={currentPage}
          totalPages={totalPages}
          setCurrentPage={setCurrentPage}
        />

        {selectedInvoiceForStock && (
          <StockModalMobile
            invoice={selectedInvoiceForStock}
            onClose={() => setSelectedInvoiceForStock(null)}
          />
        )}

        {partialModalData.isOpen && (
          <PartialConfirmModalMobile
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

        {plannerModalDate && (
          <DayPlannerModalMobile
            key={plannerModalDate}
            date={plannerModalDate}
            dateLabel={formatTripDateGroupHeader(plannerModalDate)}
            entries={planners.find(p => p.date === plannerModalDate)?.entries || []}
            onClose={() => setPlannerModalDate(null)}
            onSave={(updatedEntries) => savePlannerEntries(plannerModalDate, updatedEntries)}
            onMoveToDate={(newDate) => {
              movePlannerEntries(plannerModalDate, newDate);
              setPlannerModalDate(newDate);
            }}
            completedByName={ownerDisplayName}
          />
        )}
      </APIProvider>
    );
  }

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
              title="Re-look up every school on Google Maps and refresh its pin and delivery address"
              onClick={handleRefreshPins}
              disabled={isRefreshingPins || invoicesLoading}
              className="flex items-center gap-2 bg-white text-zinc-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-zinc-50 transition-all border border-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingPins ? 'animate-spin text-brand-accent' : ''}`} />
              {isRefreshingPins ? 'Refreshing...' : 'Refresh Pins'}
            </button>
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

        {/* Map Panel with Filter Bar — becomes a fullscreen overlay (with a left invoice
            sidebar in place of the below-map details card) when isMapFullscreen is true.
            The MapComponent instance below stays mounted throughout so pins/geocoding
            are never re-fetched when toggling fullscreen. */}
        <div className={cn(
          isMapFullscreen
            ? "fixed inset-0 z-[100] bg-zinc-50 flex flex-col"
            : "bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-lg"
        )}>
          {isMapFullscreen ? (
            /* Fullscreen top bar: title, shared pin filters, exit control */
            <div className="bg-white border-b border-zinc-200 px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 shrink-0">
                <div className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
                  <MapPin className="w-4 h-4 text-brand-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-brand-primary uppercase tracking-tight">Trip Map — Fullscreen</h2>
                  <p className="text-[11px] text-zinc-400 font-medium">Click a pin to view invoice details.</p>
                </div>
              </div>

              <MapPinFiltersControls
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                lineItemFilter={lineItemFilter} setLineItemFilter={setLineItemFilter}
                selectedDistrict={selectedDistrict} setSelectedDistrict={setSelectedDistrict}
                selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus}
                districtsList={districtsList} showHistory={showHistory}
              />

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  title="Create New Trip"
                  onClick={() => navigate('/trips/new?fullscreen=1')}
                  className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-brand-primary/90 transition-all shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create New Trip
                </button>
                <button
                  type="button"
                  title="Exit Fullscreen (Esc)"
                  onClick={() => setIsMapFullscreen(false)}
                  className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-zinc-800 transition-all shadow-sm"
                >
                  <Minimize2 className="w-4 h-4" />
                  Exit Fullscreen
                </button>
              </div>
            </div>
          ) : (
            /* Standard Map Pin Filters Bar */
            <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Map Pin Filters</span>
                <span className="h-4 w-px bg-zinc-200" />
                <p className="text-xs text-zinc-500 font-medium">Filter the pins shown on the map below.</p>
              </div>

              <MapPinFiltersControls
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                lineItemFilter={lineItemFilter} setLineItemFilter={setLineItemFilter}
                selectedDistrict={selectedDistrict} setSelectedDistrict={setSelectedDistrict}
                selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus}
                districtsList={districtsList} showHistory={showHistory}
              />
            </div>
          )}

          <div className={cn(isMapFullscreen ? "flex-1 flex min-h-0" : "")}>
            {/* Left sidebar with selected invoice details — fullscreen only */}
            {isMapFullscreen && (
              <div className="w-[380px] shrink-0 border-r border-zinc-200 bg-white overflow-y-auto">
                {liveSelectedInvoice ? (
                  <InvoiceDetailsPanel
                    invoice={liveSelectedInvoice}
                    variant="sidebar"
                    onClose={() => setSelectedInvoice(null)}
                    onViewInvoice={() => navigate(`/invoices/${liveSelectedInvoice.id}`)}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8">
                    <MapPin className="w-10 h-10 text-zinc-200 mb-3" />
                    <p className="text-zinc-500 font-bold text-sm uppercase tracking-tight">No Pin Selected</p>
                    <p className="text-zinc-400 text-xs mt-1 max-w-[220px]">Click any pin on the map to view its invoice details here.</p>
                  </div>
                )}
              </div>
            )}

            {/* Map Section */}
            <div className={cn(isMapFullscreen ? "flex-1 relative bg-zinc-100" : "h-[460px] w-full relative bg-zinc-100")}>
              <MapComponent
                invoices={activeInvoices}
                allInvoices={invoices}
                geocodedInvoices={geocodedInvoices}
                setGeocodedInvoices={setGeocodedInvoices}
                onInvoiceClick={handleMapInvoiceClick}
                warehouse={settings}
                routedTrip={routedTrip}
                highlightedInvoiceIds={highlightedInvoiceIds}
                showHistory={showHistory}
                isRefreshing={isRefreshingPins}
                filters={{ searchTerm, selectedDistrict, selectedStatus, lineItemFilter }}
              />

              {/* Custom Fullscreen toggle, overlaid top-right of the map (standard view only) */}
              {!isMapFullscreen && (
                <button
                  type="button"
                  title="Expand Map to Fullscreen"
                  onClick={() => setIsMapFullscreen(true)}
                  className="absolute top-2.5 right-2.5 z-10 p-2 bg-white hover:bg-zinc-50 text-zinc-600 rounded-lg shadow-md border border-zinc-200 transition-all hover:scale-105 active:scale-95"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Selected Invoice Details Card (standard, non-fullscreen view only —
            fullscreen shows the same details in the left sidebar instead) */}
        {!isMapFullscreen && liveSelectedInvoice && (
          <InvoiceDetailsPanel
            invoice={liveSelectedInvoice}
            variant="card"
            onClose={() => setSelectedInvoice(null)}
            onViewInvoice={() => navigate(`/invoices/${liveSelectedInvoice.id}`)}
          />
        )}

        {/* Trips Grouped by date in their own Cards */}
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
              const dayPlanner = planners.find(p => p.date === dateKey);
              const plannerEntryCount = dayPlanner?.entries?.length || 0;

              return (
                <div key={dateKey} className="bg-white rounded-3xl p-6 shadow-xs border border-zinc-200 space-y-4">
                  <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                    <h3 className="text-sm font-black text-brand-primary tracking-tight uppercase flex items-center gap-2">
                      <CalendarIcon className="w-4.5 h-4.5 text-zinc-500" />
                      {formatTripDateGroupHeader(dateKey)}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="Add Planner"
                        onClick={() => setPlannerModalDate(dateKey)}
                        className="flex items-center gap-1.5 bg-white text-zinc-600 border border-zinc-200 px-2.5 py-1 rounded-full font-black text-[10px] uppercase tracking-wider hover:bg-zinc-50 hover:border-zinc-300 transition-all shadow-sm"
                      >
                        <ClipboardList className="w-3.5 h-3.5 text-brand-accent" />
                        Add Planner
                        {plannerEntryCount > 0 && (
                          <span className="bg-brand-accent/10 text-brand-accent px-1.5 rounded-full text-[9px] leading-relaxed">
                            {plannerEntryCount}
                          </span>
                        )}
                      </button>
                      <span className="bg-zinc-100 text-zinc-800 font-black px-2.5 py-0.5 rounded-full text-[10px] tracking-wider font-sans uppercase border border-zinc-200">
                        {tripsInGroup.length} {tripsInGroup.length === 1 ? 'Trip' : 'Trips'}
                      </span>
                    </div>
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
                                            toast.error('Mapping Error', { description: 'Could not link this partial item to a loaded invoice.' });
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

                                        {trip.status === TripStatus.PENDING && !hasPending && (
                                          isSubmitting ? (
                                            <Loader2 className="w-4 h-4 text-violet-600 animate-spin shrink-0" />
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handlePublishTrip(trip)}
                                              className="px-2 py-1 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 font-sans text-[10px] font-black uppercase rounded-lg flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 animate-fade-in shrink-0"
                                              title="Publish trip and its invoices to the team (Proposed)"
                                            >
                                              <Send className="w-3.5 h-3.5 text-violet-600 stroke-[3]" />
                                              Publish
                                            </button>
                                          )
                                        )}

                                        {hasPending && (
                                          <div className="flex items-center gap-1.5 animate-fade-in shrink-0">
                                            {isSubmitting ? (
                                              <Loader2 className="w-4 h-4 text-brand-primary animate-spin shrink-0" />
                                            ) : (
                                              <>
                                                {/* Direct Confirm Button next to status badge */}
                                                <button
                                                  type="button"
                                                  onClick={() => handleConfirmStatus(trip)}
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

        {plannerModalDate && (
          <DayPlannerModal
            key={plannerModalDate}
            date={plannerModalDate}
            dateLabel={formatTripDateGroupHeader(plannerModalDate)}
            entries={planners.find(p => p.date === plannerModalDate)?.entries || []}
            onClose={() => setPlannerModalDate(null)}
            onSave={(updatedEntries) => savePlannerEntries(plannerModalDate, updatedEntries)}
            onMoveToDate={(newDate) => {
              movePlannerEntries(plannerModalDate, newDate);
              setPlannerModalDate(newDate);
            }}
            completedByName={ownerDisplayName}
          />
        )}

      </div>
    </APIProvider>
  );
}
