import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Search, Calendar, CalendarDays, ChevronRight, LogOut, Loader2, Shield, Info, AlertTriangle, Truck, RefreshCw,
  Package, ClipboardList, ChevronDown, X, Menu, ListTodo, FileText, MapPin, Filter, ArrowLeft
} from 'lucide-react';
import { useTeamDashboard } from './useTeamDashboard';
import { useMyTasks } from '../todos/hooks/useMyTasks';
import { MyTasksDrawer } from '../todos/components/MyTasksDrawer';
import { TodayPlannerDialog } from './TodayPlannerDialog';
import { TripOverviewTable } from './components/TripOverviewTable';
import { auth, db } from '../../lib/firebase';
import { NRLogo } from '../../components/Logo';
import { Trip, TripStatus } from '../../types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Local (not UTC) "YYYY-MM-DD" - matches how Trip.date / DayPlanner.date are stored
// everywhere else, avoiding the classic toISOString() timezone-shift bug.
function todayDateKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface StockCountItem {
  stockCode: string;
  description: string;
  displayName?: string;
  isPart?: boolean;
  parentItem?: string | null;
}

export function TeamDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, trips, invoices, invoicesCount, isOwner, loading, errorWord, knockdownItems, catalogProducts, inventoryItems, teamStockTakes, dayPlanners, toggleDayPlannerEntry } = useTeamDashboard();

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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const { openCount: openTaskCount } = useMyTasks();

  // Today's plan entries only - recomputed against the current date whenever the
  // dialog is opened, in the exact order the owner arranged them.
  const todayPlannerEntries = useMemo(() => {
    const todayKey = todayDateKey();
    return dayPlanners.find(p => p.date === todayKey)?.entries || [];
  }, [dayPlanners]);

  const todayLabel = useMemo(() => {
    const d = new Date();
    return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  // Extract roles assigned to current team member with a safe fallback
  const rolesWithFallback = React.useMemo(() => {
    const rawRoles = profile?.roles && profile.roles.length > 0
      ? profile.roles
      : ['Stock Counter', 'Assembler', 'Loader', 'Delivered Checker'];

    // Specific requested order: Assembler, Loader, Delivered checker, Stock counter
    const orderMap: Record<string, number> = {
      'Assembler': 1,
      'Loader': 2,
      'Delivered Checker': 3,
      'Stock Counter': 4,
      'Invoice Management': 5,
      'Trip Overview': 6
    };

    return [...rawRoles].sort((a, b) => {
      const orderA = orderMap[a] || 99;
      const orderB = orderMap[b] || 99;
      return orderA - orderB;
    });
  }, [profile?.roles]);

  // Initialize selected tab from search query param, or fallback to first assigned role
  const initialRole = searchParams.get('role') || rolesWithFallback[0] || 'Stock Counter';
  const [activeRole, setActiveRole] = useState<string>(initialRole);

  // Keep state synchronized with search params updates
  useEffect(() => {
    const qRole = searchParams.get('role');
    if (qRole && qRole !== activeRole) {
      setActiveRole(qRole);
    } else if (!qRole && rolesWithFallback.length > 0 && !activeRole) {
      setActiveRole(rolesWithFallback[0]);
    }
  }, [searchParams, rolesWithFallback, activeRole]);

  // Handle setting active filter and updating URL
  const handleSelectRole = (role: string) => {
    setActiveRole(role);
    setSearchParams({ role });
  };

  // Catalog-based stock count item lists
  const productItems = React.useMemo<StockCountItem[]>(() =>
    (catalogProducts || [])
      .filter(p => (p.category || 'product') === 'product')
      .map(p => ({ stockCode: p.stockCode, description: p.description, displayName: p.description })),
    [catalogProducts]
  );

  const knockdownCatalogItems = React.useMemo<StockCountItem[]>(() =>
    (knockdownItems || [])
      .filter(k => k.type === 'knockdown')
      .map(k => ({ stockCode: k.stockCode, description: k.description, displayName: k.displayName })),
    [knockdownItems]
  );

  const consumableItems = React.useMemo<StockCountItem[]>(() => [
    ...(catalogProducts || []).filter(p => p.category === 'consumable').map(p => ({ stockCode: p.stockCode, description: p.description, displayName: p.description })),
    ...(knockdownItems || []).filter(k => k.type === 'consumable').map(k => ({ stockCode: k.stockCode, description: k.description, displayName: k.displayName }))
  ], [catalogProducts, knockdownItems]);

  const activeStockItems = React.useMemo<StockCountItem[]>(() => {
    const base = stockCatalogTab === 'products' ? productItems
      : stockCatalogTab === 'knockdown' ? knockdownCatalogItems
      : consumableItems;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return base;
    return base.filter(i =>
      i.stockCode.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      (i.displayName || '').toLowerCase().includes(q)
    );
  }, [stockCatalogTab, productItems, knockdownCatalogItems, consumableItems, searchQuery]);

  // All catalog items — used for submit lookup regardless of active tab
  const allCatalogItems = React.useMemo<StockCountItem[]>(() => [
    ...productItems, ...knockdownCatalogItems, ...consumableItems
  ], [productItems, knockdownCatalogItems, consumableItems]);

  const handleSubmitStockTake = async () => {
    const records = Object.entries(definedCounts);
    if (records.length === 0) {
      toast.warning('Nothing Counted Yet', { description: 'Tap an item and enter its physical quantity before submitting.' });
      return;
    }

    setIsSubmittingStock(true);
    try {
      const userUid = auth.currentUser?.uid || '';
      const ownerId = profile?.ownerId || userUid;
      const submitterName = profile 
        ? `${profile.firstName} ${profile.lastName}`.trim()
        : (auth.currentUser?.email || 'Team Member');

      // Fetch existing stock_takes to find the maximum code to increment
      const { getDocs, query, collection, where } = await import('firebase/firestore');
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

      // Create a single grouped stock take document with multiple parts/items in it
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

      const { setDoc, doc } = await import('firebase/firestore');
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

      // Clear local state on success
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
  const allDistricts = useMemo(() => {
    const set = new Set<string>();
    (invoices || []).forEach(inv => { if (inv.district) set.add(inv.district.trim().toUpperCase()); });
    return Array.from(set).sort();
  }, [invoices]);

  const filteredInvoicesForManagement = useMemo(() => {
    return (invoices || []).filter(inv => {
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
  }, [invoices, invoiceSearch, invoiceDistrictFilter, invoiceStatusFilter]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const currentRole = activeRole || rolesWithFallback[0] || 'Stock Counter';

  // Filter list of trips based on active role constraints and queries
  const filteredTrips = trips.filter(trip => {
    // 1. Search Query Match
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      trip.name.toLowerCase().includes(q) || 
      (trip.truckName || '').toLowerCase().includes(q) ||
      (trip.truckId || '').toLowerCase().includes(q) ||
      (trip.stops || []).some(stop => stop.client.toLowerCase().includes(q));

    // 2. Role Status Filter Match
    // - "Stock Counter" views all dispatches.
    // - "Assembler" views "proposed" status.
    // - "Loader" views "assembled" status.
    // - "Delivered Checker" views "on-route" status.
    let matchesFilter = true;
    if (currentRole === 'Assembler') {
      matchesFilter = trip.status === TripStatus.PROPOSED;
    } else if (currentRole === 'Loader') {
      matchesFilter = trip.status === TripStatus.ASSEMBLED;
    } else if (currentRole === 'Delivered Checker') {
      matchesFilter = trip.status === TripStatus.ON_ROUTE;
    }

    return matchesSearch && matchesFilter;
  });

  // Calculate items checked statistical fraction for each trip
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
    return {
      total: items.length,
      checked: checkedCount,
      percentage
    };
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-start">
      
      {/* Sticky Top Mobile Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 h-16 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 animate-fade-in">
          {/* Account owner: return to the screen they were on in the main account */}
          {isOwner && (
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="p-2 -ml-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer"
              title="Back to main account"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
          )}

          {/* Burger button to open roles sidebar */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer relative"
            title="Open Workstation Roles"
          >
            <Menu className="w-5 h-5 stroke-[2.5]" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-brand-accent rounded-full animate-ping" />
          </button>

          {/* Default responsive logo badge */}
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center p-0.5 select-none shrink-0 ml-1">
            <NRLogo className="w-6 h-6" variant="light" />
          </div>
          <span className="font-mono text-[10px] font-black tracking-widest text-zinc-400 leading-none">NR PORTAL</span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-center select-none pointer-events-none">
          <span className="text-xs font-black uppercase text-zinc-950 tracking-wider">Team Dashboard</span>
        </div>

        {/* Right cluster: Today's Plan + My Tasks + user menu */}
        <div className="flex items-center gap-2">
        {/* Today's Plan button */}
        <button
          type="button"
          onClick={() => setIsPlannerOpen(true)}
          className="p-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer relative"
          title="Today's Plan"
        >
          <CalendarDays className="w-5 h-5 stroke-[2.5]" />
          {todayPlannerEntries.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-brand-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {todayPlannerEntries.length}
            </span>
          )}
        </button>

        {/* My Tasks button */}
        <button
          type="button"
          onClick={() => setIsTasksOpen(true)}
          className="p-2 rounded-xl text-zinc-700 hover:bg-zinc-100 transition-all cursor-pointer relative"
          title="My Tasks"
        >
          <ListTodo className="w-5 h-5 stroke-[2.5]" />
          {openTaskCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-brand-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {openTaskCount}
            </span>
          )}
        </button>

        {/* User Info & Settings Popover Dropdown menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLogoutMenu(!showLogoutMenu)}
            className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-250 flex items-center justify-center font-bold text-xs uppercase text-zinc-700 hover:bg-zinc-200 transition-all"
          >
            {profile?.firstName?.charAt(0) || auth.currentUser?.email?.charAt(0).toUpperCase()}
          </button>
          
          {showLogoutMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-zinc-200 rounded-2xl shadow-xl py-2 z-50 text-left animate-fade-in pre-render-shadow">
              <div className="px-4 py-2 border-b border-zinc-100 mb-1">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Signed in as{isOwner ? ' (Owner)' : ''}</p>
                <p className="text-xs font-black text-zinc-800 truncate leading-snug">{profile?.firstName} {profile?.lastName}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full px-4 py-2 text-xs font-semibold text-red-650 hover:bg-red-50 flex items-center gap-2 transition-all cursor-pointer text-left"
              >
                <LogOut className="w-4 h-4" />
                `Sign Out / Exit`
              </button>
            </div>
          )}
        </div>
        </div>
      </header>

      <MyTasksDrawer open={isTasksOpen} onClose={() => setIsTasksOpen(false)} />
      <TodayPlannerDialog
        open={isPlannerOpen}
        onClose={() => setIsPlannerOpen(false)}
        entries={todayPlannerEntries}
        dateLabel={todayLabel}
        onToggle={(entryId) => toggleDayPlannerEntry(todayDateKey(), entryId)}
      />

      {/* Main viewport block scaled to thumb-centered width limit */}
      <main className="flex-grow w-full max-w-xl mx-auto px-4 py-6 space-y-6">
        
        {/* Display the role selected at the top of the screen in a card professionally */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200/80 shadow-sm relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left animate-fade-in">
          <div className="space-y-1.5">
            <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest font-mono">ACTIVE WORKSERSTATION ROLE</span>
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full animate-pulse shrink-0 ${
                currentRole === 'Stock Counter' ? 'bg-emerald-500' :
                currentRole === 'Assembler' ? 'bg-blue-500' :
                currentRole === 'Loader' ? 'bg-orange-500' :
                currentRole === 'Invoice Management' ? 'bg-sky-500' :
                currentRole === 'Trip Overview' ? 'bg-rose-500' :
                'bg-purple-500'
              }`} />
              <h2 className="text-base font-black text-zinc-950 uppercase tracking-tight font-sans">
                {currentRole}
              </h2>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed max-w-sm">
              {currentRole === 'Stock Counter' ? 'Verify and submit physical shelter stock take counts back to central ledger pending owner sign off.' :
               currentRole === 'Assembler' ? 'Assemble flat-pack items, components check sheets, and track modular KD parts breakdown.' :
               currentRole === 'Loader' ? 'Monitor load priority, check vehicle staging schedules, and verify loaded cargo.' :
               currentRole === 'Invoice Management' ? 'Browse the full invoice library. Filter by district, status, or client to find what you need fast.' :
               currentRole === 'Trip Overview' ? 'See every trip with its status and bundled invoices, and drill into invoice line items.' :
               'Perform destination check-lists, drop logs, and complete physical deliveries on site.'}
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="sm:self-center shrink-0 inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
          >
            <Shield className="w-4 h-4 text-white" />
            Switch Role
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
            <span className="text-xs font-semibold text-zinc-400 font-mono tracking-widest uppercase">Fetching Fleet Dispatches...</span>
          </div>
        ) : errorWord ? (
          <div className="bg-red-50 text-red-650 rounded-3xl border border-red-150 p-6 flex flex-col items-center text-center space-y-3 animate-fade-in">
            <AlertTriangle className="w-10 h-10 text-red-500 stroke-[2]" />
            <p className="text-xs font-bold leading-relaxed">{errorWord}</p>
          </div>
        ) : invoicesCount === 0 ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-3xl p-8 border border-zinc-200 text-center space-y-4 shadow-sm text-left">
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
                onClick={() => window.location.reload()}
                className="w-full bg-brand-primary text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Option
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Loop Shared Trip list Cards */}
            {currentRole === 'Invoice Management' ? (
              <div className="space-y-4 animate-fade-in">
                {/* Filter bar */}
                <div className="bg-white rounded-3xl p-4 border border-zinc-200 shadow-sm space-y-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
                    <input
                      type="text"
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      placeholder="Search invoice #, client, or address…"
                      className="w-full pl-10 pr-4 py-3 border border-zinc-200 rounded-2xl text-xs bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all placeholder:text-zinc-400"
                    />
                  </div>

                  {/* District + Status filters */}
                  <div className="flex gap-2">
                    {/* District filter */}
                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                      <select
                        title="Filter by district"
                        value={invoiceDistrictFilter}
                        onChange={(e) => setInvoiceDistrictFilter(e.target.value)}
                        className="w-full appearance-none pl-8 pr-7 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
                      >
                        <option value="">All Districts</option>
                        {allDistricts.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                    </div>

                    {/* Status filter */}
                    <div className="relative flex-1">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                      <select
                        title="Filter by status"
                        value={invoiceStatusFilter}
                        onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                        className="w-full appearance-none pl-8 pr-7 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
                      >
                        <option value="">All Statuses</option>
                        <option value="draft">Draft</option>
                        <option value="proposed">Proposed</option>
                        <option value="assembled">Assembled</option>
                        <option value="on_route">On Route</option>
                        <option value="delivered">Delivered</option>
                        <option value="invoiced">Invoiced</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Active filter chips + result count */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex flex-wrap gap-1.5">
                      {invoiceDistrictFilter && (
                        <button
                          type="button"
                          onClick={() => setInvoiceDistrictFilter('')}
                          className="flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                        >
                          <MapPin className="w-3 h-3" />
                          {invoiceDistrictFilter}
                          <X className="w-3 h-3" />
                        </button>
                      )}
                      {invoiceStatusFilter && (
                        <button
                          type="button"
                          onClick={() => setInvoiceStatusFilter('')}
                          className="flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
                        >
                          <Filter className="w-3 h-3" />
                          {invoiceStatusFilter}
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] font-mono font-bold text-zinc-400 shrink-0">
                      {filteredInvoicesForManagement.length} / {(invoices || []).length}
                    </span>
                  </div>
                </div>

                {/* Invoice cards */}
                {filteredInvoicesForManagement.length === 0 ? (
                  <div className="bg-white rounded-3xl p-8 border border-zinc-200 text-center space-y-3">
                    <FileText className="w-8 h-8 text-zinc-200 mx-auto stroke-[1.5]" />
                    <p className="text-xs font-bold text-zinc-700">No invoices match your filters</p>
                    <p className="text-[11px] text-zinc-400">Try adjusting the district, status, or search term.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredInvoicesForManagement.map((inv) => {
                      const statusNorm = (inv.status || 'draft').toLowerCase();
                      const statusColor =
                        statusNorm === 'delivered' || statusNorm === 'invoiced' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        statusNorm === 'on_route' || statusNorm === 'on-route' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        statusNorm === 'assembled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        statusNorm === 'proposed' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                        'bg-zinc-100 text-zinc-500 border-zinc-200';
                      return (
                        <div
                          key={inv.id}
                          className="bg-white rounded-3xl p-4 border border-zinc-200 shadow-sm space-y-3 text-left"
                        >
                          {/* Header row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1 mb-0.5">
                                <FileText className="w-3 h-3" />
                                {inv.number}
                              </p>
                              <h3 className="font-black text-sm text-zinc-900 leading-snug truncate">
                                {inv.client}
                              </h3>
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border shrink-0 ${statusColor}`}>
                              {inv.status || 'draft'}
                            </span>
                          </div>

                          {/* Meta row */}
                          <div className="flex flex-wrap gap-2 text-[10px] font-mono text-zinc-500">
                            {inv.district && (
                              <span className="flex items-center gap-1 bg-zinc-50 border border-zinc-150 px-2 py-1 rounded-lg">
                                <MapPin className="w-3 h-3 text-sky-500" />
                                {(inv.district || '').trim().toUpperCase()}
                              </span>
                            )}
                            <span className="flex items-center gap-1 bg-zinc-50 border border-zinc-150 px-2 py-1 rounded-lg">
                              <Calendar className="w-3 h-3 text-zinc-400" />
                              {inv.date}
                            </span>
                            <span className="flex items-center gap-1 bg-zinc-50 border border-zinc-150 px-2 py-1 rounded-lg font-sans font-bold text-zinc-700">
                              R {(inv.amount || 0).toLocaleString()}
                            </span>
                          </div>

                          {/* Delivery address */}
                          {inv.deliveryAddress && (
                            <p className="text-[11px] text-zinc-500 leading-snug truncate">
                              {inv.deliveryAddress}
                            </p>
                          )}

                          {/* Line items summary */}
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
                                <p className="text-[9px] text-zinc-400 font-bold text-right">
                                  +{inv.lineItems.length - 4} more
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : currentRole === 'Trip Overview' ? (
              <TripOverviewTable trips={trips} invoices={invoices} />
            ) : currentRole === 'Stock Counter' ? (
              <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm relative text-left space-y-4">
                {/* Card Header */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 text-zinc-900">
                    <ClipboardList className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-sm text-zinc-900">Stock Take</h3>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    Count physical quantities across your product catalog.
                  </p>
                </div>

                {/* Category Tabs */}
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
                      className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        stockCatalogTab === tab.key
                          ? 'bg-white text-brand-primary shadow-sm border border-zinc-200/60'
                          : 'text-zinc-500 hover:text-zinc-700'
                      }`}
                    >
                      {tab.label}
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black leading-none ${
                        stockCatalogTab === tab.key
                          ? 'bg-brand-primary/10 text-brand-primary'
                          : 'bg-zinc-200 text-zinc-500'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Search */}
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
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Progress indicator */}
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

                {/* Items list */}
                <div className="space-y-2">
                  {activeStockItems.length === 0 ? (
                    <div className="text-center py-10 space-y-3">
                      <Package className="w-10 h-10 text-zinc-300 mx-auto stroke-[1.5]" />
                      <div className="space-y-1">
                        {searchQuery.trim() ? (
                          <>
                            <p className="text-xs font-bold text-zinc-700">No results for "{searchQuery}"</p>
                            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                              Try a different stock code or description.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold text-zinc-700">No {stockCatalogTab} in catalog</p>
                            <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                              Add {stockCatalogTab} in the Products screen to see them here.
                            </p>
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

                      let bgClass = 'bg-white border-zinc-200 hover:border-zinc-350 hover:shadow-2xs';
                      if (isLocalChanged) bgClass = 'bg-orange-50/40 border-orange-400 shadow-2xs';

                      return (
                        <div
                          key={itemKey}
                          onClick={() => {
                            setActiveGroupToCount(item);
                            setEnteredQty(isLocalChanged ? currentVal.toString() : '');
                          }}
                          className={`p-4 rounded-3xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none hover:scale-[1.005] ${bgClass}`}
                        >
                          <div className="min-w-0 text-left flex-1">
                            <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-750 px-2 py-0.5 rounded border border-zinc-200 inline-block">
                              {item.stockCode}
                            </span>
                            <p className="text-xs font-black mt-1 leading-snug text-zinc-900">
                              {item.displayName || item.description}
                            </p>
                            {item.displayName && item.description !== item.displayName && (
                              <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{item.description}</p>
                            )}
                          </div>
                          <div className="shrink-0 pl-2">
                            {isLocalChanged ? (
                              <div className="flex items-center justify-center bg-orange-100 border border-orange-350 text-orange-950 px-4 py-2 rounded-2xl min-w-[54px] text-center font-sans font-black text-sm shadow-3xs">
                                {currentVal}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center bg-emerald-50 border border-emerald-300 text-emerald-950 px-4 py-2 rounded-2xl min-w-[54px] text-center font-sans font-black text-sm shadow-3xs">
                                {currentInventoryAmount}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Submit footer */}
                {allCatalogItems.length > 0 && (
                  <div className="pt-4 border-t border-zinc-150 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitStockTake}
                      disabled={isSubmittingStock || Object.keys(definedCounts).length === 0}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white font-sans font-black text-xs uppercase tracking-widest rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-99"
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
              <div className="space-y-4">
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
                        className="block bg-white rounded-3xl p-5 border border-zinc-200 shadow-sm hover:border-brand-accent transition-all relative overflow-hidden group hover:shadow-md text-left"
                      >
                        {/* Card Content Header */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <div>
                            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                              <Calendar className="w-3 h-3 text-zinc-400" />
                              {trip.date}
                            </p>
                            <h3 className="font-bold text-sm text-zinc-955 capitalize leading-snug group-hover:text-brand-accent transition-all mt-0.5">
                              {trip.name}
                            </h3>
                          </div>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border shrink-0 ${
                            trip.status === TripStatus.ON_ROUTE 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : trip.status === TripStatus.DELIVERED || trip.status === TripStatus.COMPLETED || trip.status === TripStatus.INVOICED
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                              : 'bg-zinc-50 text-zinc-500 border-zinc-200'
                          }`}>
                            {trip.status}
                          </span>
                        </div>

                        {/* Stats Section with Truck Code */}
                        <div className="bg-zinc-50/50 rounded-2xl p-3 border border-zinc-100 flex items-center justify-between text-[11px] font-mono text-zinc-550 mb-4 gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            <Truck className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="font-sans font-bold text-zinc-700 uppercase truncate">
                              {trip.truckName || trip.truckId}
                            </span>
                          </div>
                          <div className="shrink-0 font-sans text-right">
                            <span className="font-mono text-zinc-450">Stops:</span> <strong className="text-zinc-700">{(trip.stops || []).length}</strong>
                          </div>
                        </div>

                        {/* Loading Progress Slider bar */}
                        {progress.total > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-mono text-left">
                              <span className="text-zinc-400 font-sans">
                                {currentRole === 'Assembler' ? 'ASSEMBLY COMPLETED:' :
                                 currentRole === 'Loader' ? 'CARGO HOISTED:' :
                                 'DESTINATION ARRIVALS:'}
                              </span>
                              <strong className="text-zinc-700">{progress.checked} / {progress.total} counted</strong>
                            </div>
                            
                            {/* Outer slider bar */}
                            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden border border-zinc-150">
                              <div 
                                className={`h-full ${progress.percentage === 100 ? 'bg-emerald-500' : 'bg-brand-accent'} transition-all duration-300`}
                                style={{ width: `${progress.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        )}

                        {/* Bottom clickable visual chevron */}
                        <div className="flex items-center justify-end text-[10px] font-bold uppercase tracking-wider text-brand-accent mt-3 gap-0.5 group-hover:gap-1 transition-all">
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
          </>
        )}
      </main>

      {/* Dialog overlay for defining a count */}
      {activeGroupToCount && (
        <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 border border-zinc-200 shadow-2xl animate-scale-up text-left">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-[9px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200 select-all">
                  {activeGroupToCount.stockCode}
                </span>
                <h3 className="font-sans font-black text-sm text-zinc-900 mt-1 uppercase leading-tight">
                  Define Count
                </h3>
              </div>
              <button
                title='setActiveGroupToCount'
                type="button"
                onClick={() => setActiveGroupToCount(null)}
                className="p-1 hover:bg-zinc-100 text-zinc-400 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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
                    <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-wider">
                      Parts Breakdown
                    </span>
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
                onClick={() => {
                  const qtyValue = parseInt(enteredQty, 10);
                  if (isNaN(qtyValue) || qtyValue < 0) {
                    toast.error('Invalid Quantity', { description: 'Please enter a valid number (0 or greater).' });
                    return;
                  }
                  const itemKey = `${activeGroupToCount.stockCode}_${activeGroupToCount.description}`;
                  setDefinedCounts(prev => ({
                    ...prev,
                    [itemKey]: qtyValue
                  }));
                  setActiveGroupToCount(null);
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Set Count
              </button>
              <button
                type="button"
                onClick={() => {
                  const itemKey = `${activeGroupToCount.stockCode}_${activeGroupToCount.description}`;
                  setDefinedCounts(prev => {
                    const next = { ...prev };
                    delete next[itemKey];
                    return next;
                  });
                  setActiveGroupToCount(null);
                }}
                className="px-3 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional slide-drawer Sidebar for changing roles */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop mask with fade/blur effect */}
          <div 
            className="absolute inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Side Drawer container */}
          <div className="absolute inset-y-0 left-0 max-w-full flex pr-10">
            <div className="w-80 max-w-[85vw] bg-white h-full shadow-2xl border-r border-zinc-200 flex flex-col justify-between animate-slide-in-left">
              
              {/* Header */}
              <div className="p-5 border-b border-zinc-150 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-zinc-950 flex items-center justify-center p-0.5 select-none shrink-0">
                    <NRLogo className="w-5 h-5" variant="light" />
                  </div>
                  <h3 className="text-[11px] font-black uppercase text-zinc-900 tracking-wider">
                    Workstation Roles
                  </h3>
                </div>
                <button
                title='setIsSidebarOpen'
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 hover:bg-zinc-100 rounded-xl text-zinc-400 hover:text-zinc-600 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* User Bio Details Banner */}
              <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200/60 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-zinc-900 text-white font-sans font-black flex items-center justify-center text-xs uppercase shadow-sm">
                  {profile?.firstName?.charAt(0) || auth.currentUser?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-zinc-900 leading-snug truncate">
                    {profile?.firstName} {profile?.lastName}
                  </p>
                  <p className="text-[9px] text-zinc-400 font-mono font-bold uppercase tracking-widest leading-none">
                    Active Team Member
                  </p>
                </div>
              </div>

              {/* Role Selection List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                <p className="text-[9px] text-zinc-400 font-extrabold uppercase tracking-widest font-mono px-1.5 mb-2">
                  Select Workstation Mission
                </p>

                {rolesWithFallback.map((roleOpt) => {
                  const isActive = currentRole === roleOpt;
                  return (
                    <button
                      key={roleOpt}
                      type="button"
                      onClick={() => {
                        handleSelectRole(roleOpt);
                        setIsSidebarOpen(false);
                      }}
                      className={`w-full p-4 rounded-2xl flex flex-col text-left transition-all border cursor-pointer select-none ${
                        isActive
                          ? 'bg-zinc-950 text-white border-zinc-950 shadow-md scale-[1.01]'
                          : 'bg-white hover:bg-zinc-50/80 text-zinc-850 border-zinc-200/70 hover:border-zinc-350'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-20px w-2 h-2 rounded-full shrink-0 ${
                          roleOpt === 'Stock Counter' ? 'bg-emerald-500' :
                          roleOpt === 'Assembler' ? 'bg-blue-500' :
                          roleOpt === 'Loader' ? 'bg-orange-500' :
                          roleOpt === 'Invoice Management' ? 'bg-sky-500' :
                          roleOpt === 'Trip Overview' ? 'bg-rose-500' :
                          'bg-purple-500'
                        }`} />
                        <span className="text-xs font-black uppercase tracking-tight">
                          {roleOpt}
                        </span>
                        {isActive && (
                          <span className="ml-auto text-[8px] font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded-full uppercase leading-none">
                            Active
                          </span>
                        )}
                      </div>
                      
                      <p className={`text-[10px] mt-1.5 leading-relaxed ${
                        isActive ? 'text-zinc-300' : 'text-zinc-500'
                      }`}>
                        {roleOpt === 'Stock Counter' ? 'Take shelf snapshots, key aggregated item metrics and approve pending stock takes.' :
                         roleOpt === 'Assembler' ? 'Assess warehouse custom assemblies, components status checklist, and KD parts lists.' :
                         roleOpt === 'Loader' ? 'Optimize vehicle weights, check staging dispatches, and verify trailer cargo loader priority.' :
                         roleOpt === 'Invoice Management' ? 'Browse the full invoice library filtered by district, status, or client name.' :
                         roleOpt === 'Trip Overview' ? 'View every trip with its status and bundled invoices, and drill into invoice line items.' :
                         'Coordinate route sequences, log digital drop receipts status and capture client delivery signatures.'}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Logout Exit */}
              <div className="p-4 border-t border-zinc-150 bg-zinc-50/45">
                <button
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    handleLogout();
                  }}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-650 font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out / Exit
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
