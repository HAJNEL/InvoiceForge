import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { onSnapshot, doc, getDoc } from 'firebase/firestore';
import { 
  ArrowLeft, Calendar, Truck, ShieldAlert, 
  Loader2, DollarSign, FileSpreadsheet, Lock, CheckCircle2, Info, Package, Shield, ArrowRight,
  AlertTriangle, X
} from 'lucide-react';
import { useTeamDashboard } from './useTeamDashboard';
import { db } from '../../lib/firebase';
import { Trip, Invoice } from '../../types';
import { cn } from '../../lib/utils';

export function TeamTripDetail() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { profile, toggleCheckItem, updateTripStatus, updatePartialItem, knockdownItems, loading: authLoading } = useTeamDashboard();

  // Local state for inline partial editing
  const [editingPartialKey, setEditingPartialKey] = useState<string | null>(null);
  const [localActualQty, setLocalActualQty] = useState<number>(0);
  const [localReason, setLocalReason] = useState<string>('');

  // Load state for this specific trip
  const [trip, setTrip] = useState<Trip | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingTrip, setLoadingTrip] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Status transitions
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;

    // Listen to real-time updates for this specific trip
    const tripDocRef = doc(db, 'trips', tripId);
    const unsubscribeTrip = onSnapshot(tripDocRef, async (snap) => {
      if (snap.exists()) {
        const tripData = { id: snap.id, ...snap.data() } as Trip;
        setTrip(tripData);

        // Fetch corresponding invoice details to show aggregate totals & stop counts
        if (tripData.invoiceIds && tripData.invoiceIds.length > 0) {
          try {
            const invoiceList: Invoice[] = [];
            for (const invId of tripData.invoiceIds) {
              const docSnap = await getDoc(doc(db, 'invoices', invId));
              if (docSnap.exists()) {
                invoiceList.push({ id: docSnap.id, ...docSnap.data() } as Invoice);
              }
            }
            setInvoices(invoiceList);
          } catch (err) {
            console.error("Error loading invoices for summary:", err);
          }
        }
      } else {
        setTrip(null);
      }
      setLoadingTrip(false);
    }, (err) => {
      console.error("Error subscribing to trip detail:", err);
      setLoadingTrip(false);
    });

    return () => unsubscribeTrip();
  }, [tripId]);

  // Determine current active role view
  const activeRole = searchParams.get('role') || profile?.roles?.[0] || 'Stock Counter';

  // State permission calculations
  const canModify = profile?.role === 'editor';
  
  const getRoleStatusRequirement = () => {
    if (activeRole === 'Assembler') return { required: 'proposed', label: 'Proposed' };
    if (activeRole === 'Loader') return { required: 'assembled', label: 'Assembled' };
    if (activeRole === 'Delivered Checker') return { required: 'on-route', label: 'On Route' };
    return null;
  };

  const reqStatus = getRoleStatusRequirement();
  // Stock Counter can edit in any phase, other roles must match the required status phase
  const isStatusCorrect = activeRole === 'Stock Counter' || 
    !reqStatus || 
    trip?.status === reqStatus.required ||
    (activeRole === 'Delivered Checker' && (trip?.status === 'partially-completed' || trip?.status === 'partially_completed'));
  const isWritable = canModify && isStatusCorrect;

  // Handle checking off an item
  const handleToggle = async (key: string, currentVal: boolean) => {
    if (!trip || !isWritable) return;
    
    setUpdatingId(key);
    await toggleCheckItem(trip.id, key, currentVal);
    
    // Clear updating spinner with subtle delay for rich micro-feedback response
    setTimeout(() => {
      setUpdatingId(null);
    }, 400);
  };

  // Perform pipeline status transition
  const handleStatusTransition = async () => {
    if (!trip) return;
    setIsTransitioning(true);
    setTransitionError(null);

    let nextStatus = '';
    if (activeRole === 'Assembler') {
      nextStatus = 'assembled';
    } else if (activeRole === 'Loader') {
      nextStatus = 'on-route';
    } else if (activeRole === 'Delivered Checker') {
      nextStatus = 'delivered';
    }

    if (!nextStatus) {
      setIsTransitioning(false);
      return;
    }

    const success = await updateTripStatus(trip.id, nextStatus);
    setIsTransitioning(false);
    if (success) {
      // Return to team dashboard preserving the role context
      navigate(`/team-dashboard?role=${encodeURIComponent(activeRole)}`);
    } else {
      setTransitionError("Credentials error updating dispatch stage. Verify write permissions are enabled.");
    }
  };

  // Calculate stats safely (unconditionally)
  const items = React.useMemo(() => trip?.manifestItems || [], [trip?.manifestItems]);
  const checkedState = React.useMemo(() => trip?.checkedItems || {}, [trip?.checkedItems]);

  const processedItems = React.useMemo(() => {
    return items.map((item, idx) => {
      const matchingKnockdown = knockdownItems?.find(k => 
        k.parts?.some(p => p.partCode.toLowerCase().trim() === item.stockCode.toLowerCase().trim())
      );
      return {
        ...item,
        isPart: !!matchingKnockdown,
        parentItem: matchingKnockdown ? matchingKnockdown.stockCode : null,
        legacyIndex: idx
      };
    });
  }, [items, knockdownItems]);

  const groupedItems = React.useMemo(() => {
    const groupsMap: { [key: string]: typeof processedItems } = {};
    
    processedItems.forEach(item => {
      const parentCode = (item.isPart && item.parentItem) ? item.parentItem.trim() : item.stockCode.trim();
      const groupKey = parentCode || 'NO_STOCK_CODE';
      
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
  }, [processedItems]);

  if (authLoading || loadingTrip) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" />
        <span className="text-xs font-semibold text-zinc-400 font-mono tracking-widest uppercase">SYMBOLS RECOVERING...</span>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-lg max-w-sm w-full space-y-4">
          <div className="w-12 h-12 bg-red-105 rounded-full flex items-center justify-center text-red-650 mx-auto">
            <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-900 text-sm">Trip Not Found</h3>
            <p className="text-xs text-zinc-500 mt-1">This trip may have been deleted, archived, or you do not have permission to view it.</p>
          </div>
          <Link
            to={`/team-dashboard?role=${encodeURIComponent(activeRole)}`}
            className="w-full inline-block bg-brand-primary hover:bg-zinc-800 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  let checkedCount = 0;
  items.forEach((item, idx) => {
    const keyUnified = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
    const keyLegacy = `${item.stockCode}-${idx}`;
    if (checkedState[keyUnified] || checkedState[keyLegacy]) {
      checkedCount++;
    }
  });

  const progressPct = items.length === 0 ? 0 : Math.round((checkedCount / items.length) * 100);

  // Financial aggregates
  const totalFinancialValue = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-start pb-8">
      
      {/* Short Top Bar Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 h-16 px-4 flex items-center shrink-0">
        <button
          onClick={() => navigate(`/team-dashboard?role=${encodeURIComponent(activeRole)}`)}
          className="p-2 text-zinc-400 hover:text-zinc-800 bg-zinc-50 hover:bg-zinc-100 rounded-xl transition-all mr-3 flex items-center justify-center"
          title="Back to Dashboard"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-750 stroke-[3]" />
        </button>
        
        <div className="flex-1 text-center pr-10">
          <span className="text-xs font-black uppercase text-zinc-950 tracking-wider">Interactive checklist</span>
        </div>
      </header>

      <main className="w-full max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* Back Link Breadcrumb */}
        <Link 
          to={`/team-dashboard?role=${encodeURIComponent(activeRole)}`} 
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-accent hover:underline mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          Back to Dispatch List
        </Link>

        {/* Dynamic Role-Based Screen Header Banner */}
        <div className={cn(
          "rounded-3xl p-5 border shadow-sm relative overflow-hidden flex items-center gap-4 text-left",
          activeRole === 'Stock Counter' ? 'bg-emerald-50/40 border-emerald-200 text-emerald-850' :
          activeRole === 'Assembler' ? 'bg-blue-50/40 border-blue-200 text-blue-800' :
          activeRole === 'Loader' ? 'bg-amber-50/40 border-amber-200 text-amber-800' :
          activeRole === 'Delivered Checker' ? 'bg-purple-50/40 border-purple-200 text-purple-800' :
          'bg-zinc-50 border-zinc-200'
        )}>
          <div className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs",
            activeRole === 'Stock Counter' ? 'bg-emerald-100 border-emerald-200/50 text-emerald-600' :
            activeRole === 'Assembler' ? 'bg-blue-100 border-blue-200/50 text-blue-600' :
            activeRole === 'Loader' ? 'bg-amber-100 border-amber-200/50 text-amber-600' :
            activeRole === 'Delivered Checker' ? 'bg-purple-100 border-purple-200/50 text-purple-600' :
            'bg-zinc-100 text-zinc-650'
          )}>
            {activeRole === 'Stock Counter' && <Shield className="w-5 h-5 stroke-[2.5]" />}
            {activeRole === 'Assembler' && <Package className="w-5 h-5 stroke-[2.5]" />}
            {activeRole === 'Loader' && <Truck className="w-5 h-5 stroke-[2.5]" />}
            {activeRole === 'Delivered Checker' && <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />}
          </div>
          <div className="flex-grow min-w-0">
            <span className="text-[9px] font-black uppercase tracking-widest leading-none block text-zinc-400 mb-0.5">Role Station View</span>
            <h3 className="font-sans text-xs font-black uppercase tracking-wider text-zinc-900 leading-tight">
              {activeRole === 'Stock Counter' ? 'Stock Counter Station' :
               activeRole === 'Assembler' ? 'Assembly & Prep Dock' :
               activeRole === 'Loader' ? 'Loading & Staging Pier' :
               activeRole === 'Delivered Checker' ? 'Delivery Check-Off Proof' :
               activeRole}
            </h3>
            <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
              {activeRole === 'Stock Counter' ? 'Assessing general inventory lines & physical count tallies.' :
               activeRole === 'Assembler' ? 'Packaging, bundle prepping, and staging items for cargo launch.' :
               activeRole === 'Loader' ? 'Securing load balances and locking freight inside vehicles.' :
               activeRole === 'Delivered Checker' ? 'Recapping goods offloaded at drop-off client spots.' :
               'Viewing shared trip records.'}
            </p>
          </div>
        </div>

        {/* Trip Core Info Header */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
          <div className="flex justify-between items-start gap-4 pb-4 border-b border-zinc-100">
            <div className="text-left">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                {trip.date}
              </p>
              <h2 className="text-lg font-black text-zinc-950 capitalize mt-1 leading-tight">{trip.name}</h2>
            </div>
            
            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full border shrink-0 ${
              trip.status === 'on-route' 
                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                : trip.status === 'completed' || trip.status === 'invoiced'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                : 'bg-zinc-50 text-zinc-500 border-zinc-200'
            }`}>
              {trip.status}
            </span>
          </div>

          {/* Aggregate Overview statistics metrics */}
          <div className="grid grid-cols-3 gap-3">
            
            {/* Truck Details */}
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-center space-y-1 overflow-hidden">
              <Truck className="w-4 h-4 text-zinc-400 mx-auto" />
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Vehicle</p>
              <p className="text-xs font-black text-zinc-800 uppercase truncate">
                {trip.truckName || trip.truckId}
              </p>
            </div>

            {/* Total Invoices */}
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-center space-y-1">
              <FileSpreadsheet className="w-4 h-4 text-zinc-400 mx-auto" />
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Invoices</p>
              <p className="text-xs font-black text-zinc-800">
                {trip.invoiceIds?.length || 0}
              </p>
            </div>

            {/* Total value */}
            <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-2xl text-center space-y-1 overflow-hidden">
              <DollarSign className="w-4 h-4 text-emerald-500 mx-auto" />
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Trip Value</p>
              <p className="text-xs font-black text-zinc-800 truncate">
                R{totalFinancialValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

          </div>
        </div>

        {/* Loading / Checklist ratio indicator cards */}
        <div className="bg-white rounded-3xl p-6 border border-zinc-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between text-xs font-black uppercase text-zinc-400 tracking-wider">
            <span className="flex items-center gap-1.5 font-mono">
              <CheckCircle2 className="w-4 h-4 text-brand-accent stroke-[2.5]" />
              {activeRole === 'Stock Counter' ? 'Verification Fraction' :
               activeRole === 'Assembler' ? 'Assembled Fraction' :
               activeRole === 'Loader' ? 'Loaded Fraction' :
               'Delivered Fraction'}
            </span>
            <span className="font-mono text-zinc-900">{checkedCount} of {items.length} completed</span>
          </div>

          {/* Mini dynamic slider */}
          <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden border border-zinc-200">
            <div 
              className={`h-full ${progressPct === 100 ? 'bg-emerald-500' : 'bg-brand-accent'} transition-all duration-300`}
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>

          {/* Pipeline Expansion Action Trigger Button */}
          {progressPct === 100 && items.length > 0 && isWritable && activeRole !== 'Stock Counter' && (
            <div className="pt-4 border-t border-zinc-150 space-y-2 animate-fade-in">
              <p className="text-[11px] text-zinc-550 text-left leading-relaxed">
                🎉 Excellent work! All <strong>{items.length} items</strong> are checked off. Switch the dispatch stage to advance:
              </p>
              <button
                type="button"
                onClick={handleStatusTransition}
                disabled={isTransitioning}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-primary hover:bg-zinc-850 disabled:bg-zinc-450 text-white font-black text-[10px] uppercase tracking-wider rounded-2xl transition-all cursor-pointer shadow-md active:scale-[0.99]"
              >
                {isTransitioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {activeRole === 'Assembler' && 'Complete Assembly & Stage Cargo 📦'}
                    {activeRole === 'Loader' && 'Mark Staged Cargo Loaded & Depart Vehicle 🚚'}
                    {activeRole === 'Delivered Checker' && 'Complete Delivery Logs & Register Closure ✅'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              {transitionError && (
                <p className="text-[10px] text-red-600 font-extrabold text-left">{transitionError}</p>
              )}
            </div>
          )}
        </div>

        {/* Verification Locked Badge */}
        {!isStatusCorrect && reqStatus && (
          <div className="bg-amber-50/75 border border-amber-200 text-amber-800 rounded-2xl p-4 flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5 text-left">
              <p className="text-xs font-black uppercase tracking-wider">Verification Locked</p>
              <p className="text-[11px] leading-relaxed text-amber-700/90">
                This dispatch is currently in <span className="font-extrabold capitalize text-amber-900">“{trip.status}”</span> state. 
                Only dispatches in <span className="font-extrabold capitalize text-amber-900">“{reqStatus.required}”</span> status are writable inside the <span className="font-black text-amber-950">{activeRole}</span> role view.
              </p>
            </div>
          </div>
        )}

        {/* Permission Limit Notification banners */}
        {profile?.role === 'viewer' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5 text-left">
              <p className="text-xs font-black uppercase tracking-wider">Read-Only Permission Active</p>
              <p className="text-[11px] leading-relaxed text-amber-700/90">
                You are logged in with Viewer limits. Checkbox controls are locked to read-only state.
              </p>
            </div>
          </div>
        )}

        {/* Core Checklist Item loop lists */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-mono px-1 text-left">Manifest Items List ({items.length})</h3>

          {items.length === 0 ? (
            <div className="bg-white rounded-3xl py-12 border border-zinc-200 text-center text-zinc-400 text-xs">
              No manifest items listed on this dispatch's invoices.
            </div>
          ) : (
            <div className="space-y-6">
              {groupedItems.map((group) => (
                <div key={group.groupCode} className="border border-zinc-200 rounded-3xl p-4 bg-zinc-50/20 space-y-2.5 text-left animate-fade-in">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-150">
                    <span className="text-[9px] font-mono font-black uppercase text-zinc-400 tracking-wider">Group Code</span>
                    <span className="font-mono text-[10px] font-black uppercase bg-zinc-900 text-white px-2 py-0.5 rounded-md shadow-xs">
                      {group.groupCode}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {group.items.map((item) => {
                      const keyUnified = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
                      const keyLegacy = `${item.stockCode}-${item.legacyIndex}`;
                      const isChecked = !!(checkedState[keyUnified] || checkedState[keyLegacy]);
                      const isUpdating = updatingId === keyUnified || updatingId === keyLegacy;
                      const canCheck = isWritable;

                      return (
                        <div
                          key={`${item.stockCode}-${item.legacyIndex}`}
                          onClick={() => canCheck && !isUpdating && handleToggle(keyUnified, isChecked)}
                          className={cn(
                            "bg-white rounded-2xl p-4 border transition-all flex flex-col gap-3 select-none",
                            canCheck ? "cursor-pointer active:scale-[0.995]" : "cursor-default opacity-75",
                            isChecked 
                              ? "border-emerald-250 bg-emerald-50/10" 
                              : "border-zinc-200 hover:border-zinc-300 bg-white"
                          )}
                        >
                          <div className="flex items-start gap-4 w-full">
                            {/* Visual Check / Uncheck Box */}
                            <div className="mt-0.5 shrink-0">
                              {isUpdating ? (
                                <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                              ) : isChecked ? (
                                <div className="w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center text-white border border-emerald-600 shadow-sm animate-scale-up">
                                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              ) : (
                                <div className={cn(
                                  "w-5 h-5 border-2 rounded-lg bg-zinc-50 transition-all",
                                  canCheck ? "border-zinc-300 hover:border-zinc-400" : "border-zinc-200"
                                )}></div>
                              )}
                            </div>

                            {/* Content Detail */}
                            <div className="flex-grow space-y-1 text-left min-w-0">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-[10px] font-mono font-bold bg-zinc-100 text-zinc-500 border border-zinc-150 px-2 py-0.5 rounded truncate flex items-center gap-1.5 leading-none">
                                  <span>{item.stockCode}</span>
                                  {item.isPart && (
                                    <span className="text-[8px] font-sans font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded shrink-0">
                                      Part of {item.parentItem}
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs font-black text-zinc-950 font-mono shrink-0">
                                  Qty: {item.qty}
                                </span>
                              </div>
                              
                              <h4 className={cn(
                                "text-xs font-bold leading-relaxed transition-all truncate",
                                isChecked ? "text-zinc-400 line-through" : "text-zinc-800"
                              )}>
                                {item.description}
                              </h4>
                            </div>
                          </div>

                          {/* Rendering dynamic partially complete flags */}
                          {(() => {
                            const partialInfo = trip?.partialItems?.[keyUnified] || trip?.partialItems?.[keyLegacy];
                            return (
                              <div className="w-full mt-1" onClick={(e) => e.stopPropagation()}>
                                {partialInfo?.isPartial && (
                                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 mb-2">
                                    <div className="flex items-center justify-between text-[11px] font-mono text-amber-850">
                                      <span className="flex items-center gap-1 font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        PARTIALLY COMPLETE
                                      </span>
                                      <span className="bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full text-[9px]">
                                        {partialInfo.actualQty} / {partialInfo.expectedQty} units
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-amber-800 font-medium">
                                      <strong>Reason:</strong> {partialInfo.reason}
                                    </p>
                                    {/* Comparative Visual Bar */}
                                    <div className="w-full bg-zinc-200/60 h-2 rounded-full overflow-hidden flex">
                                      <div 
                                        className="bg-emerald-500 h-full" 
                                        style={{ width: `${(partialInfo.actualQty / partialInfo.expectedQty) * 100}%` }}
                                      ></div>
                                      <div className="bg-amber-500 h-full flex-1"></div>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-mono font-bold text-amber-700">
                                      <span>Present: {partialInfo.actualQty} units</span>
                                      <span>Missing: {partialInfo.expectedQty - partialInfo.actualQty} units</span>
                                    </div>
                                    {isWritable && (
                                      <div className="flex gap-2 justify-end pt-1">
                                        <button
                                          onClick={() => {
                                            updatePartialItem(trip.id, keyUnified, null);
                                          }}
                                          className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-black uppercase rounded"
                                        >
                                          Clear Flag
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingPartialKey(keyUnified);
                                            setLocalActualQty(partialInfo.actualQty);
                                            setLocalReason(partialInfo.reason);
                                          }}
                                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase rounded"
                                        >
                                          Edit Flag
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {isWritable && (activeRole === 'Assembler' || activeRole === 'Loader') && editingPartialKey !== keyUnified && !partialInfo?.isPartial && (
                                  <button
                                    onClick={() => {
                                      setEditingPartialKey(keyUnified);
                                      setLocalActualQty(Math.max(0, item.qty - 1));
                                      setLocalReason('');
                                    }}
                                    className="text-[10px] font-mono font-bold uppercase text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/60 rounded-xl px-3 py-1.5 inline-flex items-center gap-1 transition-all"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                    Flag Partially Complete
                                  </button>
                                )}

                                {isWritable && editingPartialKey === keyUnified && (
                                  <div className="p-3 bg-zinc-50 border border-zinc-250 rounded-xl space-y-3 antialiased">
                                    <div className="flex justify-between items-center border-b border-zinc-150 pb-1.5">
                                      <span className="text-[10px] font-black text-zinc-700 uppercase tracking-wider font-mono">Flag Partial Deliverable</span>
                                      <button onClick={() => setEditingPartialKey(null)} className="text-zinc-400 hover:text-zinc-650">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">Actual Qty there:</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={item.qty - 1}
                                        value={localActualQty}
                                        onChange={(e) => setLocalActualQty(Math.max(0, Math.min(item.qty - 1, Number(e.target.value))))}
                                        className="block w-24 bg-white border border-zinc-300 rounded-lg p-1.5 text-xs font-black text-center"
                                      />
                                      <div className="text-[9px] text-amber-700 font-mono flex justify-between pt-1">
                                        <span>Units there: {localActualQty}</span>
                                        <span>Missing amount: {item.qty - localActualQty}</span>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-zinc-500 uppercase block">Reason for discrepancy:</label>
                                      <input
                                        type="text"
                                        placeholder="e.g. Broken packaging, product shortage"
                                        value={localReason}
                                        onChange={(e) => setLocalReason(e.target.value)}
                                        className="block w-full bg-white border border-zinc-300 rounded-lg p-2 text-xs text-zinc-800"
                                      />
                                    </div>
                                    <div className="flex gap-2 justify-end pt-1">
                                      <button
                                        onClick={() => setEditingPartialKey(null)}
                                        className="px-2.5 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-black uppercase rounded-lg"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={async () => {
                                          if (!localReason.trim()) {
                                            alert("Please enter a reason for flagging this item as partially complete.");
                                            return;
                                          }
                                          await updatePartialItem(trip.id, keyUnified, {
                                            isPartial: true,
                                            actualQty: localActualQty,
                                            expectedQty: item.qty,
                                            reason: localReason,
                                            stockCode: item.stockCode || 'N/A',
                                            description: item.description || ''
                                          });
                                          setEditingPartialKey(null);
                                        }}
                                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase rounded-lg"
                                      >
                                        Save Flag
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Offline Sync Informative block */}
        <div className="bg-zinc-100 border border-zinc-200 rounded-2xl p-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-zinc-500 leading-relaxed font-mono text-left">
            <strong>OFFLINE RESILIENCY NOTICE:</strong> This screen automatically buffers count states. In case of localized network interruptions, items remain editable; changes synchronize instantly once connection lines stabilize.
          </p>
        </div>

      </main>
    </div>
  );
}
