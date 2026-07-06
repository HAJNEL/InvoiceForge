import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Trip, TripStatus } from '../../types';
import { Check, Package, RotateCcw, AlertCircle, FileText, Truck, Calendar, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

export function SharedChecklist() {
  const { tripId } = useParams<{ tripId: string }>();
  
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to trip real-time updates from Firestore without auth check since rules allow it
  useEffect(() => {
    if (!tripId) {
      setError('Invalid trip address.');
      setLoading(false);
      return;
    }

    const tripRef = doc(db, 'trips', tripId);
    const unsubscribe = onSnapshot(tripRef, (docSnap) => {
      if (docSnap.exists()) {
        setTrip({
          id: docSnap.id,
          ...docSnap.data()
        } as Trip);
      } else {
        setError('The shared checklist you are looking for does not exist or has been removed.');
      }
      setLoading(false);
    }, (err) => {
      console.error('Error fetching shared checklist:', err);
      setError('Permission denied or network connection failed. Please check your link.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tripId]);

  // Handle toggling of individual check items in real-time
  const handleToggleCheckItem = async (itemKey: string) => {
    if (!trip || !tripId) return;

    const currentChecked = trip.checkedItems || {};
    const nextCheckState = !currentChecked[itemKey];
    const newCheckedItems = { ...currentChecked, [itemKey]: nextCheckState };

    // Dynamic auto transition to 'on-route' status if all items are checked
    const manifestItems = trip.manifestItems || [];
    const allChecked = manifestItems.length > 0 && manifestItems.every(item => {
      const key = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
      return newCheckedItems[key] === true;
    });

    let nextStatus = trip.status;
    if (allChecked && trip.status !== TripStatus.ON_ROUTE) {
      nextStatus = TripStatus.ON_ROUTE;
    }

    try {
      await updateDoc(doc(db, 'trips', tripId), {
        checkedItems: newCheckedItems,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to update check item in real-time:', err);
      toast.error('Sync Failed', { description: 'Could not check off item. Check your connection and try again.' });
    }
  };

  // Reset checked mapping
  const handleResetChecks = async () => {
    if (!trip || !tripId) return;
    try {
      await updateDoc(doc(db, 'trips', tripId), {
        checkedItems: {},
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to reset checks:', err);
      toast.error('Reset Failed', { description: 'Could not reset checklist. Check your connection and try again.' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mb-4"></div>
        <p className="text-zinc-500 font-mono text-xs animate-pulse">ESTABLISHING SECURE REAL-TIME LINK...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 p-6 text-center">
        <div className="max-w-md p-8 bg-white border border-zinc-200 rounded-3xl shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-brand-primary uppercase tracking-tight mb-2">Checklist Not Found</h2>
          <p className="text-zinc-500 text-sm mb-6">{error || 'Unable to load trip summary.'}</p>
          <div className="text-xs text-zinc-400 font-mono">InvoiceForge Logistics Security Platform</div>
        </div>
      </div>
    );
  }

  const manifestItems = trip.manifestItems || [];
  const checkedItems = trip.checkedItems || {};

  // Status color pill map
  const getStatusClasses = (status: TripStatus) => {
    switch (status) {
      case TripStatus.PROPOSED:
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case TripStatus.ASSEMBLED:
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case TripStatus.ON_ROUTE:
        return 'bg-orange-50 text-orange-700 border-orange-200 animate-pulse';
      case TripStatus.PARTIALLY_COMPLETED:
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case TripStatus.COMPLETED:
      case TripStatus.DELIVERED:
        return 'bg-green-50 text-green-700 border-green-200';
      default:
        return 'bg-zinc-50 text-zinc-700 border-zinc-200';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pb-24 relative selection:bg-zinc-200">
      
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-30 px-5 py-4 shadow-xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-950 flex items-center justify-center text-white font-black text-sm tracking-tighter">
              IF
            </div>
            <div>
              <h1 className="text-sm font-black text-zinc-950 tracking-tight">InvoiceForge</h1>
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Web Dispatch Hub</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Realtime pulsing dot */}
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider hidden sm:inline">Live Sync</span>
            
            <div className={cn(
              "px-2.5 py-1 text-[11px] font-black uppercase tracking-wider border rounded-xl",
              getStatusClasses(trip.status)
            )}>
              {trip.status}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        
        {/* Core Metadata Card */}
        <section className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-brand-accent">Active Dispatch Checklist</p>
              <h2 className="text-xl font-black text-brand-primary tracking-tight mt-0.5">{trip.name}</h2>
            </div>
            
            <div className="flex items-center gap-4 text-xs font-semibold text-zinc-500">
              <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-2 rounded-xl border border-zinc-150">
                <Calendar className="w-4 h-4 text-zinc-400" />
                <span>{trip.date}</span>
              </div>

              {trip.truckName && (
                <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-2 rounded-xl border border-zinc-150">
                  <Truck className="w-4 h-4 text-zinc-400" />
                  <span className="font-bold text-zinc-800">{trip.truckName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stops summary list if present */}
          {trip.stops && trip.stops.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Route Schedule Stops</h3>
              <div className="divide-y divide-zinc-100 border border-zinc-150 rounded-2xl overflow-hidden bg-zinc-50/50">
                {trip.stops.map((stop, sIdx) => (
                  <div key={sIdx} className="p-3 flex items-start justify-between gap-4 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 truncate uppercase">{stop.client}</p>
                      {stop.address && <p className="text-[11px] text-zinc-500 truncate mt-0.5">{stop.address}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono text-[10px] font-bold text-zinc-500 bg-white border border-zinc-250 px-1.5 py-0.5 rounded">
                        #{stop.number}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Packing / Loading Checklist Summary */}
        <section className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-black text-brand-primary uppercase tracking-tight flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-accent pb-0.5" />
              Trip Summary
            </h3>
            <p className="text-zinc-500 text-xs mt-0.5">Please check off items as they are safely loaded onto the vehicle.</p>
          </div>

          {manifestItems.length === 0 ? (
            <div className="text-center py-12 bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
              <FileText className="w-10 h-10 text-zinc-300 mx-auto mb-2.5" />
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-tight">No Items Linked</p>
              <p className="text-zinc-400 text-[11px] mt-1 max-w-sm mx-auto px-4">
                This trip summary does not currently contain active packing checklist items.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
              {manifestItems.map((item, idx) => {
                const itemKey = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
                const isChecked = checkedItems[itemKey] || false;
                return (
                  <div 
                    key={`${itemKey}-${idx}`}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer select-none",
                      isChecked 
                        ? "bg-zinc-50/70 border-zinc-200 opacity-60" 
                        : "bg-white border-zinc-200 hover:border-zinc-300 shadow-sm"
                    )}
                    onClick={() => handleToggleCheckItem(itemKey)}
                  >
                    {/* Checkbox indicator */}
                    <div className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                      isChecked 
                        ? "bg-brand-primary border-brand-primary text-white" 
                        : "border-zinc-300 bg-white"
                    )}>
                      {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-mono font-bold text-brand-primary break-all">
                          {item.stockCode || 'N/A'}
                        </span>
                        <span className="text-xs font-black text-right bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded font-mono tabular-nums">
                          Qty: {item.qty}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold text-zinc-500 mt-1 lines-clamp-1 truncate uppercase">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>

      {/* Persistent Floating Action Bar (Mobile Responsive UI) */}
      {manifestItems.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
          
          {/* Quick link indicator for users */}
          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 backdrop-blur-md opacity-90 px-3.5 py-2 rounded-2xl text-white shadow-xl text-[11px] font-black tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-yellow-400 rotate-12" />
            <span>Public Live Link active</span>
          </div>

          {/* Reset Checks FAB */}
          <button
            type="button"
            onClick={handleResetChecks}
            className="w-14 h-14 rounded-full bg-white hover:bg-zinc-100 text-zinc-650 hover:text-zinc-900 shadow-2xl border border-zinc-200 flex items-center justify-center transition-all hover:scale-110 active:scale-90 group"
            title="Reset Checked Items"
          >
            <RotateCcw className="w-6 h-6 transition-transform group-hover:-rotate-45" />
          </button>
        </div>
      )}

      {/* Footer Branding */}
      <footer className="text-center py-8 text-[11px] font-mono text-zinc-400 max-w-md mx-auto">
        Powered by static real-time syncing of Firestore Enterprise.
      </footer>
    </div>
  );
}
