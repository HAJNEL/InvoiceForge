import { useState } from 'react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Search, Calendar, CalendarDays, ChevronRight, LogOut, Loader2, Shield, Info, AlertTriangle, Truck, RefreshCw,
  Package, ClipboardList, X, ListTodo, FileText, MapPin, Filter, UserCircle, CalendarCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Trip, TripStatus, TeamMember } from '../../types';
import { UIDashboardInvoice, CatalogProduct, TeamInventoryItem } from './useTeamDashboard';
import { KnockdownItem } from '../stock/hooks/useStock';
import { NRLogo } from '../../components/Logo';
import { MobileSheet } from '../../components/mobile/MobileSheet';
import { MobileCard } from '../../components/mobile/MobileCard';
import { TripOverviewTableMobile } from './components/TripOverviewTableMobile';

interface StockCountItem {
  stockCode: string;
  description: string;
  displayName?: string;
  isPart?: boolean;
  parentItem?: string | null;
}

const ROLE_DOT_COLOR: Record<string, string> = {
  'Stock Counter': 'bg-emerald-500',
  'Assembler': 'bg-blue-500',
  'Loader': 'bg-orange-500',
  'Invoice Management': 'bg-sky-500',
  'Trip Overview': 'bg-rose-500',
};

interface TeamDashboardMobileProps {
  profile: TeamMember | null;
  trips: Trip[];
  invoices: UIDashboardInvoice[];
  invoicesCount: number | null;
  isOwner: boolean;
  loading: boolean;
  errorWord: string;
  knockdownItems: KnockdownItem[];
  catalogProducts: CatalogProduct[];
  inventoryItems: TeamInventoryItem[];

  rolesWithFallback: string[];
  currentRole: string;
  onSelectRole: (role: string) => void;

  todayPlannerEntriesCount: number;
  onOpenPlanner: () => void;
  onOpenTasks: () => void;
  openTaskCount: number;

  onBackToMainAccount: () => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  calendarSyncEnabled: boolean;
  unsyncedCalendarCount: number;
  onOpenCalendarSync: () => void;
}

/**
 * Mobile counterpart of TeamDashboard. Reuses the exact data/handlers computed
 * by the parent (useTeamDashboard + local filter/role state) — this component
 * owns only presentation and the stock-take/invoice-filter UI-local state that
 * doesn't need to be shared with the desktop path.
 */
