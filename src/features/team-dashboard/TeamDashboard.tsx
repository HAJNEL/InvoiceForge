import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  Search, Calendar, ChevronRight, LogOut, Loader2, Shield, Info, AlertTriangle, Truck, RefreshCw,
  Package, ClipboardList, ChevronDown, X
} from 'lucide-react';
import { useTeamDashboard } from './useTeamDashboard';
import { auth, db } from '../../lib/firebase';
import { NRLogo } from '../../components/Logo';
import { Trip, TripStatus } from '../../types';

interface GroupedStockItem {
  stockCode: string;
  description: string;
  totalQty: number;
  unitPrice: number;
  totalValue: number;
  isPart?: boolean;
  parentItem?: string;
  sources: { invoiceNumber: string; client: string; qty: number; value: number }[];
}

interface GroupableItem {
  stockCode: string;
  isPart?: boolean;
  parentItem?: string | null;
}

interface StockItemWithSources {
  stockCode: string;
  description: string;
  totalQty: number;
  unitPrice: number;
  totalValue: number;
  isPart?: boolean;
  parentItem?: string | null;
  sources: { invoiceNumber: string; client: string; qty: number; value: number }[];
}

function groupAndSortItems<T extends GroupableItem>(
  items: T[],
  knockdownItems?: { stockCode: string; parts?: { partCode?: string; description?: string }[] }[]
): { groupCode: string; items: T[] }[] {
  const groupsMap: { [key: string]: T[] } = {};
  
  items.forEach(item => {
    let parentCode = (item.isPart && item.parentItem) ? item.parentItem.trim() : null;
    
    if (!parentCode && knockdownItems) {
      const match = knockdownItems.find(k => 
        k.parts?.some(p => (p.partCode || '').toLowerCase().trim() === item.stockCode.toLowerCase().trim())
      );
      if (match) {
        parentCode = match.stockCode.trim();
        item.isPart = true;
        item.parentItem = parentCode;
      }
    }
    
    const groupKey = parentCode || item.stockCode.trim() || 'NO_STOCK_CODE';
    
    if (!groupsMap[groupKey]) {
      groupsMap[groupKey] = [];
    }
    groupsMap[groupKey].push(item);
  });

  Object.keys(groupsMap).forEach(key => {
    groupsMap[key].sort((a, b) => {
      const aIsPart = !!a.isPart;
      const bIsPart = !!b.isPart;
      if (aIsPart === bIsPart) {
        return a.stockCode.localeCompare(b.stockCode);
      }
      return aIsPart ? 1 : -1;
    });
  });

  const grouped = Object.keys(groupsMap).map(groupCode => ({
    groupCode,
    items: groupsMap[groupCode]
  }));

  grouped.sort((a, b) => a.groupCode.localeCompare(b.groupCode));

  return grouped;
}

