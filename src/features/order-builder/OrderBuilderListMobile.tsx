import { useState } from 'react';
import {
  PackagePlus, Search, Loader2, AlertCircle, Trash2, Copy, School, Settings, ClipboardList,
  Edit2, Upload, Plus, SlidersHorizontal, MapPinOff, Check, ChevronDown, Maximize2, Minimize2, MapPin
} from 'lucide-react';
import { MobileCard, MobileCardActionsMenu } from '../../components/mobile/MobileCard';
import { MobileSheet } from '../../components/mobile/MobileSheet';
import { cn } from '../../lib/utils';
import { formatBuildDate } from './utils';
import { OrderBuilderSettingsDialogMobile } from './components/OrderBuilderSettingsDialogMobile';
import { OrderBuilderMap } from './components/OrderBuilderMap';
import { SchoolOrdersDetailsPanel } from './components/SchoolOrdersDetailsPanel';
import type { OrderMapStatusFilter } from './components/OrderMapPinFiltersControls';
import { PhaseProgressBar } from '../stock-control/components/PhaseColumn';
import type { OrderStockCoverage } from '../stock-control/utils/phaseCalculations';
import type { Order } from '../orders/hooks/useOrders';
import type { OrderLocationIssue } from '../orders/hooks/useOrderLocationIssues';
import type { Settings as WarehouseSettings } from '../../types';
import type { OrderBuild } from './types';

interface Props {
  activeTab: 'builds' | 'orders';
  setActiveTab: (t: 'builds' | 'orders') => void;

  hasValidKey: boolean;
  mapOrders: Order[];
  warehouse: WarehouseSettings | null;
  selectedArea: string;
  setSelectedArea: (v: string) => void;
  areasList: string[];
  isMapFullscreen: boolean;
  setIsMapFullscreen: (v: boolean) => void;
  selectedSchoolGroup: { schoolName: string; orders: Order[] } | null;
  onPinClick: (group: { schoolKey: string; schoolName: string; orders: Order[] }) => void;
  onCloseSchoolDetails: () => void;
  onViewSchoolInOrders: (schoolName: string) => void;
  onEditOrderFromSchool: (order: Order) => void;
  locationIssueByOrderId: Map<string, OrderLocationIssue>;

  builds: OrderBuild[];
  buildsLoading: boolean;
  buildsError: string | null;
  buildSearchQuery: string;
  setBuildSearchQuery: (q: string) => void;
  onOpenBuild: (id: string) => void;
  onNewBuild: () => void;
  onCopyBuild: (build: OrderBuild) => void;
  onDeleteBuild: (build: OrderBuild) => Promise<void>;

  orders: Order[];
  ordersLoading: boolean;
  ordersError: string | null;
  orderSearch: string;
  setOrderSearch: (q: string) => void;
  orderStatusFilter: OrderMapStatusFilter;
  setOrderStatusFilter: (s: OrderMapStatusFilter) => void;
  onOpenOrderModal: (order?: Order) => void;
  onOpenImport: () => void;
  onOpenLocationSettings: () => void;
  onDeleteOrder: (id: string) => Promise<boolean>;
  selectedOrderIds: Set<string>;
  onToggleOrderOne: (id: string) => void;
  onToggleOrderAll: () => void;
  allOrdersSelected: boolean;
  onDeleteSelectedOrders: () => Promise<void>;
  locationIssueCount: number;
  activeOrderCount: number;
  completeOrderCount: number;
  stockCoverageByOrderId: Map<string, OrderStockCoverage>;
  stockCoverageLoading: boolean;
  onLocationIssuesClick: () => void;
  onActiveOrdersClick: () => void;
  onCompleteOrdersClick: () => void;
}

// Stable references for the overview map's (unused, readOnly) selection props.
const NO_SELECTED_ORDERS = new Set<string>();
const noop = () => {};