export function TeamDashboardMobile({
  profile, trips, invoices, invoicesCount, isOwner, loading, errorWord,
  knockdownItems, catalogProducts, inventoryItems,
  rolesWithFallback, currentRole, onSelectRole,
  todayPlannerEntriesCount, onOpenPlanner, onOpenTasks, openTaskCount,
  onBackToMainAccount, onLogout, onOpenProfile,
  calendarSyncEnabled, unsyncedCalendarCount, onOpenCalendarSync,
}: TeamDashboardMobileProps) {
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);

  // Stock counter catalog tab
  const [stockCatalogTab, setStockCatalogTab] = useState<'products' | 'knockdown' | 'consumables'>('products');
  const [definedCounts, setDefinedCounts] = useState<Record<string, number>>({});
  const [activeGroupToCount, setActiveGroupToCount] = useState<StockCountItem | null>(null);
  const [enteredQty, setEnteredQty] = useState<string>('');
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  // Invoice Management filter state
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceDistrictFilter, setInvoiceDistrictFilter] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('');
  const [showInvoiceFilters, setShowInvoiceFilters] = useState(false);

  // Search & Filter state (trip lists)
  const [searchQuery, setSearchQuery] = useState('');

  const productItems: StockCountItem[] = (catalogProducts || [])
    .filter(p => (p.category || 'product') === 'product')
    .map(p => ({ stockCode: p.stockCode, description: p.description, displayName: p.description }));

  const knockdownCatalogItems: StockCountItem[] = (knockdownItems || [])
    .filter(k => k.type === 'knockdown')
    .map(k => ({ stockCode: k.stockCode, description: k.description, displayName: k.displayName }));

  const consumableItems: StockCountItem[] = [
    ...(catalogProducts || []).filter(p => p.category === 'consumable').map(p => ({ stockCode: p.stockCode, description: p.description, displayName: p.description })),
    ...(knockdownItems || []).filter(k => k.type === 'consumable').map(k => ({ stockCode: k.stockCode, description: k.description, displayName: k.displayName }))
  ];

  const activeStockItemsBase = stockCatalogTab === 'products' ? productItems
    : stockCatalogTab === 'knockdown' ? knockdownCatalogItems
    : consumableItems;
  const stockQ = searchQuery.toLowerCase().trim();
  const activeStockItems = !stockQ ? activeStockItemsBase : activeStockItemsBase.filter(i =>
    i.stockCode.toLowerCase().includes(stockQ) ||
    i.description.toLowerCase().includes(stockQ) ||
    (i.displayName || '').toLowerCase().includes(stockQ)
  );

  const allCatalogItems: StockCountItem[] = [...productItems, ...knockdownCatalogItems, ...consumableItems];

  const handleSubmitStockTake = async () => {
    const records = Object.entries(definedCounts);
    if (records.length === 0) {
      toast.warning('Nothing Counted Yet', { description: 'Tap an item and enter its physical quantity before submitting.' });
      return;
    }

    setIsSubmittingStock(true);
    try {
      const { auth, db } = await import('../../lib/firebase');
      const userUid = auth.currentUser?.uid || '';
      const ownerId = profile?.ownerId || userUid;
      const submitterName = profile
        ? `${profile.firstName} ${profile.lastName}`.trim()
        : (auth.currentUser?.email || 'Team Member');

      const { getDocs, query, collection, where, setDoc, doc } = await import('firebase/firestore');
      const takesSnap = await getDocs(
        query(collection(db, 'stock_takes'), where('userId', '==', ownerId))
      );

      let maxNum = 0;
      takesSnap.forEach(docSnap => {
        const data = docSnap.data();
        const codeNum = parseInt(data.code, 10);
        if (!isNaN(codeNum) && codeNum > maxNum) {
          maxNum = codeNum;
        }
      });
      const nextCode = String(maxNum + 1).padStart(4, '0');

      const itemsToSave = records.map(([key, qty]) => {
        const item = allCatalogItems.find(i => `${i.stockCode}_${i.description}` === key);
        return {
          stockCode: item?.stockCode || key.split('_')[0],
          description: item?.description || '',
          isPart: false,
          parentItem: null,
          countedQty: qty,
          expectedQty: 0,
          status: 'pending'
        };
      });

      const newTakeId = doc(collection(db, 'stock_takes')).id;

      await setDoc(doc(db, 'stock_takes', newTakeId), {
        id: newTakeId,
        code: nextCode,
        submittedBy: submitterName,
        submittedByUserId: userUid,
        userId: ownerId,
        submittedAt: new Date().toISOString(),
        status: 'pending',
        items: itemsToSave
      });

      setDefinedCounts({});
      toast.success('Stock Take Submitted', { description: `Stock take #${nextCode} is now awaiting administrator approval.` });
    } catch (err) {
      console.error("Failed to submit stock take:", err);
      toast.error('Submission Failed', { description: 'Could not submit stock count. Check your connection and try again.' });
    } finally {
      setIsSubmittingStock(false);
    }
  };

  // Invoice Management: derive unique district list and filtered invoices
  const allDistricts = Array.from(
    new Set((invoices || []).map(inv => (inv.district || '').trim().toUpperCase()).filter(Boolean))
  ).sort();

  const filteredInvoicesForManagement = (invoices || []).filter(inv => {
    const q = invoiceSearch.toLowerCase().trim();
    const matchesSearch = !q ||
      inv.number.toLowerCase().includes(q) ||
      inv.client.toLowerCase().includes(q) ||
      (inv.district || '').toLowerCase().includes(q) ||
      (inv.deliveryAddress || '').toLowerCase().includes(q);
    const matchesDistrict = !invoiceDistrictFilter ||
      (inv.district || '').trim().toUpperCase() === invoiceDistrictFilter;
    const matchesStatus = !invoiceStatusFilter || (inv.status || '').toLowerCase() === invoiceStatusFilter.toLowerCase();
    return matchesSearch && matchesDistrict && matchesStatus;
  });

  // Filter list of trips based on active role constraints and queries
  const filteredTrips = trips.filter(trip => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      trip.name.toLowerCase().includes(q) ||
      (trip.truckName || '').toLowerCase().includes(q) ||
      (trip.truckId || '').toLowerCase().includes(q) ||
      (trip.stops || []).some(stop => stop.client.toLowerCase().includes(q));

    let matchesFilter = true;
    if (currentRole === 'Assembler') {
      matchesFilter = trip.status === TripStatus.PROPOSED;
    } else if (currentRole === 'Loader') {
      matchesFilter = trip.status === TripStatus.ASSEMBLED;
    } else if (currentRole === 'Delivered Checker') {
      matchesFilter = trip.status === TripStatus.ON_ROUTE;
    }

    // Pending trips are still being planned and must stay hidden from the team
    // until they are published (promoted to 'proposed').
    const isVisibleToTeam = trip.status !== TripStatus.PENDING;

    return matchesSearch && matchesFilter && isVisibleToTeam;
  });

  const getTripCheckProgress = (trip: Trip) => {
    const items = trip.manifestItems || [];
    if (items.length === 0) return { total: 0, checked: 0, percentage: 0 };

    let checkedCount = 0;
    const checkedState = trip.checkedItems || {};

    items.forEach((item: { stockCode?: string; description?: string }, idx: number) => {
      const keyUnified = `${item.stockCode || 'NO_STOCK'}_${item.description || ''}`;
      const keyLegacy = `${item.stockCode}-${idx}`;
      if (checkedState[keyUnified] || checkedState[keyLegacy]) {
        checkedCount++;
      }
    });

    const percentage = Math.round((checkedCount / items.length) * 100);
    return { total: items.length, checked: checkedCount, percentage };
  };

  // Many roles possible (up to 6) — keep as a horizontally scrollable pill
  // strip (snap-scroll, consistent with KpiStatsRowMobile) rather than a
  // <select>, since this is a primary navigation control the user taps often.
  const showRolePills = rolesWithFallback.length > 0;

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-start">
      {/* Sticky Top Mobile Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 h-14 px-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          {isOwner && (
            <button
              type="button"
              onClick={onBackToMainAccount}
              title="Back to main account"
              className="p-2 -ml-1 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-all mobile-tap-target"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5] rotate-180" />
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-zinc-900 flex items-center justify-center p-0.5 select-none shrink-0">
            <NRLogo className="w-5 h-5" variant="light" />
          </div>
          <span className="font-mono text-[9px] font-black tracking-widest text-zinc-400 leading-none">NR PORTAL</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenPlanner}
            title="Today's Plan"
            className="p-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-all relative mobile-tap-target"
          >
            <CalendarDays className="w-5 h-5 stroke-[2.5]" />
            {todayPlannerEntriesCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-brand-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {todayPlannerEntriesCount}
              </span>
            )}
          </button>

          {calendarSyncEnabled && (
            <button
              type="button"
              onClick={onOpenCalendarSync}
              title={unsyncedCalendarCount > 0 ? `${unsyncedCalendarCount} trip(s) to sync to Google Calendar` : 'Sync trips to Google Calendar'}
              className="p-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-all relative mobile-tap-target"
            >
              <CalendarCheck className="w-5 h-5 stroke-[2.5]" />
              {unsyncedCalendarCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-brand-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unsyncedCalendarCount}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenTasks}
            title="My Tasks"
            className="p-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-all relative mobile-tap-target"
          >
            <ListTodo className="w-5 h-5 stroke-[2.5]" />
            {openTaskCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-brand-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {openTaskCount}
              </span>
            )}
          </button>

          <div className="relative">
            <button
              type="button"
              title="Account menu"
              onClick={() => setShowLogoutMenu(!showLogoutMenu)}
              className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-250 flex items-center justify-center font-bold text-xs uppercase text-zinc-700 hover:bg-zinc-200 transition-all mobile-tap-target overflow-hidden"
            >
              {profile?.photoBase64 ? (
                <img src={profile.photoBase64} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                profile?.firstName?.charAt(0) || 'U'
              )}
            </button>

            {showLogoutMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-2xl shadow-xl py-2 z-50 text-left animate-fade-in">
                <div className="px-4 py-2 border-b border-zinc-100 mb-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Signed in as{isOwner ? ' (Owner)' : ''}</p>
                  <p className="text-xs font-black text-zinc-800 truncate leading-snug">{profile?.firstName} {profile?.lastName}</p>
                </div>
                <button
                  type="button"
                  title="View profile"
                  onClick={() => { setShowLogoutMenu(false); onOpenProfile(); }}
                  className="w-full px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2 transition-all text-left mobile-tap-target"
                >
                  <UserCircle className="w-4 h-4" />
                  View Profile
                </button>
                <button
                  type="button"
                  title="Sign out"
                  onClick={onLogout}
                  className="w-full px-4 py-2 text-xs font-semibold text-red-650 hover:bg-red-50 flex items-center gap-2 transition-all text-left mobile-tap-target"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out / Exit
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Role pill strip */}
      {showRolePills && (
        <div className="sticky top-14 z-30 bg-zinc-50/95 backdrop-blur-sm border-b border-zinc-150 px-3 py-2.5 -mx-0">
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none">
            {rolesWithFallback.map((roleOpt) => {
              const isActive = currentRole === roleOpt;
              return (
                <button
                  key={roleOpt}
                  type="button"
                  title={roleOpt}
                  onClick={() => onSelectRole(roleOpt)}
                  className={cn(
                    "shrink-0 snap-start flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border mobile-tap-target",
                    isActive
                      ? "bg-zinc-950 text-white border-zinc-950 shadow-sm"
                      : "bg-white text-zinc-600 border-zinc-200"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", ROLE_DOT_COLOR[roleOpt] || 'bg-purple-500')} />
                  {roleOpt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <main className="flex-grow w-full px-3 py-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="w-9 h-9 text-brand-primary animate-spin mb-4" />
            <span className="text-xs font-semibold text-zinc-400 font-mono tracking-widest uppercase">Fetching Fleet Dispatches...</span>
          </div>
        ) : errorWord ? (
          <div className="bg-red-50 text-red-650 rounded-3xl border border-red-150 p-6 flex flex-col items-center text-center space-y-3">
            <AlertTriangle className="w-9 h-9 text-red-500 stroke-[2]" />
            <p className="text-xs font-bold leading-relaxed">{errorWord}</p>
          </div>
        ) : invoicesCount === 0 ? (
          <div className="bg-white rounded-3xl p-6 border border-zinc-200 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mx-auto">
              <Info className="w-6 h-6" />
            </div>
            <div className="space-y-1 text-center">
              <h3 className="font-bold text-zinc-900 text-sm">No Invoices Loaded</h3>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-xs mx-auto">
                Your primary administrator has not created any invoices yet. Please refresh once invoices are uploaded.
              </p>
            </div>
            <button
              type="button"
              title="Refresh"
              onClick={() => window.location.reload()}
              className="w-full bg-brand-primary text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-sm flex items-center justify-center gap-2 mobile-tap-target"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Option
            </button>
          </div>
        ) : currentRole === 'Invoice Management' ? (
          <div className="space-y-3">
            {/* Search */}
            <div className="bg-white rounded-2xl p-3 border border-zinc-200 shadow-sm space-y-2.5">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Search invoice #, client, address…"
                  title="Search invoices"
                  className="w-full pl-10 pr-4 py-2.5 border border-zinc-200 rounded-2xl text-xs bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <button
                type="button"
                title="Toggle filters"
                onClick={() => setShowInvoiceFilters(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-600 mobile-tap-target"
              >
                <span className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  Filters
                  {(invoiceDistrictFilter || invoiceStatusFilter) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-accent" />
                  )}
                </span>
                <span className="font-mono text-zinc-400">{filteredInvoicesForManagement.length} / {(invoices || []).length}</span>
              </button>

              {showInvoiceFilters && (
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                    <select
                      title="Filter by district"
                      value={invoiceDistrictFilter}
                      onChange={(e) => setInvoiceDistrictFilter(e.target.value)}
                      className="w-full appearance-none pl-8 pr-3 py-2.5 bg-white border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value="">All Districts</option>
                      {allDistricts.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                    <select
                      title="Filter by status"
                      value={invoiceStatusFilter}
                      onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                      className="w-full appearance-none pl-8 pr-3 py-2.5 bg-white border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    >
                      <option value="">All Statuses</option>
                      <option value="draft">Draft</option>
                      <option value="proposed">Proposed</option>
                      <option value="assembled">Assembled</option>
                      <option value="on_route">On Route</option>
                      <option value="delivered">Delivered</option>
                      <option value="invoiced">Invoiced</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Invoice cards */}
            {filteredInvoicesForManagement.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-zinc-200 text-center space-y-3">
                <FileText className="w-8 h-8 text-zinc-200 mx-auto stroke-[1.5]" />
                <p className="text-xs font-bold text-zinc-700">No invoices match your filters</p>
                <p className="text-[11px] text-zinc-400">Try adjusting the district, status, or search term.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredInvoicesForManagement.map((inv) => {
                  const statusNorm = (inv.status || 'draft').toLowerCase();
                  const statusColor =
                    statusNorm === 'delivered' || statusNorm === 'invoiced' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    statusNorm === 'on_route' || statusNorm === 'on-route' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    statusNorm === 'assembled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    statusNorm === 'proposed' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                    'bg-zinc-100 text-zinc-500 border-zinc-200';
                  return (
                    <MobileCard key={inv.id}>
                      <MobileCard.Primary>
                        <div className="min-w-0">
                          <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1 mb-0.5">
                            <FileText className="w-3 h-3" />
                            {inv.number}
                          </p>
                          <h3 className="font-black text-sm text-zinc-900 leading-snug truncate">{inv.client}</h3>
                        </div>
                        <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border shrink-0", statusColor)}>
                          {inv.status || 'draft'}
                        </span>
                      </MobileCard.Primary>

                      <MobileCard.Secondary>
                        {inv.district && (
                          <span className="flex items-center gap-1 bg-zinc-50 border border-zinc-150 px-2 py-1 rounded-lg font-mono">
                            <MapPin className="w-3 h-3 text-sky-500" />
                            {(inv.district || '').trim().toUpperCase()}
                          </span>
                        )}
                        <span className="flex items-center gap-1 bg-zinc-50 border border-zinc-150 px-2 py-1 rounded-lg font-mono">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          {inv.date}
                        </span>
                        <span className="flex items-center gap-1 bg-zinc-50 border border-zinc-150 px-2 py-1 rounded-lg font-sans font-bold text-zinc-700">
                          R {(inv.amount || 0).toLocaleString()}
                        </span>
                      </MobileCard.Secondary>

                      {inv.deliveryAddress && (
                        <p className="text-[11px] text-zinc-500 leading-snug truncate">{inv.deliveryAddress}</p>
                      )}

                      {inv.lineItems && inv.lineItems.length > 0 && (
                        <div className="bg-zinc-50 rounded-2xl border border-zinc-100 p-3 space-y-1.5">
                          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">
                            {inv.lineItems.length} Line {inv.lineItems.length === 1 ? 'Item' : 'Items'}
                          </p>
                          {inv.lineItems.slice(0, 4).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-mono text-[9px] font-bold bg-zinc-200/60 text-zinc-600 px-1.5 py-0.5 rounded shrink-0">
                                {item.stockCode || '—'}
                              </span>
                              <span className="flex-1 text-zinc-700 font-medium truncate">{item.description}</span>
                              <span className="font-black text-zinc-800 shrink-0">×{item.qty}</span>
                            </div>
                          ))}
                          {inv.lineItems.length > 4 && (
                            <p className="text-[9px] text-zinc-400 font-bold text-right">+{inv.lineItems.length - 4} more</p>
                          )}
                        </div>
                      )}
                    </MobileCard>
                  );
                })}
              </div>
            )}
          </div>
        ) : currentRole === 'Trip Overview' ? (
          <TripOverviewTableMobile trips={trips} invoices={invoices} />
        ) : currentRole === 'Stock Counter' ? (
          <div className="bg-white rounded-3xl p-4 border border-zinc-200 shadow-sm relative space-y-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-zinc-900">
                <ClipboardList className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-zinc-900">Stock Take</h3>
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">Count physical quantities across your product catalog.</p>
            </div>

            <div className="flex gap-1 bg-zinc-100 p-1 rounded-2xl">
              {([
                { key: 'products', label: 'Products', count: productItems.length },
                { key: 'knockdown', label: 'Knockdown', count: knockdownCatalogItems.length },
                { key: 'consumables', label: 'Consumables', count: consumableItems.length },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  title={tab.label}
                  onClick={() => setStockCatalogTab(tab.key)}
                  className={cn(
                    "flex-1 py-2 px-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 mobile-tap-target",
                    stockCatalogTab === tab.key
                      ? "bg-white text-brand-primary shadow-sm border border-zinc-200/60"
                      : "text-zinc-500"
                  )}
                >
                  {tab.label}
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-md text-[9px] font-black leading-none",
                    stockCatalogTab === tab.key ? "bg-brand-primary/10 text-brand-primary" : "bg-zinc-200 text-zinc-500"
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search stock code or description…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                title="Search items"
                className="w-full pl-10 pr-9 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-zinc-50 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  title="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 mobile-tap-target"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeStockItems.length > 0 && (
              <div className="bg-zinc-50 rounded-2xl p-3 border border-zinc-150 text-[11px] font-mono text-zinc-550 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-500" />
                  <span>Items: <strong>{activeStockItems.length}</strong></span>
                </div>
                <span className="bg-emerald-50 text-emerald-700 font-black px-2.5 py-0.5 rounded-full border border-emerald-150 font-sans text-[10px]">
                  {activeStockItems.filter(item => definedCounts[`${item.stockCode}_${item.description}`] !== undefined).length} / {activeStockItems.length} Counted
                </span>
              </div>
            )}

            <div className="space-y-2">
              {activeStockItems.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <Package className="w-10 h-10 text-zinc-300 mx-auto stroke-[1.5]" />
                  <div className="space-y-1">
                    {searchQuery.trim() ? (
                      <>
                        <p className="text-xs font-bold text-zinc-700">No results for "{searchQuery}"</p>
                        <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">Try a different stock code or description.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-zinc-700">No {stockCatalogTab} in catalog</p>
                        <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">Add {stockCatalogTab} in the Products screen to see them here.</p>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                activeStockItems.map((item) => {
                  const itemKey = `${item.stockCode}_${item.description}`;
                  const isLocalChanged = definedCounts[itemKey] !== undefined;

                  const matchingInventoryItem = (inventoryItems || []).find(
                    inv => inv.stockCode.toLowerCase().trim() === item.stockCode.toLowerCase().trim()
                  );
                  const currentInventoryAmount = matchingInventoryItem ? (matchingInventoryItem.qty || 0) : 0;
                  const currentVal = isLocalChanged ? definedCounts[itemKey] : currentInventoryAmount;

                  return (
                    <div
                      key={itemKey}
                      onClick={() => {
                        setActiveGroupToCount(item);
                        setEnteredQty(isLocalChanged ? currentVal.toString() : '');
                      }}
                      className={cn(
                        "p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 select-none active:scale-[0.99]",
                        isLocalChanged ? "bg-orange-50/40 border-orange-400" : "bg-white border-zinc-200"
                      )}
                    >
                      <div className="min-w-0 text-left flex-1">
                        <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-750 px-2 py-0.5 rounded border border-zinc-200 inline-block">
                          {item.stockCode}
                        </span>
                        <p className="text-xs font-black mt-1 leading-snug text-zinc-900">{item.displayName || item.description}</p>
                        {item.displayName && item.description !== item.displayName && (
                          <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{item.description}</p>
                        )}
                      </div>
                      <div className="shrink-0 pl-2">
                        <div className={cn(
                          "flex items-center justify-center px-3.5 py-2 rounded-2xl min-w-[50px] text-center font-sans font-black text-sm border",
                          isLocalChanged ? "bg-orange-100 border-orange-350 text-orange-950" : "bg-emerald-50 border-emerald-300 text-emerald-950"
                        )}>
                          {currentVal}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {allCatalogItems.length > 0 && (
              <div className="pt-4 border-t border-zinc-150 flex flex-col gap-2">
                <button
                  type="button"
                  title="Submit stock take"
                  onClick={handleSubmitStockTake}
                  disabled={isSubmittingStock || Object.keys(definedCounts).length === 0}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-sans font-black text-xs uppercase tracking-widest rounded-2xl transition-all flex items-center justify-center gap-2 shadow-md mobile-tap-target"
                >
                  {isSubmittingStock ? (
                    <><Loader2 className="w-4 h-4 animate-spin shrink-0" />Submitting Ledger...</>
                  ) : (
                    <><ClipboardList className="w-4 h-4 shrink-0" />Submit Stock Take ({Object.keys(definedCounts).length} Items Counted)</>
                  )}
                </button>
                <p className="text-[10px] text-zinc-450 text-center font-medium leading-normal">
                  Count data is local until you submit. Submissions are reviewed by the administrator.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrips.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-zinc-200 text-center space-y-3">
                <Truck className="w-8 h-8 text-zinc-300 mx-auto" />
                <p className="text-xs font-bold text-zinc-700">No matching routes located</p>
                <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                  No active dispatches matching the {currentRole}'s target stage were found.
                </p>
              </div>
            ) : (
              filteredTrips.map((trip) => {
                const progress = getTripCheckProgress(trip);
                return (
                  <Link
                    key={trip.id}
                    to={`/team-dashboard/trips/${trip.id}?role=${encodeURIComponent(currentRole)}`}
                    className="block bg-white rounded-3xl p-4 border border-zinc-200 shadow-sm active:bg-zinc-50 transition-all relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          {trip.date}
                        </p>
                        <h3 className="font-bold text-sm text-zinc-955 capitalize leading-snug mt-0.5">{trip.name}</h3>
                      </div>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border shrink-0",
                        trip.status === TripStatus.ON_ROUTE
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : trip.status === TripStatus.DELIVERED || trip.status === TripStatus.COMPLETED || trip.status === TripStatus.INVOICED
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                          : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                      )}>
                        {trip.status}
                      </span>
                    </div>

                    <div className="bg-zinc-50/50 rounded-2xl p-3 border border-zinc-100 flex items-center justify-between text-[11px] font-mono text-zinc-550 mb-3 gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <Truck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="font-sans font-bold text-zinc-700 uppercase truncate">{trip.truckName || trip.truckId}</span>
                      </div>
                      <div className="shrink-0 font-sans text-right">
                        <span className="font-mono text-zinc-450">Stops:</span> <strong className="text-zinc-700">{(trip.stops || []).length}</strong>
                      </div>
                    </div>

                    {progress.total > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-zinc-400 font-sans">
                            {currentRole === 'Assembler' ? 'ASSEMBLY COMPLETED:' :
                             currentRole === 'Loader' ? 'CARGO HOISTED:' :
                             'DESTINATION ARRIVALS:'}
                          </span>
                          <strong className="text-zinc-700">{progress.checked} / {progress.total} counted</strong>
                        </div>
                        <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden border border-zinc-150">
                          <div
                            className={cn("h-full transition-all duration-300", progress.percentage === 100 ? 'bg-emerald-500' : 'bg-brand-accent')}
                            style={{ width: `${progress.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end text-[10px] font-bold uppercase tracking-wider text-brand-accent mt-3 gap-0.5">
                      {currentRole === 'Assembler' ? 'Open Assembly Sheet' :
                       currentRole === 'Loader' ? 'Open Staging Log' :
                       'Open Delivery Sign-offs'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Stock count entry sheet */}
      <MobileSheet
        isOpen={!!activeGroupToCount}
        onClose={() => setActiveGroupToCount(null)}
        title="Define Count"
        subtitle={activeGroupToCount?.stockCode}
        fullHeight={false}
      >
        {activeGroupToCount && (
          <div className="space-y-4">
            <p className="text-[11px] font-medium text-zinc-500 leading-normal">
              Enter the exact physical quantity counted on shelves for <strong className="text-zinc-850">{activeGroupToCount.description}</strong>:
            </p>

            <div className="space-y-1">
              <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Actual Quantity</label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                placeholder="e.g. 15"
                title="Actual quantity"
                value={enteredQty}
                onChange={(e) => setEnteredQty(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans text-sm font-black text-zinc-800"
              />
            </div>

            {(() => {
              const matchingKnockdown = (knockdownItems || []).find(
                k => k.stockCode.toLowerCase().trim() === activeGroupToCount.stockCode.toLowerCase().trim() && k.type === 'knockdown'
              );
              if (!matchingKnockdown || !matchingKnockdown.parts || matchingKnockdown.parts.length === 0) return null;
              const multiplier = parseInt(enteredQty, 10) || 0;
              return (
                <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
                    <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-wider">Parts Breakdown</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{matchingKnockdown.parts.length} parts</span>
                  </div>
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {matchingKnockdown.parts.map((part, pIdx) => (
                      <div key={pIdx} className="flex items-center justify-between gap-3 text-xs border-b border-dashed border-zinc-200/50 pb-1.5 last:border-0 last:pb-0">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-zinc-800 truncate leading-tight">{part.description}</p>
                          <p className="text-[9px] font-mono text-zinc-450">Code: {part.partCode}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-sans font-black text-zinc-700">{part.qty} each</p>
                          {multiplier > 0 && (
                            <p className="text-[9px] font-mono text-emerald-600 font-black">Total: {part.qty * multiplier}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                title="Set count"
                onClick={() => {
                  const qtyValue = parseInt(enteredQty, 10);
                  if (isNaN(qtyValue) || qtyValue < 0) {
                    toast.error('Invalid Quantity', { description: 'Please enter a valid number (0 or greater).' });
                    return;
                  }
                  const itemKey = `${activeGroupToCount.stockCode}_${activeGroupToCount.description}`;
                  setDefinedCounts(prev => ({ ...prev, [itemKey]: qtyValue }));
                  setActiveGroupToCount(null);
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-colors shadow-xs mobile-tap-target"
              >
                Set Count
              </button>
              <button
                type="button"
                title="Clear count"
                onClick={() => {
                  const itemKey = `${activeGroupToCount.stockCode}_${activeGroupToCount.description}`;
                  setDefinedCounts(prev => {
                    const next = { ...prev };
                    delete next[itemKey];
                    return next;
                  });
                  setActiveGroupToCount(null);
                }}
                className="px-3 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-colors mobile-tap-target"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </MobileSheet>
    </div>
  );
}