export function TeamDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, trips, invoices, invoicesCount, isOwner, loading, errorWord, knockdownItems, inventoryItems, teamStockTakes } = useTeamDashboard();

  // Selected status for stock counter tab. Default is "draft"
  const [selectedStockStatus, setSelectedStockStatus] = useState<string>('draft');
  const [definedCounts, setDefinedCounts] = useState<Record<string, number>>({});
  const [activeGroupToCount, setActiveGroupToCount] = useState<GroupedStockItem | null>(null);
  const [enteredQty, setEnteredQty] = useState<string>('');
  const [isSubmittingStock, setIsSubmittingStock] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutMenu, setShowLogoutMenu] = useState(false);

  // Extract roles assigned to current team member with a safe fallback
  const rolesWithFallback = React.useMemo(() => {
    return profile?.roles && profile.roles.length > 0
      ? profile.roles
      : ['Stock Counter', 'Assembler', 'Loader', 'Delivered Checker'];
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

  // Filter invoices for stock counter based on selected status filter
  const filteredInvoicesForStock = React.useMemo(() => {
    return (invoices || []).filter(inv => {
      // Norm invoice status
      const statusLower = (inv.status || 'draft').toLowerCase().trim();
      
      if (selectedStockStatus === 'draft') {
        return statusLower === 'draft' || statusLower === 'darft';
      }
      if (selectedStockStatus === 'partially_complete') {
        return statusLower === 'partially_complete' || statusLower === 'partially completed' || statusLower === 'partially complete';
      }
      if (selectedStockStatus === 'proposed') {
        return statusLower === 'proposed';
      }
      if (selectedStockStatus === 'assembled') {
        return statusLower === 'assembled';
      }
      return false;
    });
  }, [invoices, selectedStockStatus]);

  // Group line items
  const groupedStockItems = React.useMemo<StockItemWithSources[]>(() => {
    const groupedMap: { [key: string]: StockItemWithSources } = {};

    filteredInvoicesForStock.forEach(inv => {
      const items = inv.lineItems || [];
      items.forEach(item => {
        const code = (item.stockCode || 'NO-CODE').trim();
        const desc = (item.description || 'No Description').trim();
        
        // Find if this code matches a knockdown item stock code
        const matchingKnockdown = knockdownItems?.find(
          k => k.stockCode.toLowerCase().trim() === code.toLowerCase().trim()
        );

        if (matchingKnockdown && matchingKnockdown.parts && matchingKnockdown.parts.length > 0) {
          // If knockdown match, multiply that invoice's required count into parts requirements
          matchingKnockdown.parts.forEach(part => {
            const partCode = (part.partCode || 'NO-CODE').trim();
            const partDesc = (part.description || 'No Description').trim();
            const partKey = `${partCode}_${partDesc}`;
            
            const reqQty = (item.qty || 0) * (part.qty || 1);

            if (!groupedMap[partKey]) {
              groupedMap[partKey] = {
                stockCode: partCode,
                description: partDesc,
                totalQty: 0,
                unitPrice: 0,
                totalValue: 0,
                isPart: true,
                parentItem: code,
                sources: []
              };
            }
            groupedMap[partKey].totalQty += reqQty;
            groupedMap[partKey].sources.push({
              invoiceNumber: inv.number,
              client: inv.client,
              qty: reqQty,
              value: 0
            });
          });
        } else {
          // Normal direct line item
          const key = `${code}_${desc}`;
          if (!groupedMap[key]) {
            groupedMap[key] = {
              stockCode: code,
              description: desc,
              totalQty: 0,
              unitPrice: item.unitPrice || 0,
              totalValue: 0,
              isPart: false,
              sources: []
            };
          }
          groupedMap[key].totalQty += (item.qty || 0);
          groupedMap[key].totalValue += (item.value || 0);
          groupedMap[key].sources.push({
            invoiceNumber: inv.number,
            client: inv.client,
            qty: item.qty || 0,
            value: item.value || 0
          });
        }
      });
    });

    // Apply search query filter if provided
    return Object.values(groupedMap).filter(item => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return item.stockCode.toLowerCase().includes(q) || 
             item.description.toLowerCase().includes(q) || 
             item.sources.some(s => s.client.toLowerCase().includes(q) || s.invoiceNumber.toLowerCase().includes(q));
    });
  }, [filteredInvoicesForStock, searchQuery, knockdownItems]);

  const handleSubmitStockTake = async () => {
    const records = Object.entries(definedCounts);
    if (records.length === 0) {
      alert("No stock items have been counted yet. Please click on a group and enter its actual quantity first!");
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
        const item = groupedStockItems.find(g => `${g.stockCode}_${g.description}` === key);
        return {
          stockCode: item?.stockCode || key.split('_')[0],
          description: item?.description || key.split('_')[1] || '',
          isPart: !!item?.isPart,
          parentItem: item?.parentItem || null,
          countedQty: qty,
          expectedQty: item?.totalQty || 0,
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
      alert(`Stock take #${nextCode} submitted successfully and is now awaiting approval!`);
    } catch (err) {
      console.error("Failed to submit stock take:", err);
      alert("Failed to submit stock count. Please try again.");
    } finally {
      setIsSubmittingStock(false);
    }
  };

  // If user is actually an owner, gently redirect to main admin dashboard portal
  if (isOwner) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 max-w-sm w-full text-center space-y-4 text-left">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mx-auto">
            <Info className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-sm text-center">Account Owner Detected</h3>
            <p className="text-xs text-zinc-550 mt-1.5 leading-relaxed text-center">
              You are signed in as an administrator. Redirecting you to your primary control console...
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-brand-primary text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-zinc-800 transition-all shadow-sm cursor-pointer"
          >
            Go to Admin Dashboard
          </button>
        </div>
      </div>
    );
  }

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
        <div className="flex items-center gap-2">
          {/* Default responsive logo badge */}
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center p-0.5 select-none shrink-0">
            <NRLogo className="w-6 h-6" variant="light" />
          </div>
          <span className="font-mono text-[10px] font-black tracking-widest text-zinc-400 leading-none">NR PORTAL</span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-center select-none pointer-events-none">
          <span className="text-xs font-black uppercase text-zinc-950 tracking-wider">Team Dashboard</span>
        </div>

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
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Signed in as</p>
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
      </header>

      {/* Main viewport block scaled to thumb-centered width limit */}
      <main className="flex-grow w-full max-w-xl mx-auto px-4 py-6 space-y-6">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
            <span className="text-xs font-semibold text-zinc-400 font-mono tracking-widest uppercase">Fetching Fleet Dispatches...</span>
          </div>
        ) : errorWord ? (
          <div className="bg-red-50 text-red-600 rounded-3xl border border-red-150 p-6 flex flex-col items-center text-center space-y-3">
            <AlertTriangle className="w-10 h-10 text-red-500 stroke-[2]" />
            <p className="text-xs font-bold leading-relaxed">{errorWord}</p>
          </div>
        ) : invoicesCount === 0 ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Hello card banner */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm relative overflow-hidden flex items-center justify-between">
              <div className="space-y-1 text-left">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest font-mono">Welcome back</p>
                <h2 className="text-xl font-black text-zinc-950 truncate capitalize leading-tight">
                  Hello, {profile?.firstName}!
                </h2>
                <p className="text-[11px] text-zinc-500 leading-snug">Review your portal status.</p>
              </div>

              <div className="flex flex-wrap gap-1.5 items-center justify-end shrink-0 max-w-[50%]">
                {profile?.roles && profile.roles.length > 0 ? (
                  profile.roles.map(r => (
                    <span 
                      key={r} 
                      className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full border shadow-xs whitespace-nowrap ${
                        r === 'Stock Counter' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        r === 'Assembler' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        r === 'Loader' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        r === 'Delivered Checker' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-zinc-50 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      <Shield className="w-2.5 h-2.5 stroke-[2.5]" />
                      {r}
                    </span>
                  ))
                ) : (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border shrink-0 shadow-xs ${
                    profile?.role === 'editor' 
                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    <Shield className="w-3 h-3 stroke-[2.5]" />
                    {profile?.role}
                  </span>
                )}
              </div>
            </div>

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
            {/* Header / Hello card banner */}
            <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm relative overflow-hidden flex items-center justify-between">
              <div className="space-y-1 text-left">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest font-mono font-black">Welcome back</p>
                <h2 className="text-xl font-black text-zinc-950 truncate capitalize leading-tight">
                  Hello, {profile?.firstName}!
                </h2>
                <p className="text-[11px] text-zinc-500 leading-snug">You have active dispatches matching your fleet schedule.</p>
              </div>

              <div className="flex flex-wrap gap-1.5 items-center justify-end shrink-0 max-w-[50%]">
                {profile?.roles && profile.roles.length > 0 ? (
                  profile.roles.map(r => (
                    <span 
                      key={r} 
                      className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-full border shadow-xs whitespace-nowrap ${
                        r === 'Stock Counter' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        r === 'Assembler' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        r === 'Loader' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        r === 'Delivered Checker' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        'bg-zinc-50 text-zinc-700 border-zinc-200'
                      }`}
                    >
                      <Shield className="w-2.5 h-2.5 stroke-[2.5]" />
                      {r}
                    </span>
                  ))
                ) : (
                  <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border shrink-0 shadow-xs ${
                    profile?.role === 'editor' 
                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    <Shield className="w-3 h-3 stroke-[2.5]" />
                    {profile?.role}
                  </span>
                )}
              </div>
            </div>

            {/* Search Input Panels */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Dispatch Name, Truck, or Stops..."
                className="w-full pl-10 pr-4 py-3 border border-zinc-200 rounded-2xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all placeholder:text-zinc-400 text-left"
              />
            </div>

            {/* Flat thumb-centered segmented filter tabs replaced with Roles */}
            <div 
              className="grid gap-1.5 p-1.5 bg-zinc-100 border border-zinc-200 rounded-2xl select-none"
              style={{ gridTemplateColumns: `repeat(${rolesWithFallback.length}, minmax(0, 1fr))` }}
            >
              {rolesWithFallback.map((roleOpt) => {
                const isActive = currentRole === roleOpt;
                return (
                  <button
                    key={roleOpt}
                    type="button"
                    onClick={() => handleSelectRole(roleOpt)}
                    className={`py-2 px-1 text-[10px] font-black uppercase tracking-wider transition-all rounded-xl border truncate cursor-pointer ${
                      isActive
                        ? 'bg-white text-zinc-950 shadow-xs border-zinc-200'
                        : 'text-zinc-500 border-transparent hover:text-zinc-700 bg-transparent'
                    }`}
                  >
                    {roleOpt}
                  </button>
                );
              })}
            </div>

            {/* Loop Shared Trip list Cards */}
            {currentRole === 'Stock Counter' ? (
              <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm relative text-left">
                {/* Card Header with Status Selector in Top Right Corner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-zinc-900 mb-0.5">
                      <ClipboardList className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-bold text-sm text-zinc-900">Grouped Stock Line Items</h3>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-snug">
                      Showing aggregated item quantities filtered by the invoice workflow status.
                    </p>
                  </div>

                  {/* Change Status select dropdown in top right corner of card */}
                  <div className="relative shrink-0 flex items-center gap-1.5 self-start sm:self-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 font-mono">Status:</span>
                    <div className="relative">
                      <select
                        value={selectedStockStatus}
                        onChange={(e) => setSelectedStockStatus(e.target.value)}
                        className="appearance-none bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-[11px] font-black uppercase tracking-wider py-1.5 pl-3 pr-8 rounded-xl cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-accent focus:border-brand-accent transition-all"
                      >
                        <option value="draft">Darft (Default)</option>
                        <option value="partially_complete">Partially completed</option>
                        <option value="proposed">Proposed</option>
                        <option value="assembled">Assembled</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-550 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Progress of counted stock items indicator */}
                {groupedStockItems.length > 0 && (
                  <div className="bg-zinc-50 rounded-2xl p-3.5 border border-zinc-150 mb-5 text-[11px] font-mono leading-relaxed text-zinc-550 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-500" />
                      <span>
                        Total Unique Products: <strong>{groupedStockItems.length}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 font-bold uppercase text-[9px] tracking-wider font-sans">Verification Checklist:</span>
                      <span className="bg-emerald-50 text-emerald-700 font-black px-2.5 py-0.5 rounded-full border border-emerald-150 shadow-2xs font-sans font-black">
                        {groupedStockItems.filter(item => {
                          const itemKey = `${item.stockCode}_${item.description}`;
                          let matchingCount = 0;
                          for (const tTake of (teamStockTakes || [])) {
                            const matchingItem = tTake.items?.find((i: { stockCode: string; countedQty: number }) => i.stockCode.toLowerCase().trim() === item.stockCode.toLowerCase().trim());
                            if (matchingItem) {
                              matchingCount = matchingItem.countedQty || 0;
                            }
                          }
                          return definedCounts[itemKey] !== undefined || matchingCount > 0;
                        }).length} / {groupedStockItems.length} Checked
                      </span>
                    </div>
                  </div>
                )}

                {/* Stock Items list */}
                <div className="space-y-3">
                  {groupedStockItems.length === 0 ? (
                    <div className="text-center py-10 space-y-3">
                      <Package className="w-10 h-10 text-zinc-300 mx-auto stroke-[1.5]" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-zinc-700">No stock items found</p>
                        <p className="text-[11px] text-zinc-400 max-w-xs mx-auto">
                          No invoices match the status: <strong className="text-zinc-500 font-black">"{selectedStockStatus === 'draft' ? 'Darft' : selectedStockStatus === 'partially_complete' ? 'Partially completed' : selectedStockStatus === 'proposed' ? 'Proposed' : 'Assembled'}"</strong>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    (() => {
                      const groups = groupAndSortItems<StockItemWithSources>(groupedStockItems, knockdownItems);
                      return groups.map((gObj) => (
                        <div key={gObj.groupCode} className="border border-zinc-200 rounded-3xl p-4 bg-zinc-50/20 space-y-2.5">
                          <div className="flex items-center gap-2 pb-1.5 border-b border-zinc-150">
                            <span className="text-[9px] font-mono font-black uppercase text-zinc-400 tracking-wider">Group:</span>
                            <span className="font-mono text-[10px] font-black uppercase bg-zinc-900 text-white px-2.5 py-0.5 rounded-md">
                              {gObj.groupCode}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {gObj.items.map((item) => {
                              const itemKey = `${item.stockCode}_${item.description}`;
                              const isLocalChanged = definedCounts[itemKey] !== undefined;

                              // Check inside teamStockTakes list to see if this item has any counted quantity
                              let matchingCount = 0;
                              for (const tTake of (teamStockTakes || [])) {
                                const matchingItem = tTake.items?.find((i: { stockCode: string; countedQty: number }) => i.stockCode.toLowerCase().trim() === item.stockCode.toLowerCase().trim());
                                if (matchingItem) {
                                  matchingCount = matchingItem.countedQty || 0;
                                  break;
                                }
                              }

                              // Get current inventory amount
                              const matchingInventoryItem = (inventoryItems || []).find(
                                inv => inv.stockCode.toLowerCase().trim() === item.stockCode.toLowerCase().trim()
                              );
                              const currentInventoryAmount = matchingInventoryItem ? (matchingInventoryItem.qty || 0) : 0;

                              // If locally changed, use that value; otherwise default to inventory quantity
                              const currentVal = isLocalChanged ? definedCounts[itemKey] : currentInventoryAmount;

                              let bgClass = 'bg-white border-zinc-200 hover:border-zinc-350 hover:shadow-2xs';
                              if (isLocalChanged) {
                                bgClass = 'bg-orange-50/40 border-orange-400 shadow-2xs';
                              } else if (matchingCount > 0) {
                                bgClass = 'bg-emerald-50/20 border-emerald-305 shadow-2xs';
                              }

                              return (
                                <div
                                  key={itemKey}
                                  onClick={() => {
                                    setActiveGroupToCount(item);
                                    setEnteredQty(isLocalChanged ? currentVal.toString() : '');
                                  }}
                                  className={`p-4 rounded-3xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none hover:scale-[1.005] ${bgClass}`}
                                >
                                  <div className="min-w-0 text-left flex-1 flex flex-col justify-center">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-750 px-2 py-0.5 rounded border border-zinc-200">
                                        {item.stockCode}
                                      </span>
                                      {item.isPart && (
                                        <span className="text-[9px] font-sans font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded shadow-2xs tracking-wider">
                                          Part of {item.parentItem}
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-xs font-black mt-1 leading-snug text-zinc-900">
                                      {item.description}
                                    </p>
                                  </div>

                                  {/* Compact count display - green bg by default (inventory), orange bg if edited (locally changed) */}
                                  <div className="shrink-0 flex items-center justify-end pl-2">
                                    {isLocalChanged ? (
                                      <div className="flex items-center justify-center bg-orange-100 border border-orange-350 text-orange-950 px-4 py-2 rounded-2xl min-w-[54px] text-center font-sans font-black text-sm shadow-3xs transition-all animate-scale-up">
                                        {currentVal}
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-center bg-emerald-50 border border-emerald-300 text-emerald-950 px-4 py-2 rounded-2xl min-w-[54px] text-center font-sans font-black text-sm shadow-3xs transition-all">
                                        {currentInventoryAmount}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()
                  )}
                </div>

                {/* Submit Stock Take Footer panel */}
                {groupedStockItems.length > 0 && (
                  <div className="pt-4 border-t border-zinc-250 mt-6 shrink-0 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleSubmitStockTake}
                      disabled={isSubmittingStock || Object.keys(definedCounts).length === 0}
                      className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white font-sans font-black text-xs uppercase tracking-widest rounded-2xl cursor-pointer transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-99"
                    >
                      {isSubmittingStock ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          Submitting Ledger...
                        </>
                      ) : (
                        <>
                          <ClipboardList className="w-4 h-4 shrink-0" />
                          Submit Stock Take ({Object.keys(definedCounts).length} Items Counted)
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-zinc-450 text-center font-medium leading-normal">
                      Count data remains local until you press submit. Submission saves rows to <strong className="font-mono">stock</strong> pending review by master managers.
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
                              : trip.status === TripStatus.COMPLETED || trip.status === TripStatus.INVOICED
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
              const matchingKnockdown = knockdownItems?.find(
                item => item.stockCode.toLowerCase().trim() === activeGroupToCount.stockCode.toLowerCase().trim()
              );
              const calculatedMultiplier = parseInt(enteredQty, 10) || 0;
              if (!matchingKnockdown) return null;
              return (
                <div className="bg-zinc-50 border border-zinc-200/60 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-zinc-200 pb-1.5">
                    <span className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-wider">
                      Parts Breakdown ({matchingKnockdown.type || 'knockdown'})
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      Configured Code: {matchingKnockdown.stockCode}
                    </span>
                  </div>
                  <p className="text-[11px] font-black text-zinc-905 leading-tight">
                    {matchingKnockdown.displayName || matchingKnockdown.description}
                  </p>
                  {matchingKnockdown.parts && matchingKnockdown.parts.length > 0 ? (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {matchingKnockdown.parts.map((part, pIdx) => {
                        const totalPartCount = part.qty * calculatedMultiplier;
                        return (
                          <div key={pIdx} className="flex items-center justify-between gap-3 text-xs border-b border-dashed border-zinc-200/50 pb-1.5 last:border-0 last:pb-0">
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-zinc-800 truncate leading-tight">{part.description}</p>
                              <p className="text-[9px] font-mono text-zinc-450">Part code: {part.partCode}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-sans font-black text-zinc-700">
                                {part.qty} pcs each
                              </p>
                              {calculatedMultiplier > 0 && (
                                <p className="text-[9px] font-mono text-emerald-600 font-black">
                                  Total: {totalPartCount} units
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-400 italic">No knockdown sub-components configured.</p>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const qtyValue = parseInt(enteredQty, 10);
                  if (isNaN(qtyValue) || qtyValue < 0) {
                    alert("Please enter a valid non-negative number.");
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
    </div>
  );
}
