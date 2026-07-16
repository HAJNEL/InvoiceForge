import { useState } from 'react';
import { Plus, Trash2, Edit3, Loader2, Calendar as CalendarIcon, Navigation, History, AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, Search, Minimize2, MapPin, ClipboardList, SlidersHorizontal, Check, X, Send, ArrowUpDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Trip, TripStatus, Settings } from '../../../types';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { GeocodedInvoice } from './types';
import { MapComponent } from './MapComponent';
import { StatusBadge } from './StatusBadge';
import { InvoiceDetailsPanel } from './InvoiceDetailsPanel';
import { MobileSheet } from '../../../components/mobile/MobileSheet';
import { MobileCardActionsMenu } from '../../../components/mobile/MobileCard';

// Local shape for whatever a trip-in-a-date-group looks like once TripList.tsx has
// already computed totals — kept intentionally loose (mirrors the parent's own
// groupedTripsByDate shape) so this file never needs to duplicate that logic.
interface TripGroupEntry {
  trip: Trip;
  totalValue: number;
}

interface TripListMobileProps {
  // Header actions
  routedTrip: Trip | null;
  setRoutedTrip: (trip: Trip | null) => void;
  handleRefreshPins: () => void;
  isRefreshingPins: boolean;
  invoicesLoading: boolean;
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  onCreateTrip: () => void;

  // Map + filters
  GOOGLE_MAPS_API_KEY: string;
  activeInvoices: UIInvoice[];
  invoices: UIInvoice[];
  geocodedInvoices: GeocodedInvoice[];
  setGeocodedInvoices: React.Dispatch<React.SetStateAction<GeocodedInvoice[]>>;
  handleMapInvoiceClick: (inv: GeocodedInvoice) => void;
  warehouse: Settings | null;
  highlightedInvoiceIds: string[];
  liveSelectedInvoice: GeocodedInvoice | null;
  setSelectedInvoice: (inv: GeocodedInvoice | null) => void;
  onViewInvoice: (id: string) => void;

  searchTerm: string; setSearchTerm: (v: string) => void;
  lineItemFilter: string; setLineItemFilter: (v: string) => void;
  selectedDistrict: string; setSelectedDistrict: (v: string) => void;
  selectedStatus: string; setSelectedStatus: (v: string) => void;
  sortBy: 'date' | 'name' | 'value'; setSortBy: (v: 'date' | 'name' | 'value') => void;
  sortOrder: 'asc' | 'desc'; setSortOrder: (v: 'asc' | 'desc') => void;
  districtsList: string[];

  // Trip list
  tripsLoading: boolean;
  displayedTrips: Trip[];
  paginatedDateKeys: string[];
  groupedTripsByDate: Record<string, TripGroupEntry[]>;
  formatTripDateGroupHeader: (dateStr: string) => string;
  getTruckById: (truckId: string) => { name: string; maxValue?: number } | undefined;

  plannerCountByDate: Record<string, number>;
  onOpenPlanner: (dateKey: string) => void;

  highlightedTripId: string | null;
  setHighlightedTripId: React.Dispatch<React.SetStateAction<string | null>>;

  pendingStatuses: { [tripId: string]: TripStatus };
  isPendingSubmitting: { [tripId: string]: boolean };
  onCycleStatus: (trip: Trip) => void;
  onConfirmStatus: (trip: Trip) => void;
  onCancelPendingStatus: (tripId: string) => void;
  onPublishTrip: (trip: Trip) => void;

  onShowRoute: (trip: Trip) => void;
  onEditTrip: (trip: Trip) => void;
  onDeleteTrip: (trip: Trip) => void;
  onFlaggedClick: (trip: Trip) => void;

  currentPage: number;
  totalPages: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
}

