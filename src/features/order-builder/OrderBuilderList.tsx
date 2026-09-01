import { useState, useMemo, useEffect, Fragment } from 'react';
import {
  PackagePlus, Search, Loader2, AlertCircle, Trash2, Check, X, School, Copy, Settings,
  ArrowUp, ArrowDown, ArrowUpDown, ClipboardList, Upload, Plus, SlidersHorizontal, MapPinOff, Edit2,
  Maximize2, Minimize2, MapPin
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { APIProvider } from '@vis.gl/react-google-maps';
import { cn } from '../../lib/utils';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useOrderBuilds, deleteBuild } from './hooks/useOrderBuilds';
import { useOrders } from '../orders/hooks/useOrders';
import type { Order } from '../orders/hooks/useOrders';
import { useSettings } from '../settings/hooks/useSettings';
import { OrderFormModal } from '../orders/components/OrderFormModal';
import { OrdersImportDialog } from '../orders/components/OrdersImportDialog';
import { OrdersKpiRow } from '../orders/components/OrdersKpiRow';
import { OrdersLocationSettingsDialog } from '../orders/components/OrdersLocationSettingsDialog';
import { OrderLocationGeocoder, computeLocationIssues, logLocationIssues } from '../orders/hooks/useOrderLocationIssues';
import { useStockControl } from '../stock-control/hooks/useStockControl';
import { buildAvailableByCode, computeOrderStockCoverage } from '../stock-control/utils/phaseCalculations';
import { PhaseProgressBar } from '../stock-control/components/PhaseColumn';
import { MobileCardActionsMenu } from '../../components/mobile/MobileCard';
import { formatBuildDate, formatBuildAsText } from './utils';
import { OrderBuilderListMobile } from './OrderBuilderListMobile';
import { OrderBuilderSettingsDialog } from './components/OrderBuilderSettingsDialog';
import { OrderBuilderMap } from './components/OrderBuilderMap';
import { OrderMapPinFiltersControls, type OrderMapStatusFilter } from './components/OrderMapPinFiltersControls';
import { SchoolOrdersDetailsPanel } from './components/SchoolOrdersDetailsPanel';
import {
  loadCachedSchoolPins, loadCachedAreaPins, schoolKeyFor, DEFAULT_LOCATION_ISSUE_DISTANCE_KM,
  type CachedSchoolPin, type CachedAreaPin
} from '../../lib/geocoding';
import type { OrderBuild } from './types';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidKey = Boolean(GOOGLE_MAPS_API_KEY);

// Stable references for the overview map's (unused, readOnly) selection props -
// avoids handing it a fresh Set/function every render for no reason.
const NO_SELECTED_ORDERS = new Set<string>();
const noop = () => {};

export type OrderSortField = 'schoolName' | 'orderNumber' | 'area' | 'schoolType' | 'status';

export function SortHeader({ label, field, sortField, sortDir, onSort, align }: {
  label: string;
  field: OrderSortField;
  sortField: OrderSortField;
  sortDir: 'asc' | 'desc';
  onSort: (field: OrderSortField) => void;
  align?: 'right';
}) {
  const active = field === sortField;
  return (
    <th className={cn('px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider', align === 'right' && 'text-right')}>
      <button
        type="button"
        title={`Sort by ${label}`}
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 cursor-pointer hover:text-zinc-700 transition-colors',
          align === 'right' && 'flex-row-reverse',
          active && 'text-brand-primary'
        )}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 text-zinc-300" />
        )}
      </button>
    </th>
  );
}