export function OrderBuilderListMobile({
  activeTab, setActiveTab,
  hasValidKey, mapOrders, warehouse, selectedArea, setSelectedArea, areasList,
  isMapFullscreen, setIsMapFullscreen, selectedSchoolGroup, onPinClick, onCloseSchoolDetails,
  onViewSchoolInOrders, onEditOrderFromSchool, locationIssueByOrderId,
  builds, buildsLoading, buildsError, buildSearchQuery, setBuildSearchQuery, onOpenBuild, onNewBuild, onCopyBuild, onDeleteBuild,
  orders, ordersLoading, ordersError, orderSearch, setOrderSearch, orderStatusFilter, setOrderStatusFilter,
  onOpenOrderModal, onOpenImport, onOpenLocationSettings, onDeleteOrder,
  selectedOrderIds, onToggleOrderOne, onToggleOrderAll, allOrdersSelected, onDeleteSelectedOrders,
  locationIssueCount, activeOrderCount, completeOrderCount,
  stockCoverageByOrderId, stockCoverageLoading,
  onLocationIssuesClick, onActiveOrdersClick, onCompleteOrdersClick
}: Props) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deletingBuildId, setDeletingBuildId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const hasActiveFilters = Boolean(orderSearch || selectedArea !== 'all' || orderStatusFilter !== 'All');
  const resetFilters = () => { setOrderSearch(''); setSelectedArea('all'); setOrderStatusFilter('All'); };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  };

  const handleDeleteBuild = async (build: OrderBuild) => {
    if (window.confirm(`Delete Build #${build.buildNumber}? Its orders will be available to bundle again.`)) {
      setDeletingBuildId(build.id);
      await onDeleteBuild(build);
      setDeletingBuildId(null);
    }
  };

  const handleDeleteOrder = async (id: string, schoolName: string) => {
    if (window.confirm(`Delete the order for ${schoolName}?`)) {
      setDeletingOrderId(id);
      await onDeleteOrder(id);
      setDeletingOrderId(null);
    }
  };

  const handleDeleteSelectedOrders = async () => {
    if (window.confirm(`Delete ${selectedOrderIds.size} order${selectedOrderIds.size === 1 ? '' : 's'}?`)) {
      setBulkDeleting(true);
      await onDeleteSelectedOrders();
      setBulkDeleting(false);
    }
  };

  const totalsForBuild = (b: OrderBuild) => {
    const schools = b.schoolGroups.length;
    const orderCount = b.schoolGroups.reduce((s, g) => s + g.orderIds.length, 0);
    const units = b.schoolGroups.reduce((s, g) => s + g.lineItems.reduce((s2, li) => s2 + li.qty, 0), 0);
    return { schools, orders: orderCount, units };
  };

  const totalUnitsForOrder = (o: Order) => o.lineItems.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <PackagePlus className="w-6 h-6 text-brand-accent shrink-0" />
            Order Builder
          </h1>
          <p className="text-xs text-zinc-500">
            Bundle orders from the same school into a single delivery-ready build.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          title="Order Builder settings"
          className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 shrink-0 mobile-tap-target"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onNewBuild}
        title="Start a new order build"
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs mobile-tap-target"
      >
        <PackagePlus className="w-3.5 h-3.5" />
        Build
      </button>

      <OrderBuilderSettingsDialogMobile isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {hasValidKey ? (
        <>
          <div className="w-full h-[220px] rounded-2xl border border-zinc-200 overflow-hidden shadow-lg relative shrink-0">
            <OrderBuilderMap
              orders={mapOrders}
              selectedOrderIds={NO_SELECTED_ORDERS}
              onToggleOrder={noop}
              onSetOrdersForSchool={noop}
              warehouse={warehouse}
              readOnly
              colorMode="status"
              locationIssueOrderIds={new Set(locationIssueByOrderId.keys())}
              onPinClick={onPinClick}
            />
            <button
              type="button"
              title="Expand Map to Fullscreen"
              onClick={() => setIsMapFullscreen(true)}
              className="absolute top-2.5 right-2.5 z-10 p-2 bg-white text-zinc-600 rounded-lg shadow-md border border-zinc-200 mobile-tap-target"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {isMapFullscreen && (
            <div className="fixed inset-0 z-[150] bg-zinc-50 flex flex-col">
              <div className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-brand-primary/10 rounded-lg border border-brand-primary/20 shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-brand-primary" />
                  </div>
                  <h2 className="text-xs font-black text-brand-primary uppercase tracking-tight truncate">Order Map</h2>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    title="Map Pin Filters"
                    onClick={() => setIsFilterOpen(true)}
                    className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 relative mobile-tap-target"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {hasActiveFilters && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-brand-accent" />}
                  </button>
                  <button
                    type="button"
                    title="Exit Fullscreen"
                    onClick={() => setIsMapFullscreen(false)}
                    className="p-2.5 rounded-xl bg-zinc-900 text-white mobile-tap-target"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 relative bg-zinc-100 min-h-0">
                <OrderBuilderMap
                  orders={mapOrders}
                  selectedOrderIds={NO_SELECTED_ORDERS}
                  onToggleOrder={noop}
                  onSetOrdersForSchool={noop}
                  warehouse={warehouse}
                  readOnly
                  colorMode="status"
                  locationIssueOrderIds={new Set(locationIssueByOrderId.keys())}
                  onPinClick={onPinClick}
                />
              </div>

              {selectedSchoolGroup && (
                <div className="max-h-[45vh] overflow-y-auto border-t border-zinc-200 bg-white shrink-0">
                  <SchoolOrdersDetailsPanel
                    schoolName={selectedSchoolGroup.schoolName}
                    orders={selectedSchoolGroup.orders}
                    locationIssueByOrderId={locationIssueByOrderId}
                    variant="sidebar"
                    onClose={onCloseSchoolDetails}
                    onViewInOrders={() => onViewSchoolInOrders(selectedSchoolGroup.schoolName)}
                    onEditOrder={onEditOrderFromSchool}
                  />
                </div>
              )}

              <MobileSheet
                isOpen={isFilterOpen}
                onClose={() => setIsFilterOpen(false)}
                title="Map Pin Filters"
                subtitle="Filter orders & map pins"
                fullHeight={false}
                footer={hasActiveFilters ? (
                  <button
                    type="button"
                    title="Reset map pin filters"
                    onClick={resetFilters}
                    className="w-full py-2.5 text-center text-xs font-black uppercase text-red-500 tracking-wider mobile-tap-target"
                  >
                    Reset Filters
                  </button>
                ) : undefined}
              >
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Search</span>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        title="Search orders"
                        placeholder="Search school, order no., area, SKU…"
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Area</span>
                    <select
                      title="Filter by area"
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full mt-1 px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 bg-white mobile-tap-target"
                    >
                      <option value="all">All Areas</option>
                      {areasList.map(area => <option key={area} value={area}>{area}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Status</span>
                    <select
                      title="Filter by status"
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value as OrderMapStatusFilter)}
                      className="w-full mt-1 px-3.5 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 bg-white mobile-tap-target"
                    >
                      <option value="All">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Complete">Complete</option>
                      <option value="LocationIssues">Location Issues</option>
                    </select>
                  </label>
                </div>
              </MobileSheet>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-center text-zinc-500 p-4 text-xs">
          Add a Google Maps API key (<code>GOOGLE_MAPS_PLATFORM_KEY</code>) to see order locations on a map.
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-zinc-200">
        <button
          type="button"
          title="Show builds"
          onClick={() => setActiveTab('builds')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors mobile-tap-target',
            activeTab === 'builds' ? 'border-brand-accent text-brand-primary' : 'border-transparent text-zinc-500'
          )}
        >
          <PackagePlus className="w-3.5 h-3.5" />
          Builds
        </button>
        <button
          type="button"
          title="Show orders"
          onClick={() => setActiveTab('orders')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors mobile-tap-target',
            activeTab === 'orders' ? 'border-brand-accent text-brand-primary' : 'border-transparent text-zinc-500'
          )}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          Orders
        </button>
      </div>

      {activeTab === 'builds' ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              title="Search builds"
              placeholder="Search build no., school…"
              value={buildSearchQuery}
              onChange={(e) => setBuildSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent bg-white transition-all shadow-2xs"
            />
          </div>

          {buildsLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
              <p className="text-zinc-500 font-medium text-xs">Loading builds…</p>
            </div>
          ) : buildsError ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-sm text-zinc-500 mt-2">{buildsError}</p>
            </div>
          ) : builds.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-3 border border-zinc-200">
                <School className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-zinc-900">No builds yet</p>
              <p className="text-xs text-zinc-500 mt-1">
                {buildSearchQuery ? 'No results match your search.' : 'Bundle your first set of school orders to get started.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {builds.map((b) => {
                const { schools, orders: orderCount, units } = totalsForBuild(b);
                return (
                  <MobileCard key={b.id} onClick={() => onOpenBuild(b.id)}>
                    <MobileCard.Primary>
                      <div className="min-w-0">
                        <p className="text-sm font-mono font-semibold text-zinc-900 truncate">Build #{b.buildNumber}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          {formatBuildDate(b.deliveryDate)}{b.truckName ? ` · ${b.truckName}` : ''}
                        </p>
                      </div>
                      <MobileCardActionsMenu
                        actions={[
                          { label: 'Copy details', icon: Copy, onClick: () => onCopyBuild(b) },
                          {
                            label: deletingBuildId === b.id ? 'Deleting…' : 'Delete',
                            icon: Trash2,
                            destructive: true,
                            onClick: () => handleDeleteBuild(b)
                          }
                        ]}
                      />
                    </MobileCard.Primary>
                    <MobileCard.Secondary>
                      <span>{schools} school{schools === 1 ? '' : 's'}</span>
                      <span>{orderCount} order{orderCount === 1 ? '' : 's'}</span>
                      <span className="font-bold text-zinc-700">{units} units</span>
                    </MobileCard.Secondary>
                  </MobileCard>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              title="View location issues"
              onClick={onLocationIssuesClick}
              className="text-left p-3 rounded-xl border border-zinc-200 bg-white shadow-2xs mobile-tap-target"
            >
              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1"><MapPinOff className="w-3 h-3 text-red-500" /> Location Issues</p>
              <p className="text-lg font-bold text-zinc-900 mt-0.5">{locationIssueCount}</p>
            </button>
            <button
              type="button"
              title="View active orders"
              onClick={onActiveOrdersClick}
              className="text-left p-3 rounded-xl border border-zinc-200 bg-white shadow-2xs mobile-tap-target"
            >
              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Active Orders</p>
              <p className="text-lg font-bold text-zinc-900 mt-0.5">{activeOrderCount}</p>
            </button>
            <button
              type="button"
              title="View complete orders"
              onClick={onCompleteOrdersClick}
              className="text-left p-3 rounded-xl border border-zinc-200 bg-white shadow-2xs mobile-tap-target"
            >
              <p className="text-[9px] font-black uppercase tracking-wider text-zinc-400">Complete Orders</p>
              <p className="text-lg font-bold text-zinc-900 mt-0.5">{completeOrderCount}</p>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenImport}
              title="Import Orders"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-700 font-semibold text-xs transition-all shadow-2xs mobile-tap-target"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-500" />
              Import
            </button>
            <button
              onClick={onOpenLocationSettings}
              title="Location Issue Settings"
              className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 transition-all shadow-2xs mobile-tap-target shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onOpenOrderModal()}
              title="Add Order"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white font-semibold text-xs rounded-xl active:scale-98 transition-all shadow-xs mobile-tap-target"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>

          {hasValidKey && (
            <p className="text-[10px] text-zinc-400 font-medium px-1">
              Filtered by the map's Map Pin Filters above{hasActiveFilters ? ' — filters active.' : '.'}
            </p>
          )}

          {!ordersLoading && !ordersError && orders.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 mobile-tap-target">
                <input
                  type="checkbox"
                  title="Select all orders"
                  checked={allOrdersSelected}
                  onChange={onToggleOrderAll}
                  className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30"
                />
                Select all
              </label>
              {selectedOrderIds.size > 0 && (
                <button
                  type="button"
                  title="Delete selected orders"
                  onClick={handleDeleteSelectedOrders}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 bg-red-50 border border-red-200 rounded-lg text-xs font-bold transition-all disabled:opacity-50 mobile-tap-target"
                >
                  {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Delete {selectedOrderIds.size}
                </button>
              )}
            </div>
          )}

          {ordersLoading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
              <p className="text-zinc-500 font-medium text-xs">Loading orders…</p>
            </div>
          ) : ordersError ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
              <p className="text-sm text-zinc-500 mt-2">{ordersError}</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-3 border border-zinc-200">
                <ClipboardList className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-zinc-900">No orders found</p>
              <p className="text-xs text-zinc-500 mt-1">
                {orderSearch
                  ? 'No results match your search.'
                  : orderStatusFilter === 'LocationIssues'
                    ? 'No location issues found - every order\'s school geocodes to its stated area.'
                    : orderStatusFilter === 'Complete'
                      ? 'No completed orders yet.'
                      : 'Import a delivery schedule or add your first order to get started.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => {
                const isExpanded = expandedOrderId === o.id;
                const q = orderSearch.toLowerCase().trim();
                return (
                  <MobileCard
                    key={o.id}
                    onClick={() => toggleOrderExpanded(o.id)}
                    className={selectedOrderIds.has(o.id) ? 'border-brand-accent/40 bg-brand-accent/5' : undefined}
                  >
                    <MobileCard.Primary>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          title={`Select order for ${o.schoolName}`}
                          checked={selectedOrderIds.has(o.id)}
                          onChange={() => onToggleOrderOne(o.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30 shrink-0"
                        />
                        <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform', isExpanded && 'rotate-180')} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 truncate">{o.schoolName}</p>
                          <p className="text-[10px] font-mono text-zinc-400 mt-0.5">{o.orderNumber || '—'}</p>
                        </div>
                      </div>
                      <MobileCardActionsMenu
                        actions={[
                          { label: 'Edit', icon: Edit2, onClick: () => onOpenOrderModal(o) },
                          {
                            label: deletingOrderId === o.id ? 'Deleting…' : 'Delete',
                            icon: Trash2,
                            destructive: true,
                            onClick: () => handleDeleteOrder(o.id, o.schoolName)
                          }
                        ]}
                      />
                    </MobileCard.Primary>
                    <MobileCard.Secondary>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide flex items-center gap-0.5',
                        o.status === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {o.status === 'Complete' && <Check className="w-2.5 h-2.5" />}
                        {o.status}
                      </span>
                      <span>{o.area || 'Unassigned'}</span>
                      <span>{o.schoolType || '—'}</span>
                      <span>{o.lineItems.length} SKUs</span>
                      <span className="font-bold text-zinc-700">{totalUnitsForOrder(o)} units</span>
                    </MobileCard.Secondary>

                    {stockCoverageLoading ? (
                      <div className="w-full bg-zinc-100 h-1.5 rounded-full animate-pulse" />
                    ) : (() => {
                      const coverage = stockCoverageByOrderId.get(o.id) ?? { neededUnits: 0, coverableUnits: 0, pct: 100 };
                      return (
                        <div
                          className="space-y-1"
                          title={coverage.neededUnits === 0
                            ? 'Fully reserved - nothing left to book'
                            : `Needs ${coverage.neededUnits} · In stock now: ${coverage.coverableUnits}`}
                        >
                          <div className="flex items-center justify-between text-[9px] font-mono font-bold">
                            <span className="text-zinc-400 uppercase tracking-wider">Stock Coverage</span>
                            <span className={coverage.pct >= 100 ? 'text-emerald-600' : 'text-amber-600'}>{coverage.pct}%</span>
                          </div>
                          <PhaseProgressBar pct={coverage.pct} accent={coverage.pct >= 100 ? 'emerald' : 'amber'} />
                        </div>
                      );
                    })()}

                    {isExpanded && (
                      <div className="pt-2 -mx-1" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-1 mb-1.5">
                          <h4 className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Line Items</h4>
                          <span className="text-[9px] font-bold text-zinc-400 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded-full">
                            {o.lineItems.length} item{o.lineItems.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {o.lineItems.length === 0 ? (
                          <p className="py-4 text-center text-zinc-400 italic text-xs">No line items present for this order.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {o.lineItems.map((item, idx) => {
                              const isCodeMatched = q.length > 0 && item.stockCode.toLowerCase().includes(q);
                              return (
                                <div
                                  key={idx}
                                  className={cn(
                                    'flex items-center justify-between gap-3 rounded-xl border p-2.5',
                                    isCodeMatched ? 'bg-amber-50/80 border-amber-200' : 'bg-zinc-50/50 border-zinc-100'
                                  )}
                                >
                                  <p className="font-mono text-xs font-bold text-brand-primary truncate">{item.stockCode || '—'}</p>
                                  <p className="font-mono text-xs font-black text-zinc-800 shrink-0">Qty {item.qty}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </MobileCard>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