export function TripListMobile({
  routedTrip, setRoutedTrip, handleRefreshPins, isRefreshingPins, invoicesLoading,
  showHistory, setShowHistory, onCreateTrip,
  activeInvoices, invoices, geocodedInvoices, setGeocodedInvoices, handleMapInvoiceClick,
  warehouse, highlightedInvoiceIds, liveSelectedInvoice, setSelectedInvoice, onViewInvoice,
  searchTerm, setSearchTerm, lineItemFilter, setLineItemFilter,
  selectedDistrict, setSelectedDistrict, selectedStatus, setSelectedStatus,
  sortBy, setSortBy, sortOrder, setSortOrder, districtsList,
  tripsLoading, displayedTrips, paginatedDateKeys, groupedTripsByDate, formatTripDateGroupHeader,
  getTruckById, plannerCountByDate, onOpenPlanner,
  highlightedTripId, setHighlightedTripId,
  pendingStatuses, isPendingSubmitting, onCycleStatus, onConfirmStatus, onCancelPendingStatus, onPublishTrip,
  onShowRoute, onEditTrip, onDeleteTrip, onFlaggedClick,
  currentPage, totalPages, setCurrentPage
}: TripListMobileProps) {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const hasActiveFilters = Boolean(
    searchTerm || lineItemFilter || selectedDistrict !== 'all' || selectedStatus !== 'all' ||
    sortBy !== 'date' || sortOrder !== 'desc'
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-brand-primary tracking-tight uppercase">Trip Management</h1>
        <p className="text-zinc-500 text-xs mt-0.5">Visualize and manage your delivery logistics.</p>
      </div>

      {/* Action row */}
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
          title="Filter trips and map pins"
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
          title={showHistory ? 'View Active Trips' : 'View History'}
          onClick={() => setShowHistory(!showHistory)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs border mobile-tap-target",
            showHistory ? "bg-zinc-100 text-zinc-800 border-zinc-300" : "bg-white text-zinc-600 border-zinc-200"
          )}
        >
          <History className="w-4 h-4 text-zinc-500" />
          {showHistory ? "Active" : "History"}
        </button>
        <button
          type="button"
          title="Re-look up every school on Google Maps and refresh its pin and delivery address"
          onClick={handleRefreshPins}
          disabled={isRefreshingPins || invoicesLoading}
          className="flex items-center gap-1.5 bg-white text-zinc-600 px-3 py-2 rounded-xl font-bold text-xs border border-zinc-200 disabled:opacity-50 mobile-tap-target"
        >
          <RefreshCw className={cn("w-4 h-4", isRefreshingPins && "animate-spin text-brand-accent")} />
        </button>
        {routedTrip && (
          <button
            type="button"
            title="Clear Route"
            onClick={() => setRoutedTrip(null)}
            className="flex items-center gap-1.5 bg-zinc-100 text-zinc-600 px-3 py-2 rounded-xl font-bold text-xs border border-zinc-200 mobile-tap-target"
          >
            Clear Route
          </button>
        )}
      </div>

      <button
        type="button"
        title="Create New Trip"
        onClick={onCreateTrip}
        className="flex items-center justify-center gap-2 w-full bg-brand-primary text-white px-4 py-3 rounded-xl font-bold text-sm shadow-sm mobile-tap-target"
      >
        <Plus className="w-4 h-4" />
        Create New Trip
      </button>

      {/* Selected invoice details card, same as desktop's below-map card */}
      {liveSelectedInvoice && (
        <InvoiceDetailsPanel
          invoice={liveSelectedInvoice}
          variant="card"
          onClose={() => setSelectedInvoice(null)}
          onViewInvoice={() => onViewInvoice(liveSelectedInvoice.id)}
        />
      )}

      {/* Trips grouped by date */}
      {tripsLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-10 text-center">
          <Loader2 className="w-7 h-7 text-brand-accent animate-spin mx-auto mb-2" />
          <p className="text-zinc-500 text-xs">Loading trips...</p>
        </div>
      ) : displayedTrips.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-10 text-center">
          <Navigation className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <p className="text-zinc-500 font-bold uppercase tracking-wide text-sm">
            {showHistory ? "No Invoiced Trips in History" : "No Active Trips Planned"}
          </p>
          {!showHistory && (
            <p className="text-zinc-400 text-xs mt-1">Create your first trip or toggle history to view past deliveries.</p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {paginatedDateKeys.map((dateKey) => {
            const tripsInGroup = groupedTripsByDate[dateKey] || [];
            const plannerEntryCount = plannerCountByDate[dateKey] || 0;

            return (
              <div key={dateKey} className="bg-white rounded-2xl p-4 shadow-xs border border-zinc-200 space-y-3">
                <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5">
                  <h3 className="text-xs font-black text-brand-primary tracking-tight uppercase flex items-center gap-1.5 min-w-0">
                    <CalendarIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span className="truncate">{formatTripDateGroupHeader(dateKey)}</span>
                  </h3>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      title="Add Planner"
                      onClick={() => onOpenPlanner(dateKey)}
                      className="flex items-center gap-1 bg-white text-zinc-600 border border-zinc-200 px-2 py-1 rounded-full font-black text-[9px] uppercase tracking-wider mobile-tap-target"
                    >
                      <ClipboardList className="w-3 h-3 text-brand-accent" />
                      {plannerEntryCount > 0 && (
                        <span className="bg-brand-accent/10 text-brand-accent px-1 rounded-full text-[8px] leading-relaxed">
                          {plannerEntryCount}
                        </span>
                      )}
                    </button>
                    <span className="bg-zinc-100 text-zinc-800 font-black px-2 py-0.5 rounded-full text-[9px] tracking-wider uppercase border border-zinc-200">
                      {tripsInGroup.length}
                    </span>
                  </div>
                </div>

                <div className="-mx-4 divide-y divide-zinc-100">
                  {tripsInGroup.map(({ trip }) => {
                    const isHighlighted = highlightedTripId === trip.id;
                    const pendingVal = pendingStatuses[trip.id];
                    const hasPending = pendingVal !== undefined;
                    const activeStatus = hasPending ? pendingVal : trip.status;
                    const isSubmitting = isPendingSubmitting[trip.id] || false;

                    const partialItems = trip.partialItems;
                    const tripPartialKeys = partialItems
                      ? Object.keys(partialItems).filter(k => partialItems[k]?.isPartial)
                      : [];
                    const isFlagged = Boolean(partialItems && tripPartialKeys.length > 0);

                    return (
                      <div
                        key={trip.id}
                        onClick={() => setHighlightedTripId(prev => prev === trip.id ? null : trip.id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 cursor-pointer border-l-4 transition-colors",
                          isHighlighted ? "bg-amber-50/40 border-l-amber-500" : "border-l-transparent active:bg-zinc-50"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-zinc-900 text-sm truncate">{trip.name}</p>
                          {isFlagged && (
                            <button
                              type="button"
                              title="Review and process partial split"
                              onClick={(e) => {
                                e.stopPropagation();
                                onFlaggedClick(trip);
                              }}
                              className="mt-1 p-1 px-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-mono text-[9px] font-black uppercase rounded-lg inline-flex items-center gap-1 animate-pulse"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              FLAGGED
                            </button>
                          )}
                          {hasPending && (
                            <div className="flex items-center gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
                              {isSubmitting ? (
                                <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    title="Confirm Status Update"
                                    onClick={() => onConfirmStatus(trip)}
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-sans text-[10px] font-black uppercase rounded-lg flex items-center gap-1 mobile-tap-target"
                                  >
                                    <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    title="Cancel status change"
                                    onClick={() => onCancelPendingStatus(trip.id)}
                                    className="p-1.5 hover:bg-zinc-100 border border-zinc-200 text-zinc-500 rounded-lg mobile-tap-target"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                          {trip.status === TripStatus.PENDING && !hasPending && (
                            <div className="flex items-center gap-2 mt-1.5" onClick={(e) => e.stopPropagation()}>
                              {isSubmitting ? (
                                <Loader2 className="w-4 h-4 text-violet-600 animate-spin" />
                              ) : (
                                <button
                                  type="button"
                                  title="Publish trip and its invoices to the team (Proposed)"
                                  onClick={() => onPublishTrip(trip)}
                                  className="px-2 py-1 bg-violet-50 hover:bg-violet-100 border border-violet-200 text-violet-700 font-sans text-[10px] font-black uppercase rounded-lg flex items-center gap-1 mobile-tap-target"
                                >
                                  <Send className="w-3.5 h-3.5 text-violet-600 stroke-[3]" />
                                  Publish
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        <span className="shrink-0 font-mono text-[11px] font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
                          {trip.invoiceIds?.length || 0}
                        </span>

                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <StatusBadge status={activeStatus} onClick={() => onCycleStatus(trip)} />
                        </div>

                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <MobileCardActionsMenu
                            actions={[
                              { label: 'Show Route', icon: Navigation, onClick: () => onShowRoute(trip) },
                              { label: 'Edit', icon: Edit3, onClick: () => onEditTrip(trip) },
                              { label: 'Delete', icon: Trash2, onClick: () => onDeleteTrip(trip), destructive: true },
                            ]}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border border-zinc-200 rounded-2xl bg-zinc-50/50">
              <span className="text-[10px] text-zinc-500 font-medium">
                Page <span className="font-bold text-zinc-800">{currentPage}</span> / <span className="font-bold text-zinc-800">{totalPages}</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  title="Previous Page"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-zinc-250 bg-white rounded-lg disabled:opacity-40 text-zinc-700 mobile-tap-target"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Next Page"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-zinc-250 bg-white rounded-lg disabled:opacity-40 text-zinc-700 mobile-tap-target"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen map — the only mobile map mode, opened via "View Map" */}
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
                title="Close Map"
                onClick={() => setIsMapOpen(false)}
                className="flex items-center gap-1.5 bg-zinc-900 text-white px-3 py-2 rounded-lg font-bold text-xs mobile-tap-target"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 relative bg-zinc-100 min-h-0">
            <MapComponent
              invoices={activeInvoices}
              allInvoices={invoices}
              geocodedInvoices={geocodedInvoices}
              setGeocodedInvoices={setGeocodedInvoices}
              onInvoiceClick={handleMapInvoiceClick}
              warehouse={warehouse}
              routedTrip={routedTrip}
              highlightedInvoiceIds={highlightedInvoiceIds}
              showHistory={showHistory}
              isRefreshing={isRefreshingPins}
              filters={{ searchTerm, selectedDistrict, selectedStatus, lineItemFilter }}
            />
          </div>

          {liveSelectedInvoice && (
            <div className="max-h-[45vh] overflow-y-auto border-t border-zinc-200 bg-white shrink-0">
              <InvoiceDetailsPanel
                invoice={liveSelectedInvoice}
                variant="sidebar"
                onClose={() => setSelectedInvoice(null)}
                onViewInvoice={() => onViewInvoice(liveSelectedInvoice.id)}
              />
            </div>
          )}
        </div>
      )}

      {/* Filter sheet — replaces the inline Map Pin Filters row */}
      <MobileSheet
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Map Pin Filters"
        subtitle="Filter trips & map pins"
        fullHeight={false}
        footer={
          hasActiveFilters ? (
            <button
              type="button"
              title="Reset all filters"
              onClick={() => {
                setSearchTerm('');
                setLineItemFilter('');
                setSelectedDistrict('all');
                setSelectedStatus('all');
                setSortBy('date');
                setSortOrder('desc');
              }}
              className="w-full px-4 py-3 border border-red-200 text-red-500 font-extrabold text-xs uppercase tracking-wider rounded-xl mobile-tap-target"
            >
              Reset Filters
            </button>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
              <ArrowUpDown className="w-3 h-3" />
              Sort By
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                title="Sort trips by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'value')}
                className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
              >
                <option value="date">Scheduled Date</option>
                <option value="name">Trip Name</option>
                <option value="value">Total Value</option>
              </select>
              <select
                title="Sort order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

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
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Line Item</label>
            <input
              type="text"
              title="Filter line item"
              placeholder="Filter line item..."
              value={lineItemFilter}
              onChange={(e) => setLineItemFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
            />
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
              {showHistory && <option value="complete">Delivered / Complete</option>}
            </select>
          </div>
        </div>
      </MobileSheet>
    </div>
  );
}