// Order Builder's landing screen - map of every order's school, then a Builds
// tab (default) and an Orders tab. The Orders tab absorbs the old standalone
// Orders screen wholesale (KPIs, import, location settings, add/edit/delete)
// now that Order Builder is the single place orders are managed from.
export function OrderBuilderList() {
  const { builds, loading: buildsLoading, error: buildsError } = useOrderBuilds();
  const { orders, loading: ordersLoading, error: ordersError, addOrder, updateOrder, deleteOrder, deleteOrders } = useOrders();
  const { settings, saveSettings } = useSettings();
  // Stock-coverage progress bar (Orders tab table) - same reserved-vs-available
  // math as the Auto-Book Orders dialog (see phaseCalculations.ts), so the two
  // screens never disagree about what "100% covered" means for an order.
  const { orderRows: stockOrderRows, stockRows, loading: stockControlLoading } = useStockControl();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<'builds' | 'orders'>('builds');

  // Builds tab state
  const [buildSearchQuery, setBuildSearchQuery] = useState('');
  const [deleteConfirmBuildId, setDeleteConfirmBuildId] = useState<string | null>(null);
  const [deletingBuildId, setDeletingBuildId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Orders tab state - one unified search/area/status filter drives both the map
  // pins above and the Orders table below (see OrderMapPinFiltersControls).
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderMapStatusFilter>('All');
  const [selectedArea, setSelectedArea] = useState('all');
  const [sortField, setSortField] = useState<OrderSortField>('orderNumber');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isLocationSettingsOpen, setIsLocationSettingsOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [schoolPins, setSchoolPins] = useState<CachedSchoolPin[]>(() => loadCachedSchoolPins());
  const [areaPins, setAreaPins] = useState<CachedAreaPin[]>(() => loadCachedAreaPins());

  // Overview map: fullscreen mode + the currently-selected school pin.
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [selectedSchoolKey, setSelectedSchoolKey] = useState<string | null>(null);

  const maxDistanceKm = settings?.orderLocationIssueMaxDistanceKm ?? DEFAULT_LOCATION_ISSUE_DISTANCE_KM;
  const locationIssues = useMemo(() => computeLocationIssues(orders, schoolPins, areaPins, maxDistanceKm), [orders, schoolPins, areaPins, maxDistanceKm]);
  const locationIssueIds = useMemo(() => new Set(locationIssues.map(i => i.orderId)), [locationIssues]);
  const locationIssueByOrderId = useMemo(() => new Map(locationIssues.map(i => [i.orderId, i])), [locationIssues]);
  const activeOrderCount = useMemo(() => orders.filter(o => o.status === 'Active').length, [orders]);
  const completeOrderCount = useMemo(() => orders.filter(o => o.status === 'Complete').length, [orders]);

  const areasList = useMemo(() => {
    const areas = new Set<string>();
    orders.forEach(o => { if (o.area.trim()) areas.add(o.area.trim().toUpperCase()); });
    return Array.from(areas).sort();
  }, [orders]);

  // Stock-coverage % per order, for the Orders tab's progress-bar column - same
  // formula Auto-Book uses per candidate (coverableUnits/neededUnits), just run
  // for every order rather than only ones with an open shortfall. Orders with no
  // matching stock-control row (anything not status 'Active', or already on a
  // trip - see buildOrderRows) have nothing left to book, so they read as fully
  // covered (100%) rather than showing no data.
  const availableByCode = useMemo(() => buildAvailableByCode(stockRows), [stockRows]);
  const stockOrderRowById = useMemo(
    () => new Map(stockOrderRows.filter(r => r.source === 'order').map(r => [r.invoiceId, r])),
    [stockOrderRows]
  );
  const stockCoverageByOrderId = useMemo(() => {
    const map = new Map<string, { neededUnits: number; coverableUnits: number; pct: number }>();
    orders.forEach(o => {
      const row = stockOrderRowById.get(o.id);
      map.set(o.id, row ? computeOrderStockCoverage(row, availableByCode) : { neededUnits: 0, coverableUnits: 0, pct: 100 });
    });
    return map;
  }, [orders, stockOrderRowById, availableByCode]);

  // Recomputed live from `orders` (not a stale snapshot) so an edit to a school's
  // orders is reflected immediately in the open details panel.
  const selectedSchoolGroup = useMemo(() => {
    if (!selectedSchoolKey) return null;
    const schoolOrders = orders.filter(o => schoolKeyFor(o.schoolName) === selectedSchoolKey);
    if (schoolOrders.length === 0) return null;
    return { schoolName: schoolOrders[0].schoolName, orders: schoolOrders };
  }, [orders, selectedSchoolKey]);

  // Lock body scroll and allow Escape to exit while the fullscreen map is open.
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

  useEffect(() => {
    logLocationIssues(locationIssues, maxDistanceKm);
  }, [locationIssues, maxDistanceKm]);

  const handleSaveMaxDistance = async (value: number) => saveSettings({ orderLocationIssueMaxDistanceKm: value });

  const handleLocationIssuesClick = () => {
    setActiveTab('orders');
    setOrderSearch('');
    setOrderStatusFilter('LocationIssues');
  };

  const handleActiveOrdersClick = () => {
    setActiveTab('orders');
    setOrderSearch('');
    setOrderStatusFilter('Active');
  };

  const handleCompleteOrdersClick = () => {
    setActiveTab('orders');
    setOrderSearch('');
    setOrderStatusFilter('Complete');
  };

  const handleMapPinClick = (group: { schoolKey: string; schoolName: string; orders: Order[] }) => {
    setSelectedSchoolKey(group.schoolKey);
  };

  const handleViewSchoolInOrders = (schoolName: string) => {
    setIsMapFullscreen(false);
    setActiveTab('orders');
    setOrderSearch(schoolName);
  };

  const handleSort = (field: OrderSortField) => {
    if (field === sortField) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredSortedOrders = useMemo(() => {
    const q = orderSearch.toLowerCase().trim();
    const base = orders.filter(o => {
      if (orderStatusFilter === 'All') return true;
      if (orderStatusFilter === 'LocationIssues') return locationIssueIds.has(o.id);
      return o.status === orderStatusFilter;
    });
    const areaFiltered = selectedArea === 'all' ? base : base.filter(o => o.area.trim().toUpperCase() === selectedArea);
    const filtered = areaFiltered.filter(o => {
      if (!q) return true;
      return (
        o.schoolName.toLowerCase().includes(q) ||
        o.orderNumber.toLowerCase().includes(q) ||
        o.area.toLowerCase().includes(q) ||
        o.schoolType.toLowerCase().includes(q) ||
        o.clientNumber.toLowerCase().includes(q) ||
        o.lineItems.some(l => l.stockCode.toLowerCase().includes(q))
      );
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortField) {
        // Numeric-aware so "OR-012168" sorts after "OR-012166", not "OR-012168"
        // before "OR-01217" the way a plain string compare would.
        case 'orderNumber': return dir * a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true });
        case 'schoolName': return dir * a.schoolName.localeCompare(b.schoolName);
        case 'area': return dir * a.area.localeCompare(b.area);
        case 'schoolType': return dir * a.schoolType.localeCompare(b.schoolType);
        case 'status': return dir * a.status.localeCompare(b.status);
        default: return 0;
      }
    });
  }, [orders, orderSearch, orderStatusFilter, selectedArea, locationIssueIds, sortField, sortDir]);

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrderIds(prev => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Auto-expand search matches when the user types a matching stock code, same
  // touch InvoiceList.tsx has - so a SKU search doesn't just find the order, it
  // also opens it to show which line item matched.
  useEffect(() => {
    const q = orderSearch.toLowerCase().trim();
    if (!q) return;
    setExpandedOrderIds(prev => {
      const next = { ...prev };
      let changed = false;
      filteredSortedOrders.forEach(o => {
        const matchesStock = o.lineItems.some(l => l.stockCode.toLowerCase().includes(q));
        if (matchesStock && !next[o.id]) {
          next[o.id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [orderSearch, filteredSortedOrders]);

  // Drop any bulk-selected ids that scrolled out of the current filtered/live set.
  useEffect(() => {
    const validIds = new Set(filteredSortedOrders.map(o => o.id));
    setSelectedOrderIds(prev => {
      const next = new Set([...prev].filter(id => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredSortedOrders]);

  const allOrdersSelected = filteredSortedOrders.length > 0 && selectedOrderIds.size === filteredSortedOrders.length;
  const someOrdersSelected = selectedOrderIds.size > 0 && !allOrdersSelected;

  const toggleSelectAllOrders = () => {
    setSelectedOrderIds(allOrdersSelected ? new Set() : new Set(filteredSortedOrders.map(o => o.id)));
  };

  const toggleSelectOneOrder = (id: string) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleOpenOrderModal = (order?: Order) => {
    setEditingOrder(order || null);
    setIsOrderModalOpen(true);
  };

  const handleSaveOrder = async (data: Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (editingOrder) {
      return await updateOrder(editingOrder.id, data);
    }
    return await addOrder(data);
  };

  const handleDeleteOrder = async (id: string) => {
    return await deleteOrder(id);
  };

  const handleBulkDeleteOrders = async () => {
    setBulkDeleting(true);
    try {
      const ok = await deleteOrders([...selectedOrderIds]);
      if (ok) {
        setSelectedOrderIds(new Set());
        setBulkDeleteConfirm(false);
      }
    } finally {
      setBulkDeleting(false);
    }
  };

  const totalUnitsForOrder = (o: Order) => o.lineItems.reduce((s, l) => s + l.qty, 0);

  // Builds tab handlers (unchanged from the pre-merge OrderBuilderList.tsx)
  const handleDeleteBuild = async (buildId: string) => {
    const build = builds.find(b => b.id === buildId);
    if (!build) return;
    setDeletingBuildId(buildId);
    try {
      await deleteBuild(build);
      toast.success(`Build #${build.buildNumber} deleted`, { description: 'Its orders are available to bundle again.' });
      setDeleteConfirmBuildId(null);
    } catch (err) {
      toast.error('Failed to delete build', { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setDeletingBuildId(null);
    }
  };

  const handleCopyBuild = async (build: OrderBuild) => {
    try {
      await navigator.clipboard.writeText(formatBuildAsText(build));
      toast.success(`Build #${build.buildNumber} copied to clipboard`);
    } catch (err) {
      toast.error('Failed to copy build details', { description: err instanceof Error ? err.message : String(err) });
    }
  };

  const filteredBuilds = useMemo(() => {
    const q = buildSearchQuery.toLowerCase().trim();
    if (!q) return builds;
    return builds.filter(b =>
      b.buildNumber.toLowerCase().includes(q) ||
      b.schoolGroups.some(g => g.schoolName.toLowerCase().includes(q))
    );
  }, [builds, buildSearchQuery]);

  const totalsForBuild = (b: OrderBuild) => {
    const schools = b.schoolGroups.length;
    const orderCount = b.schoolGroups.reduce((s, g) => s + g.orderIds.length, 0);
    const units = b.schoolGroups.reduce((s, g) => s + g.lineItems.reduce((s2, li) => s2 + li.qty, 0), 0);
    return { schools, orders: orderCount, units };
  };

  // Platform-agnostic dialogs, shared verbatim between the desktop and mobile
  // renders below (same as OrderFormModal already was on the old Orders screen).
  // OrderBuilderSettingsDialog is NOT here - it has a distinct Mobile variant
  // (OrderBuilderSettingsDialogMobile) that OrderBuilderListMobile manages itself.
  const sharedModals = (
    <>
      <OrderFormModal isOpen={isOrderModalOpen} order={editingOrder} onSave={handleSaveOrder} onClose={() => setIsOrderModalOpen(false)} />
      <OrdersImportDialog isOpen={isImportOpen} addOrder={addOrder} existingOrders={orders} onClose={() => setIsImportOpen(false)} />
      <OrdersLocationSettingsDialog isOpen={isLocationSettingsOpen} onClose={() => setIsLocationSettingsOpen(false)} maxDistanceKm={maxDistanceKm} onSave={handleSaveMaxDistance} />
    </>
  );

  if (isMobile) {
    return (
      <>
        {hasValidKey ? (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
            <OrderLocationGeocoder orders={orders} onSchoolPinsChange={setSchoolPins} onAreaPinsChange={setAreaPins} />
            <OrderBuilderListMobile
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              hasValidKey={hasValidKey}
              mapOrders={filteredSortedOrders}
              warehouse={settings}
              selectedArea={selectedArea}
              setSelectedArea={setSelectedArea}
              areasList={areasList}
              isMapFullscreen={isMapFullscreen}
              setIsMapFullscreen={setIsMapFullscreen}
              selectedSchoolGroup={selectedSchoolGroup}
              onPinClick={handleMapPinClick}
              onCloseSchoolDetails={() => setSelectedSchoolKey(null)}
              onViewSchoolInOrders={handleViewSchoolInOrders}
              onEditOrderFromSchool={handleOpenOrderModal}
              locationIssueByOrderId={locationIssueByOrderId}
              builds={filteredBuilds}
              buildsLoading={buildsLoading}
              buildsError={buildsError}
              buildSearchQuery={buildSearchQuery}
              setBuildSearchQuery={setBuildSearchQuery}
              onOpenBuild={(id) => navigate(`/order-builder/build/${id}`)}
              onNewBuild={() => navigate('/order-builder/build')}
              onCopyBuild={handleCopyBuild}
              onDeleteBuild={(build: OrderBuild) => handleDeleteBuild(build.id)}
              orders={filteredSortedOrders}
              ordersLoading={ordersLoading}
              ordersError={ordersError}
              orderSearch={orderSearch}
              setOrderSearch={setOrderSearch}
              orderStatusFilter={orderStatusFilter}
              setOrderStatusFilter={setOrderStatusFilter}
              onOpenOrderModal={handleOpenOrderModal}
              onOpenImport={() => setIsImportOpen(true)}
              onOpenLocationSettings={() => setIsLocationSettingsOpen(true)}
              onDeleteOrder={handleDeleteOrder}
              selectedOrderIds={selectedOrderIds}
              onToggleOrderOne={toggleSelectOneOrder}
              onToggleOrderAll={toggleSelectAllOrders}
              allOrdersSelected={allOrdersSelected}
              onDeleteSelectedOrders={handleBulkDeleteOrders}
              locationIssueCount={locationIssueIds.size}
              activeOrderCount={activeOrderCount}
              completeOrderCount={completeOrderCount}
              stockCoverageByOrderId={stockCoverageByOrderId}
              stockCoverageLoading={stockControlLoading}
              onLocationIssuesClick={handleLocationIssuesClick}
              onActiveOrdersClick={handleActiveOrdersClick}
              onCompleteOrdersClick={handleCompleteOrdersClick}
            />
          </APIProvider>
        ) : (
          <OrderBuilderListMobile
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            hasValidKey={hasValidKey}
            mapOrders={filteredSortedOrders}
            warehouse={settings}
            selectedArea={selectedArea}
            setSelectedArea={setSelectedArea}
            areasList={areasList}
            isMapFullscreen={isMapFullscreen}
            setIsMapFullscreen={setIsMapFullscreen}
            selectedSchoolGroup={selectedSchoolGroup}
            onPinClick={handleMapPinClick}
            onCloseSchoolDetails={() => setSelectedSchoolKey(null)}
            onViewSchoolInOrders={handleViewSchoolInOrders}
            onEditOrderFromSchool={handleOpenOrderModal}
            locationIssueByOrderId={locationIssueByOrderId}
            builds={filteredBuilds}
            buildsLoading={buildsLoading}
            buildsError={buildsError}
            buildSearchQuery={buildSearchQuery}
            setBuildSearchQuery={setBuildSearchQuery}
            onOpenBuild={(id) => navigate(`/order-builder/build/${id}`)}
            onNewBuild={() => navigate('/order-builder/build')}
            onCopyBuild={handleCopyBuild}
            onDeleteBuild={(build: OrderBuild) => handleDeleteBuild(build.id)}
            orders={filteredSortedOrders}
            ordersLoading={ordersLoading}
            ordersError={ordersError}
            orderSearch={orderSearch}
            setOrderSearch={setOrderSearch}
            orderStatusFilter={orderStatusFilter}
            setOrderStatusFilter={setOrderStatusFilter}
            onOpenOrderModal={handleOpenOrderModal}
            onOpenImport={() => setIsImportOpen(true)}
            onOpenLocationSettings={() => setIsLocationSettingsOpen(true)}
            onDeleteOrder={handleDeleteOrder}
            selectedOrderIds={selectedOrderIds}
            onToggleOrderOne={toggleSelectOneOrder}
            onToggleOrderAll={toggleSelectAllOrders}
            allOrdersSelected={allOrdersSelected}
            onDeleteSelectedOrders={handleBulkDeleteOrders}
            locationIssueCount={locationIssueIds.size}
            activeOrderCount={activeOrderCount}
            completeOrderCount={completeOrderCount}
            stockCoverageByOrderId={stockCoverageByOrderId}
            stockCoverageLoading={stockControlLoading}
            onLocationIssuesClick={handleLocationIssuesClick}
            onActiveOrdersClick={handleActiveOrdersClick}
            onCompleteOrdersClick={handleCompleteOrdersClick}
          />
        )}
        {sharedModals}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <PackagePlus className="w-7 h-7 text-brand-accent shrink-0" />
            Order Builder
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Bundle orders from the same school into a single delivery-ready build.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="Order Builder settings"
            className="p-2.5 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:text-zinc-700 hover:bg-zinc-50 transition-all shadow-2xs cursor-pointer"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/order-builder/build')}
            title="Start a new order build"
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            Build
          </button>
        </div>
      </div>

      {hasValidKey ? (
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
          <OrderLocationGeocoder orders={orders} onSchoolPinsChange={setSchoolPins} onAreaPinsChange={setAreaPins} />

          <div className={cn(
            isMapFullscreen
              ? 'fixed inset-0 z-[100] bg-zinc-50 flex flex-col'
              : 'bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-lg'
          )}>
            {isMapFullscreen ? (
              <div className="bg-white border-b border-zinc-200 px-6 py-4 flex flex-col lg:flex-row items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="p-2 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
                    <MapPin className="w-4 h-4 text-brand-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-brand-primary uppercase tracking-tight">Order Map — Fullscreen</h2>
                    <p className="text-[11px] text-zinc-400 font-medium">Click a pin to view a school's orders.</p>
                  </div>
                </div>

                <OrderMapPinFiltersControls
                  search={orderSearch} setSearch={setOrderSearch}
                  selectedArea={selectedArea} setSelectedArea={setSelectedArea}
                  orderStatusFilter={orderStatusFilter} setOrderStatusFilter={setOrderStatusFilter}
                  areasList={areasList}
                />

                <button
                  type="button"
                  title="Exit Fullscreen (Esc)"
                  onClick={() => setIsMapFullscreen(false)}
                  className="flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl font-bold text-xs hover:bg-zinc-800 transition-all shadow-sm shrink-0"
                >
                  <Minimize2 className="w-4 h-4" />
                  Exit Fullscreen
                </button>
              </div>
            ) : (
              <div className="bg-zinc-50 border-b border-zinc-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Map Pin Filters</span>
                  <span className="h-4 w-px bg-zinc-200" />
                  <p className="text-xs text-zinc-500 font-medium">Filters the map below and the Orders table.</p>
                </div>

                <OrderMapPinFiltersControls
                  search={orderSearch} setSearch={setOrderSearch}
                  selectedArea={selectedArea} setSelectedArea={setSelectedArea}
                  orderStatusFilter={orderStatusFilter} setOrderStatusFilter={setOrderStatusFilter}
                  areasList={areasList}
                />
              </div>
            )}

            <div className={cn(isMapFullscreen ? 'flex-1 flex min-h-0' : '')}>
              {isMapFullscreen && (
                <div className="w-[380px] shrink-0 border-r border-zinc-200 bg-white overflow-y-auto">
                  {selectedSchoolGroup ? (
                    <SchoolOrdersDetailsPanel
                      schoolName={selectedSchoolGroup.schoolName}
                      orders={selectedSchoolGroup.orders}
                      locationIssueByOrderId={locationIssueByOrderId}
                      variant="sidebar"
                      onClose={() => setSelectedSchoolKey(null)}
                      onViewInOrders={() => handleViewSchoolInOrders(selectedSchoolGroup.schoolName)}
                      onEditOrder={handleOpenOrderModal}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                      <MapPin className="w-10 h-10 text-zinc-200 mb-3" />
                      <p className="text-zinc-500 font-bold text-sm uppercase tracking-tight">No School Selected</p>
                      <p className="text-zinc-400 text-xs mt-1 max-w-[220px]">Click any pin on the map to view that school's orders here.</p>
                    </div>
                  )}
                </div>
              )}

              <div className={cn(isMapFullscreen ? 'flex-1 relative bg-zinc-100' : 'h-[360px] w-full relative bg-zinc-100')}>
                <OrderBuilderMap
                  orders={filteredSortedOrders}
                  selectedOrderIds={NO_SELECTED_ORDERS}
                  onToggleOrder={noop}
                  onSetOrdersForSchool={noop}
                  warehouse={settings}
                  readOnly
                  colorMode="status"
                  locationIssueOrderIds={locationIssueIds}
                  onPinClick={handleMapPinClick}
                />

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

          {!isMapFullscreen && selectedSchoolGroup && (
            <SchoolOrdersDetailsPanel
              schoolName={selectedSchoolGroup.schoolName}
              orders={selectedSchoolGroup.orders}
              locationIssueByOrderId={locationIssueByOrderId}
              variant="card"
              onClose={() => setSelectedSchoolKey(null)}
              onViewInOrders={() => handleViewSchoolInOrders(selectedSchoolGroup.schoolName)}
              onEditOrder={handleOpenOrderModal}
            />
          )}
        </APIProvider>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 text-center text-zinc-500 p-6 text-sm">
          Add a Google Maps API key (<code>GOOGLE_MAPS_PLATFORM_KEY</code>) to see order locations on a map.
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-zinc-200">
        <button
          type="button"
          title="Show builds"
          onClick={() => setActiveTab('builds')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer',
            activeTab === 'builds' ? 'border-brand-accent text-brand-primary' : 'border-transparent text-zinc-500 hover:text-zinc-700'
          )}
        >
          <PackagePlus className="w-4 h-4" />
          Builds
        </button>
        <button
          type="button"
          title="Show orders"
          onClick={() => setActiveTab('orders')}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer',
            activeTab === 'orders' ? 'border-brand-accent text-brand-primary' : 'border-transparent text-zinc-500 hover:text-zinc-700'
          )}
        >
          <ClipboardList className="w-4 h-4" />
          Orders
        </button>
      </div>

      {activeTab === 'builds' ? (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-zinc-200 bg-zinc-50/30 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
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
            <div className="text-xs font-medium text-zinc-500 shrink-0">
              {filteredBuilds.length} build{filteredBuilds.length === 1 ? '' : 's'}
            </div>
          </div>

          {buildsLoading ? (
            <div className="p-20 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
              <p className="text-zinc-500 font-medium text-sm">Loading builds…</p>
            </div>
          ) : buildsError ? (
            <div className="p-16 text-center max-w-lg mx-auto">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
              <h3 className="text-lg font-bold text-zinc-900 mt-4">Database Connection Problem</h3>
              <p className="text-sm text-zinc-500 mt-2">{buildsError}</p>
            </div>
          ) : filteredBuilds.length === 0 ? (
            <div className="p-16 text-center max-w-md mx-auto">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-4 border border-zinc-200">
                <School className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">No builds yet</h3>
              <p className="text-sm text-zinc-500 mt-1.5">
                {buildSearchQuery ? 'No results match your search.' : 'Bundle your first set of school orders to get started.'}
              </p>
              {!buildSearchQuery && (
                <button
                  type="button"
                  onClick={() => navigate('/order-builder/build')}
                  title="Start a new order build"
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-white font-semibold text-sm rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
                >
                  <PackagePlus className="w-4 h-4" />
                  Build
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/70 border-b border-zinc-200">
                    <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Build #</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Delivery Date</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Schools</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Orders</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Units</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider">Created</th>
                    <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[120px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredBuilds.map((b) => {
                    const { schools, orders: orderCount, units } = totalsForBuild(b);
                    return (
                      <tr
                        key={b.id}
                        onClick={() => navigate(`/order-builder/build/${b.id}`)}
                        className="hover:bg-zinc-50/40 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-4 text-sm font-mono font-semibold text-zinc-850">
                          Build #{b.buildNumber}
                          {b.truckName && <p className="text-[10px] font-sans font-normal text-zinc-400 mt-0.5">{b.truckName}</p>}
                        </td>
                        <td className="px-5 py-4 text-sm text-zinc-600">{formatBuildDate(b.deliveryDate)}</td>
                        <td className="px-5 py-4 text-sm text-zinc-600 text-right font-mono">{schools}</td>
                        <td className="px-5 py-4 text-sm text-zinc-600 text-right font-mono">{orderCount}</td>
                        <td className="px-5 py-4 text-sm font-bold text-zinc-800 text-right font-mono">{units}</td>
                        <td className="px-5 py-4 text-xs text-zinc-400">
                          {b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-ZA') : '—'}
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              title="Copy build details"
                              onClick={() => handleCopyBuild(b)}
                              className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            {deleteConfirmBuildId === b.id ? (
                              <>
                                <button
                                  type="button"
                                  title="Confirm delete"
                                  onClick={() => handleDeleteBuild(b.id)}
                                  disabled={deletingBuildId === b.id}
                                  className="p-1.5 text-white bg-red-500 rounded-lg border border-red-600 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                  {deletingBuildId === b.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  title="Cancel delete"
                                  onClick={() => setDeleteConfirmBuildId(null)}
                                  disabled={deletingBuildId === b.id}
                                  className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                title="Delete build"
                                onClick={() => setDeleteConfirmBuildId(b.id)}
                                className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
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
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <OrdersKpiRow
            locationIssueCount={locationIssueIds.size}
            activeCount={activeOrderCount}
            completeCount={completeOrderCount}
            onLocationIssuesClick={handleLocationIssuesClick}
            onActiveClick={handleActiveOrdersClick}
            onCompleteClick={handleCompleteOrdersClick}
          />

          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-zinc-200 bg-zinc-50/30 flex flex-col md:flex-row gap-4 items-center justify-between">
              <p className="text-xs text-zinc-400 font-medium">
                Filtered by the Map Pin Filters above.
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {selectedOrderIds.size > 0 && (
                  bulkDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-600">Delete {selectedOrderIds.size} order{selectedOrderIds.size === 1 ? '' : 's'}?</span>
                      <button
                        type="button"
                        title="Confirm bulk delete"
                        onClick={handleBulkDeleteOrders}
                        disabled={bulkDeleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-white bg-red-500 hover:bg-red-600 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {bulkDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Confirm
                      </button>
                      <button
                        type="button"
                        title="Cancel bulk delete"
                        onClick={() => setBulkDeleteConfirm(false)}
                        disabled={bulkDeleting}
                        className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-all cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      title="Delete selected orders"
                      onClick={() => setBulkDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete {selectedOrderIds.size} Selected
                    </button>
                  )
                )}
                <div className="text-xs font-medium text-zinc-500 shrink-0">
                  {filteredSortedOrders.length} order{filteredSortedOrders.length === 1 ? '' : 's'}
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  title="Import Orders"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 font-semibold text-xs transition-all shadow-2xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-zinc-500" />
                  Import
                </button>
                <button
                  type="button"
                  onClick={() => setIsLocationSettingsOpen(true)}
                  title="Location Issue Settings"
                  className="p-2 rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-all shadow-2xs cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenOrderModal()}
                  title="Add Order"
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-accent text-white font-semibold text-xs rounded-xl hover:bg-brand-accent/95 active:scale-98 transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Order
                </button>
              </div>
            </div>

            {ordersLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-10 h-10 text-brand-accent animate-spin" />
                <p className="text-zinc-500 font-medium text-sm">Loading orders…</p>
              </div>
            ) : ordersError ? (
              <div className="p-16 text-center max-w-lg mx-auto">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
                <h3 className="text-lg font-bold text-zinc-900 mt-4">Database Connection Problem</h3>
                <p className="text-sm text-zinc-500 mt-2">{ordersError}</p>
              </div>
            ) : filteredSortedOrders.length === 0 ? (
              <div className="p-16 text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400 mb-4 border border-zinc-200">
                  <ClipboardList className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900">No orders found</h3>
                <p className="text-sm text-zinc-500 mt-1.5">
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
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50/70 border-b border-zinc-200">
                      <th className="px-5 py-3.5 w-10">
                        <input
                          type="checkbox"
                          title="Select all orders"
                          checked={allOrdersSelected}
                          ref={(el) => { if (el) el.indeterminate = someOrdersSelected; }}
                          onChange={toggleSelectAllOrders}
                          className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30 cursor-pointer"
                        />
                      </th>
                      <SortHeader label="School" field="schoolName" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Order No." field="orderNumber" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Area" field="area" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="School Type" field="schoolType" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Status" field="status" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider w-[140px]">Stock Coverage</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Units</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right w-[70px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredSortedOrders.map((o) => {
                      const isExpanded = !!expandedOrderIds[o.id];
                      const q = orderSearch.toLowerCase().trim();
                      return (
                        <Fragment key={o.id}>
                          <tr
                            onClick={() => toggleOrderExpanded(o.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleOrderExpanded(o.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            className={cn(
                              'hover:bg-zinc-50/40 transition-colors cursor-pointer',
                              (isExpanded || selectedOrderIds.has(o.id)) && 'bg-brand-accent/5'
                            )}
                          >
                            <td className="px-5 py-4" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                title={`Select order for ${o.schoolName}`}
                                checked={selectedOrderIds.has(o.id)}
                                onChange={() => toggleSelectOneOrder(o.id)}
                                className="w-4 h-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/30 cursor-pointer"
                              />
                            </td>
                            <td className="px-5 py-4">
                              <p className="text-sm font-semibold text-zinc-850">{o.schoolName}</p>
                              {o.clientNumber && <p className="text-[10px] text-zinc-400 mt-0.5">Client #{o.clientNumber}</p>}
                            </td>
                            <td className="px-5 py-4 text-sm font-mono text-zinc-600">{o.orderNumber || '—'}</td>
                            <td className="px-5 py-4 text-sm text-zinc-600">
                              <div className="flex items-center gap-1.5">
                                {o.area || '—'}
                                {locationIssueByOrderId.has(o.id) && (
                                  <span title={`School geocodes ~${Math.round(locationIssueByOrderId.get(o.id)!.distanceKm)}km from "${o.area}"`}>
                                    <MapPinOff className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-sm text-zinc-600">{o.schoolType || '—'}</td>
                            <td className="px-5 py-4">
                              <span className={cn(
                                'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide',
                                o.status === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                              )}>
                                {o.status}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              {stockControlLoading ? (
                                <div className="w-full bg-zinc-100 h-2 rounded-full animate-pulse" />
                              ) : (() => {
                                const coverage = stockCoverageByOrderId.get(o.id) ?? { neededUnits: 0, coverableUnits: 0, pct: 100 };
                                return (
                                  <div
                                    className="space-y-1"
                                    title={coverage.neededUnits === 0
                                      ? 'Fully reserved - nothing left to book'
                                      : `Needs ${coverage.neededUnits} · In stock now: ${coverage.coverableUnits}`}
                                  >
                                    <div className="flex items-center justify-between gap-2 text-[10px] font-mono font-bold">
                                      <span className={coverage.pct >= 100 ? 'text-emerald-600' : 'text-amber-600'}>{coverage.pct}%</span>
                                    </div>
                                    <PhaseProgressBar pct={coverage.pct} accent={coverage.pct >= 100 ? 'emerald' : 'amber'} />
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-5 py-4 text-sm font-bold text-zinc-800 text-right font-mono">{totalUnitsForOrder(o)}</td>
                            <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                              <div className="flex justify-end">
                                <MobileCardActionsMenu
                                  actions={[
                                    { label: 'Edit', icon: Edit2, onClick: () => handleOpenOrderModal(o) },
                                    {
                                      label: 'Delete',
                                      icon: Trash2,
                                      destructive: true,
                                      onClick: () => {
                                        if (window.confirm(`Delete the order for ${o.schoolName}?`)) handleDeleteOrder(o.id);
                                      }
                                    }
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="bg-zinc-50/20" onClick={(e) => e.stopPropagation()}>
                              <td colSpan={9} className="px-5 py-4 border-b border-zinc-100">
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Line Items</h4>
                                    <span className="text-[10px] font-bold text-zinc-400 bg-white border border-zinc-200 px-2 py-0.5 rounded-full">
                                      {o.lineItems.length} item{o.lineItems.length === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                  <div className="overflow-hidden border border-zinc-200/60 rounded-xl bg-white shadow-sm">
                                    <table className="w-full text-left table-fixed">
                                      <thead>
                                        <tr className="border-b border-zinc-100 bg-zinc-50/50 italic font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                                          <th className="px-4 py-3 font-normal w-[70%]">Stock Code</th>
                                          <th className="px-4 py-3 font-normal text-right w-[30%]">Qty</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-100 text-xs">
                                        {o.lineItems.length === 0 ? (
                                          <tr>
                                            <td colSpan={2} className="px-4 py-4 text-center text-zinc-400 italic">
                                              No line items present for this order.
                                            </td>
                                          </tr>
                                        ) : (
                                          o.lineItems.map((item, idx) => {
                                            const isCodeMatched = q.length > 0 && item.stockCode.toLowerCase().includes(q);
                                            return (
                                              <tr
                                                key={idx}
                                                className={cn(
                                                  'hover:bg-zinc-50/30 transition-colors',
                                                  isCodeMatched ? 'bg-amber-50/80 hover:bg-amber-50' : ''
                                                )}
                                              >
                                                <td className="px-4 py-3 font-mono">{item.stockCode || '—'}</td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-zinc-800">{item.qty}</td>
                                              </tr>
                                            );
                                          })
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {sharedModals}
      <OrderBuilderSettingsDialog isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
