import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Calendar, Truck, Loader2, DollarSign, FileSpreadsheet, Lock, CheckCircle2, Package, Shield, ArrowRight,
  AlertTriangle, X, ClipboardList
} from 'lucide-react';
import { Trip } from '../../types';
import { cn } from '../../lib/utils';
import { MobileSheet } from '../../components/mobile/MobileSheet';

interface InvoiceLineItem {
  stockCode?: string;
  stock_code?: string;
  description?: string;
  qty?: number;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
  value?: number;
  line_item_value?: number;
  isPart?: boolean;
  parentItem?: string | null;
}

interface LoaderChecklistItem {
  invoiceId: string;
  invoiceNumber: string;
  schoolName: string;
  stockCode: string;
  description: string;
  qty: number;
  isPart: boolean;
  parentItem: string | null;
  legacyIndex: number;
}

interface AssemblerItemToCount {
  stockCode: string;
  description: string;
  qty: number;
  keyUnified: string;
  keyLegacy: string;
  isPart?: boolean;
  parentItem?: string | null;
}

interface UniquePreChecklistItem {
  stockCode: string;
  description: string;
  qty: number;
}

interface ProcessedItem {
  stockCode: string;
  description: string;
  qty: number;
  isPart?: boolean;
  parentItem?: string | null;
  legacyIndex: number;
}

interface GroupedItemGroup {
  groupCode: string;
  items: ProcessedItem[];
}

interface RawInvoiceLike {
  id: string;
  invoiceNumber?: string;
  schoolName?: string;
  clientName?: string;
  client?: string;
  taxInvoice?: string;
  invoice_number?: string;
  number?: string;
  lineItems?: InvoiceLineItem[];
  line_items?: InvoiceLineItem[];
  ship_to_details?: { school_name?: string; name?: string };
}

interface TeamTripDetailMobileProps {
  trip: Trip;
  activeRole: string;
  invoices: RawInvoiceLike[];

  // Pre-checklist (Assembler/Loader)
  showPreChecklist: boolean;
  setShowPreChecklist: (show: boolean) => void;
  uniquePreChecklistItems: UniquePreChecklistItem[];
  preCheckedState: Record<string, boolean>;
  preChecklistStats: { checkedCount: number; totalCount: number; isCompleted: boolean };
  togglePreCheck: (key: string) => void;
  handleClearPreChecklist: () => void;
  handleMarkAllPreChecked: () => void;

  totalFinancialValue: number;

  // Loader/Assembler flat list
  loaderItems: LoaderChecklistItem[];

  // Stock Counter / Delivered Checker grouped items
  groupedItems: GroupedItemGroup[];
  items: ProcessedItem[];

  checkedState: Record<string, boolean>;
  updatingId: string | null;

  canModify: boolean;
  isWritable: boolean;
  isStatusCorrect: boolean;
  reqStatusLabel?: string;
  isViewer: boolean;

  activeItemToCount: AssemblerItemToCount | null;
  setActiveItemToCount: (item: AssemblerItemToCount | null) => void;
  assemblerEnteredQty: string;
  setAssemblerEnteredQty: (v: string) => void;
  handleSaveAssemblerCount: (item: AssemblerItemToCount, enteredCountStr: string) => void;
  handleClearAssemblerCount: (item: AssemblerItemToCount) => void;
  handleToggle: (key: string, currentVal: boolean) => void;

  editingPartialKey: string | null;
  setEditingPartialKey: (key: string | null) => void;
  localActualQty: number;
  setLocalActualQty: (v: number) => void;
  localReason: string;
  setLocalReason: (v: string) => void;
  updatePartialItem: (tripId: string, itemKey: string, data: {
    isPartial: boolean; actualQty: number; expectedQty: number; reason: string; stockCode?: string; description?: string;
  } | null) => void;

  qtyFromInvoices: Map<string, number>;

  isTransitioning: boolean;
  transitionError: string | null;
  handleStatusTransition: () => void;

  progressPct: number;
  totalItemsCount: number;
  checkedCount: number;
}

/**
 * Mobile counterpart of TeamTripDetail. Same role-based checklist logic and
 * handlers (all passed in already-computed from the parent) — presentation
 * only: card rows instead of dense table-like blocks, and MobileSheet-based
 * modals instead of centered dialogs for the count-entry / pre-checklist flows.
 */
export function TeamTripDetailMobile({
  trip, activeRole, invoices,
  showPreChecklist, setShowPreChecklist, uniquePreChecklistItems, preCheckedState, preChecklistStats,
  togglePreCheck, handleClearPreChecklist, handleMarkAllPreChecked,
  totalFinancialValue, loaderItems, groupedItems, items,
  checkedState, updatingId, canModify, isWritable, isStatusCorrect, reqStatusLabel, isViewer,
  activeItemToCount, setActiveItemToCount, assemblerEnteredQty, setAssemblerEnteredQty,
  handleSaveAssemblerCount, handleClearAssemblerCount, handleToggle,
  editingPartialKey, setEditingPartialKey, localActualQty, setLocalActualQty, localReason, setLocalReason,
  updatePartialItem, qtyFromInvoices,
  isTransitioning, transitionError, handleStatusTransition,
  progressPct, totalItemsCount, checkedCount,
}: TeamTripDetailMobileProps) {
  const isLoaderOrAssembler = activeRole === 'Loader' || activeRole === 'Assembler';

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-start pb-8">
      {/* Short Top Bar Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 h-14 px-3 flex items-center shrink-0">
        <Link
          to={`/team-dashboard?role=${encodeURIComponent(activeRole)}`}
          title="Back to Dashboard"
          className="p-2 text-zinc-400 hover:text-zinc-800 bg-zinc-50 hover:bg-zinc-100 rounded-xl transition-all mr-3 flex items-center justify-center mobile-tap-target"
        >
          <ArrowLeft className="w-4 h-4 text-zinc-750 stroke-[3]" />
        </Link>
        <div className="flex-1 text-center pr-9">
          <span className="text-xs font-black uppercase text-zinc-950 tracking-wider">Interactive checklist</span>
        </div>
      </header>

      <main className="w-full px-3 py-4 space-y-4">
        {/* Dynamic Role-Based Screen Header Banner */}
        <div className={cn(
          "rounded-3xl p-4 border shadow-sm relative overflow-hidden flex flex-col gap-3",
          (activeRole === 'Loader' && preChecklistStats.isCompleted) ? 'bg-emerald-50/40 border-emerald-200 text-emerald-800' :
          activeRole === 'Stock Counter' ? 'bg-emerald-50/40 border-emerald-200 text-emerald-850' :
          activeRole === 'Assembler' ? 'bg-blue-50/40 border-blue-200 text-blue-800' :
          activeRole === 'Loader' ? 'bg-amber-50/40 border-amber-200 text-amber-800' :
          activeRole === 'Delivered Checker' ? 'bg-purple-50/40 border-purple-200 text-purple-800' :
          'bg-zinc-50 border-zinc-200'
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs",
              (activeRole === 'Loader' && preChecklistStats.isCompleted) ? 'bg-emerald-100 border-emerald-200/50 text-emerald-600' :
              activeRole === 'Stock Counter' ? 'bg-emerald-100 border-emerald-200/50 text-emerald-600' :
              activeRole === 'Assembler' ? 'bg-blue-100 border-blue-200/50 text-blue-600' :
              activeRole === 'Loader' ? 'bg-amber-100 border-amber-200/50 text-amber-600' :
              activeRole === 'Delivered Checker' ? 'bg-purple-100 border-purple-200/50 text-purple-600' :
              'bg-zinc-100 text-zinc-650'
            )}>
              {activeRole === 'Stock Counter' && <Shield className="w-5 h-5 stroke-[2.5]" />}
              {activeRole === 'Assembler' && <Package className="w-5 h-5 stroke-[2.5]" />}
              {activeRole === 'Loader' && (
                preChecklistStats.isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 stroke-[2.5] text-emerald-600 animate-bounce" />
                ) : (
                  <Truck className="w-5 h-5 stroke-[2.5]" />
                )
              )}
              {activeRole === 'Delivered Checker' && <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />}
            </div>
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest leading-none block text-zinc-400 mb-0.5">Role Station View</span>
              <h3 className="font-sans text-xs font-black uppercase tracking-wider text-zinc-900 leading-tight">
                {activeRole === 'Stock Counter' ? 'Stock Counter Station' :
                 activeRole === 'Assembler' ? 'Assembly & Prep Dock' :
                 activeRole === 'Loader' ? (preChecklistStats.isCompleted ? 'Staged & Loader Pier' : 'Loading & Staging Pier') :
                 activeRole === 'Delivered Checker' ? 'Delivery Check-Off Proof' :
                 activeRole}
              </h3>
            </div>
          </div>

          {isLoaderOrAssembler && (
            <button
              type="button"
              title="Open pre-checklist"
              onClick={() => setShowPreChecklist(true)}
              className={cn(
                "w-full font-sans font-black tracking-wider text-[10px] uppercase px-4 py-2.5 rounded-2xl flex items-center justify-center shadow-sm transition-all active:scale-95 border mobile-tap-target",
                preChecklistStats.isCompleted
                  ? "bg-emerald-600 text-white border-emerald-700"
                  : activeRole === 'Assembler'
                    ? "bg-blue-600 text-white border-blue-700"
                    : "bg-amber-600 text-white border-amber-700"
              )}
            >
              <span>Pre-Checklist ({preChecklistStats.checkedCount}/{preChecklistStats.totalCount})</span>
            </button>
          )}
        </div>

        {/* Trip Core Info Header */}
        <div className="bg-white rounded-3xl p-4 border border-zinc-200 shadow-sm space-y-3">
          <div className="flex justify-between items-start gap-3 pb-3 border-b border-zinc-100">
            <div className="text-left min-w-0">
              <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                {trip.date}
              </p>
              <h2 className="text-base font-black text-zinc-950 capitalize mt-1 leading-tight truncate">{trip.name}</h2>
            </div>
            <span className={cn(
              "text-[9px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-full border shrink-0",
              trip.status === 'on-route'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : trip.status === 'completed' || trip.status === 'invoiced'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-250'
                : 'bg-zinc-50 text-zinc-500 border-zinc-200'
            )}>
              {trip.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-zinc-50 border border-zinc-100 rounded-2xl text-center space-y-1 overflow-hidden">
              <Truck className="w-4 h-4 text-zinc-400 mx-auto" />
              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Vehicle</p>
              <p className="text-[11px] font-black text-zinc-800 uppercase truncate">{trip.truckName || trip.truckId}</p>
            </div>
            <div className="p-2.5 bg-zinc-50 border border-zinc-100 rounded-2xl text-center space-y-1">
              <FileSpreadsheet className="w-4 h-4 text-zinc-400 mx-auto" />
              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Invoices</p>
              <p className="text-[11px] font-black text-zinc-800">{trip.invoiceIds?.length || 0}</p>
            </div>
            <div className="p-2.5 bg-zinc-50 border border-zinc-100 rounded-2xl text-center space-y-1 overflow-hidden">
              <DollarSign className="w-4 h-4 text-emerald-500 mx-auto" />
              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest leading-none">Trip Value</p>
              <p className="text-[11px] font-black text-zinc-800 truncate">
                R{totalFinancialValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Loading / Checklist ratio indicator card */}
        <div className="bg-white rounded-3xl p-4 border border-zinc-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs font-black uppercase text-zinc-400 tracking-wider">
            <span className="flex items-center gap-1.5 font-mono text-[10px]">
              <CheckCircle2 className="w-4 h-4 text-brand-accent stroke-[2.5]" />
              {activeRole === 'Stock Counter' ? 'Verification' :
               activeRole === 'Assembler' ? 'Assembled' :
               activeRole === 'Loader' ? 'Loaded' :
               'Delivered'}
            </span>
            <span className="font-mono text-zinc-900 text-[10px]">{checkedCount} of {totalItemsCount}</span>
          </div>

          <div className="w-full bg-zinc-100 h-2.5 rounded-full overflow-hidden border border-zinc-200">
            <div
              className={cn("h-full transition-all duration-300", progressPct === 100 ? 'bg-emerald-500' : 'bg-brand-accent')}
              style={{ width: `${progressPct}%` }}
            ></div>
          </div>

          {progressPct === 100 && totalItemsCount > 0 && isWritable && activeRole !== 'Stock Counter' && (
            <div className="pt-3 border-t border-zinc-150 space-y-2">
              <p className="text-[11px] text-zinc-550 text-left leading-relaxed">
                All <strong>{totalItemsCount} items</strong> are checked off. Switch the dispatch stage to advance:
              </p>
              <button
                type="button"
                title="Advance dispatch stage"
                onClick={handleStatusTransition}
                disabled={isTransitioning}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-primary hover:bg-zinc-850 disabled:bg-zinc-450 text-white font-black text-[10px] uppercase tracking-wider rounded-2xl transition-all mobile-tap-target"
              >
                {isTransitioning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {activeRole === 'Assembler' && 'Complete Assembly & Stage Cargo'}
                    {activeRole === 'Loader' && 'Mark Loaded & Depart Vehicle'}
                    {activeRole === 'Delivered Checker' && 'Complete Delivery & Close'}
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

        {!isStatusCorrect && reqStatusLabel && (
          <div className="bg-amber-50/75 border border-amber-200 text-amber-800 rounded-2xl p-3.5 flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5 text-left">
              <p className="text-xs font-black uppercase tracking-wider">Verification Locked</p>
              <p className="text-[11px] leading-relaxed text-amber-700/90">
                This dispatch is currently in <span className="font-extrabold capitalize text-amber-900">"{trip.status}"</span> state.
                Only dispatches in <span className="font-extrabold capitalize text-amber-900">"{reqStatusLabel}"</span> status are writable inside the <span className="font-black text-amber-950">{activeRole}</span> role view.
              </p>
            </div>
          </div>
        )}

        {isViewer && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-3.5 flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-0.5 text-left">
              <p className="text-xs font-black uppercase tracking-wider">Read-Only Permission Active</p>
              <p className="text-[11px] leading-relaxed text-amber-700/90">
                You are logged in with Viewer limits. Checkbox controls are locked to read-only state.
              </p>
            </div>
          </div>
        )}

        {/* Core Checklist Item lists */}
        <div className="space-y-3">
          {isLoaderOrAssembler ? (
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-mono px-1 text-left">Manifest by Invoice ({invoices.length})</h3>
          ) : (
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 font-mono px-1 text-left">Manifest Items ({items.length})</h3>
          )}

          {isLoaderOrAssembler && invoices.length === 0 ? (
            <div className="bg-white rounded-3xl py-12 border border-zinc-200 text-center text-zinc-400 text-xs">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
              Loading invoices...
            </div>
          ) : items.length === 0 && !isLoaderOrAssembler ? (
            <div className="bg-white rounded-3xl py-12 border border-zinc-200 text-center text-zinc-400 text-xs">
              No manifest items listed on this dispatch's invoices.
            </div>
          ) : isLoaderOrAssembler ? (
            <div className="space-y-5">
              {[...invoices].reverse().map((inv, index, arr) => {
                const schoolName = inv.schoolName || inv.clientName || inv.client || inv.ship_to_details?.school_name || inv.ship_to_details?.name || 'Unknown School';
                const currentInvoiceNumber = inv.invoiceNumber || inv.taxInvoice || inv.invoice_number || inv.number || 'N/A';
                const lineItems = inv.lineItems || inv.line_items || [];
                const deliveryStopNumber = arr.length - index;

                return (
                  <div key={inv.id || currentInvoiceNumber} className="border border-zinc-200 rounded-3xl p-4 bg-white shadow-xs space-y-3 text-left">
                    <div className="pb-2.5 border-b border-zinc-150 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-zinc-950 uppercase">#{currentInvoiceNumber}</h4>
                        {index === 0 ? (
                          <span className="text-[9px] font-mono font-bold bg-amber-500/10 text-amber-700 border border-amber-200/50 px-2 py-0.5 rounded-full">
                            {activeRole === 'Assembler' ? 'FIRST' : 'LOAD FIRST'}
                          </span>
                        ) : index === arr.length - 1 ? (
                          <span className="text-[9px] font-mono font-bold bg-blue-500/10 text-blue-700 border border-blue-250/50 px-2 py-0.5 rounded-full">
                            {activeRole === 'Assembler' ? 'LAST' : 'LOAD LAST'}
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                            {activeRole === 'Assembler' ? `STEP #${index + 1}` : `STEP #${index + 1}`}
                          </span>
                        )}
                        <span className="text-[9px] font-mono font-semibold text-zinc-400 ml-auto">Stop #{deliveryStopNumber}/{arr.length}</span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-500">{schoolName}</p>
                    </div>

                    <div className="space-y-2.5">
                      {lineItems.map((lineItem: InvoiceLineItem, idx: number) => {
                        const stockCode = lineItem.stockCode || lineItem.stock_code || 'N/A';
                        const description = lineItem.description || '';
                        const qty = Number(lineItem.qty || lineItem.quantity || 0);
                        const isPart = !!lineItem.isPart;
                        const parentItem = lineItem.parentItem ?? null;

                        const keyUnified = `${inv.id}_${stockCode || 'NO_STOCK'}_${description}`;
                        const keyLegacy = `${inv.id}_${stockCode}-${idx}`;
                        const isChecked = !!(checkedState[keyUnified] || checkedState[keyLegacy]);
                        const isUpdating = updatingId === keyUnified || updatingId === keyLegacy;
                        const canCheck = isWritable;

                        return (
                          <div
                            key={`${inv.id}-${stockCode}-${idx}`}
                            onClick={() => {
                              if (!canCheck || isUpdating) return;
                              const itemToCount: AssemblerItemToCount = { stockCode, description, qty, keyUnified, keyLegacy, isPart, parentItem };
                              if (activeRole === 'Assembler') {
                                if (isChecked) handleClearAssemblerCount(itemToCount);
                                else handleSaveAssemblerCount(itemToCount, qty.toString());
                                return;
                              }
                              setActiveItemToCount(itemToCount);
                              setAssemblerEnteredQty('');
                            }}
                            className={cn(
                              "bg-white rounded-2xl p-3.5 border transition-all flex flex-col gap-2.5 select-none",
                              canCheck ? "active:scale-[0.99]" : "opacity-75",
                              isChecked ? "border-emerald-250 bg-emerald-50/10" : "border-zinc-200"
                            )}
                          >
                            <div className="flex items-start gap-3 w-full">
                              <div className="mt-0.5 shrink-0">
                                {isUpdating ? (
                                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                                ) : isChecked ? (
                                  <div className="w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center text-white border border-emerald-600 shadow-sm">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </div>
                                ) : (
                                  <div className={cn("w-5 h-5 border-2 rounded-lg bg-zinc-50", canCheck ? "border-zinc-300" : "border-zinc-200")}></div>
                                )}
                              </div>
                              <div className="flex-grow space-y-1 text-left min-w-0">
                                <div className="flex justify-between items-start gap-2">
                                  <span className="text-[10px] font-mono font-bold bg-zinc-100 text-zinc-500 border border-zinc-150 px-2 py-0.5 rounded truncate flex items-center gap-1.5 leading-none">
                                    <span>{stockCode}</span>
                                    {isPart && (
                                      <span className="text-[8px] font-sans font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1 py-0.2 rounded shrink-0">
                                        Part of {parentItem}
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs font-black text-zinc-950 font-mono shrink-0">Qty: {qty}</span>
                                </div>
                                <h4 className={cn("text-xs font-bold leading-relaxed truncate", isChecked ? "text-zinc-400 line-through" : "text-zinc-800")}>
                                  {description}
                                </h4>
                              </div>
                            </div>

                            {(() => {
                              const partialInfo = trip?.partialItems?.[keyUnified] || trip?.partialItems?.[keyLegacy];
                              if (!partialInfo?.isPartial) return null;
                              return (
                                <div className="w-full mt-1" onClick={(e) => e.stopPropagation()}>
                                  <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-[10px] font-mono text-amber-850">
                                      <span className="flex items-center gap-1 font-bold">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                        PARTIAL
                                      </span>
                                      <span className="bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full text-[9px]">
                                        {partialInfo.actualQty} / {partialInfo.expectedQty}
                                      </span>
                                    </div>
                                    <div className="w-full bg-zinc-200/60 h-2 rounded-full overflow-hidden flex">
                                      <div className="bg-emerald-500 h-full" style={{ width: `${(partialInfo.actualQty / partialInfo.expectedQty) * 100}%` }}></div>
                                      <div className="bg-amber-500 h-full flex-1"></div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-5">
              {groupedItems.map((group) => (
                <div key={group.groupCode} className="border border-zinc-200 rounded-3xl p-3.5 bg-zinc-50/20 space-y-2.5 text-left">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-150">
                    <span className="text-[9px] font-mono font-black uppercase text-zinc-400 tracking-wider">Group Code</span>
                    <span className="font-mono text-[10px] font-black uppercase bg-zinc-900 text-white px-2 py-0.5 rounded-md shadow-xs">
                      {group.groupCode}
                    </span>
                  </div>
                  <div className="space-y-2.5">
                    {group.items.map((item) => {
                      const keyUnified = `${item.stockCode || 'NO_STOCK'}_${item.description}`;
                      const keyLegacy = `${item.stockCode}-${item.legacyIndex}`;
                      const isChecked = !!(checkedState[keyUnified] || checkedState[keyLegacy]);
                      const isUpdating = updatingId === keyUnified || updatingId === keyLegacy;
                      const canCheck = isWritable;
                      const ownPartialInfo = trip?.partialItems?.[keyUnified] ?? trip?.partialItems?.[keyLegacy];

                      const allPartialValues = Object.values(trip?.partialItems || {});
                      const matchingLoaderPartials = allPartialValues.filter(
                        p => p?.isPartial && p.stockCode === item.stockCode && p.description === item.description
                      );
                      const totalMissing = matchingLoaderPartials.reduce((sum, p) => sum + (p.expectedQty - p.actualQty), 0);
                      const totalExpected = matchingLoaderPartials.reduce((sum, p) => sum + p.expectedQty, 0);

                      const partialInfo = ownPartialInfo?.isPartial
                        ? ownPartialInfo
                        : matchingLoaderPartials.length > 0 && totalMissing > 0
                        ? { isPartial: true, actualQty: totalExpected, expectedQty: totalExpected, reason: '', stockCode: item.stockCode, description: item.description }
                        : undefined;

                      const invoiceKey = `${item.stockCode.trim()}__${item.description.trim()}`;
                      const invoiceTotalQty = qtyFromInvoices.get(invoiceKey) ?? item.qty;
                      const displayQty = ownPartialInfo?.isPartial ? ownPartialInfo.actualQty : invoiceTotalQty;

                      return (
                        <div
                          key={`${item.stockCode}-${item.legacyIndex}`}
                          onClick={() => {
                            if (!canCheck || isUpdating) return;
                            if (activeRole === 'Assembler' || activeRole === 'Loader') {
                              const pInfo = trip?.partialItems?.[keyUnified] || trip?.partialItems?.[keyLegacy];
                              const currentCount = pInfo?.isPartial ? pInfo.actualQty : item.qty;
                              setActiveItemToCount({ ...item, keyUnified, keyLegacy });
                              setAssemblerEnteredQty(activeRole === 'Loader' ? '' : currentCount.toString());
                            } else {
                              handleToggle(keyUnified, isChecked);
                            }
                          }}
                          className={cn(
                            "bg-white rounded-2xl p-3.5 border transition-all flex flex-col gap-2.5 select-none",
                            canCheck ? "active:scale-[0.99]" : "opacity-75",
                            isChecked ? "border-emerald-250 bg-emerald-50/10" : "border-zinc-200"
                          )}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div className="mt-0.5 shrink-0">
                              {isUpdating ? (
                                <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                              ) : isChecked ? (
                                <div className="w-5 h-5 bg-emerald-500 rounded-lg flex items-center justify-center text-white border border-emerald-600 shadow-sm">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </div>
                              ) : (
                                <div className={cn("w-5 h-5 border-2 rounded-lg bg-zinc-50", canCheck ? "border-zinc-300" : "border-zinc-200")}></div>
                              )}
                            </div>
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
                                <span className="text-xs font-black text-zinc-950 font-mono shrink-0">Qty: {displayQty}</span>
                              </div>
                              <h4 className={cn("text-xs font-bold leading-relaxed truncate", isChecked ? "text-zinc-400 line-through" : "text-zinc-800")}>
                                {item.description}
                              </h4>
                            </div>
                          </div>

                          {partialInfo?.isPartial && (
                            <div className="w-full mt-1" onClick={(e) => e.stopPropagation()}>
                              <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                                <div className="flex items-center justify-between text-[10px] font-mono text-amber-850">
                                  <span className="flex items-center gap-1 font-bold">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    PARTIAL
                                  </span>
                                  <span className="bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full text-[9px]">
                                    {partialInfo.actualQty} / {partialInfo.expectedQty}
                                  </span>
                                </div>
                                {partialInfo.reason && (
                                  <p className="text-[10px] text-amber-800 font-medium font-sans">
                                    <strong>Reason:</strong> {partialInfo.reason}
                                  </p>
                                )}
                                <div className="w-full bg-zinc-200/60 h-2 rounded-full overflow-hidden flex">
                                  <div className="bg-emerald-500 h-full" style={{ width: `${(partialInfo.actualQty / partialInfo.expectedQty) * 100}%` }}></div>
                                  <div className="bg-amber-500 h-full flex-1"></div>
                                </div>
                                {isWritable && activeRole !== 'Assembler' && activeRole !== 'Loader' && ownPartialInfo?.isPartial && (
                                  <div className="flex gap-2 justify-end pt-1">
                                    <button
                                      type="button"
                                      title="Clear partial flag"
                                      onClick={() => updatePartialItem(trip.id, keyUnified, null)}
                                      className="px-2 py-1 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-black uppercase rounded mobile-tap-target"
                                    >
                                      Clear Flag
                                    </button>
                                    <button
                                      type="button"
                                      title="Edit partial flag"
                                      onClick={() => {
                                        setEditingPartialKey(keyUnified);
                                        setLocalActualQty(partialInfo.actualQty);
                                        setLocalReason(partialInfo.reason);
                                      }}
                                      className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase rounded mobile-tap-target"
                                    >
                                      Edit Flag
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {isWritable && editingPartialKey === keyUnified && (
                            <div className="p-3 bg-zinc-50 border border-zinc-250 rounded-xl space-y-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex justify-between items-center border-b border-zinc-150 pb-1.5">
                                <span className="text-[10px] font-black text-zinc-700 uppercase tracking-wider font-mono">Flag Partial Deliverable</span>
                                <button type="button" title="Close editor" onClick={() => setEditingPartialKey(null)} className="text-zinc-400 hover:text-zinc-650 mobile-tap-target">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase block">Actual Qty there:</label>
                                <input
                                  aria-label="Actual Qty there"
                                  title="Actual quantity there"
                                  type="number"
                                  min={0}
                                  max={item.qty - 1}
                                  value={localActualQty}
                                  onChange={(e) => setLocalActualQty(Math.max(0, Math.min(item.qty - 1, Number(e.target.value))))}
                                  className="block w-24 bg-white border border-zinc-300 rounded-lg p-1.5 text-xs font-black text-center"
                                />
                                <div className="text-[9px] text-amber-700 font-mono flex justify-between pt-1">
                                  <span>Units there: {localActualQty}</span>
                                  <span>Missing: {item.qty - localActualQty}</span>
                                </div>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase block">Reason for discrepancy:</label>
                                <input
                                  type="text"
                                  title="Reason for discrepancy"
                                  placeholder="e.g. Broken packaging, product shortage"
                                  value={localReason}
                                  onChange={(e) => setLocalReason(e.target.value)}
                                  className="block w-full bg-white border border-zinc-300 rounded-lg p-2 text-xs text-zinc-800"
                                />
                              </div>
                              <div className="flex gap-2 justify-end pt-1">
                                <button
                                  type="button"
                                  title="Cancel edit"
                                  onClick={() => setEditingPartialKey(null)}
                                  className="px-2.5 py-1.5 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 text-[9px] font-black uppercase rounded-lg mobile-tap-target"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  title="Save partial flag"
                                  onClick={async () => {
                                    if (!localReason.trim()) {
                                      toast.error('Reason Required', { description: 'Please enter a reason for flagging this item as partially complete.' });
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
                                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[9px] font-black uppercase rounded-lg mobile-tap-target"
                                >
                                  Save Flag
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Assembler/Loader/Stock Counter count entry sheet */}
      <MobileSheet
        isOpen={!!activeItemToCount}
        onClose={() => setActiveItemToCount(null)}
        title={activeRole === 'Assembler' ? 'Define Assembled Count' : activeRole === 'Loader' ? 'Define Loaded Count' : 'Define Physical Count'}
        subtitle={activeItemToCount?.stockCode || 'N/A'}
        fullHeight={false}
      >
        {activeItemToCount && (
          <div className="space-y-4">
            <p className="text-[11px] font-medium text-zinc-500 leading-normal">
              Enter the exact physical quantity {activeRole === 'Assembler' ? 'assembled' : activeRole === 'Loader' ? 'loaded' : 'counted'} for <strong className="text-zinc-850">{activeItemToCount.description}</strong>:
            </p>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  {activeRole === 'Assembler' ? 'Assembled Quantity' : activeRole === 'Loader' ? 'Loaded Quantity' : 'Physical Quantity'}
                </label>
                <span className="text-[10px] font-mono text-zinc-400">Expected: {activeItemToCount.qty}</span>
              </div>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                title="Entered quantity"
                placeholder={`e.g. ${activeItemToCount.qty}`}
                value={assemblerEnteredQty}
                onChange={(e) => setAssemblerEnteredQty(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans text-sm font-black text-zinc-800"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                title="Set count"
                onClick={() => handleSaveAssemblerCount(activeItemToCount, assemblerEnteredQty)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-colors shadow-xs mobile-tap-target"
              >
                Set Count
              </button>
              <button
                type="button"
                title="Clear count"
                onClick={() => handleClearAssemblerCount(activeItemToCount)}
                className="px-3 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-sans font-black text-xs uppercase tracking-wider rounded-xl transition-colors mobile-tap-target"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </MobileSheet>

      {/* Loader/Assembler Pre-Checklist sheet */}
      <MobileSheet
        isOpen={showPreChecklist}
        onClose={() => setShowPreChecklist(false)}
        title={activeRole === 'Assembler' ? 'Assembly Pre-Checklist' : 'Staging Pre-Checklist'}
        subtitle={`Trip: ${trip.name}`}
        headerLeft={
          <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center text-amber-700 border border-amber-200 shrink-0">
            <ClipboardList className="w-5 h-5 stroke-[2]" />
          </div>
        }
        footer={uniquePreChecklistItems.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-sans">
              <span className="font-black text-zinc-500 uppercase text-[9px] tracking-wide">
                {activeRole === 'Assembler' ? 'Assembly Progress' : 'Staging Progress'}
              </span>
              <span className={cn("font-bold px-2 py-0.5 rounded-full text-[10px] border", activeRole === 'Assembler' ? "text-blue-800 bg-blue-50 border-blue-100" : "text-amber-800 bg-amber-50 border-amber-100")}>
                {preChecklistStats.checkedCount} / {preChecklistStats.totalCount} items
              </span>
            </div>
            <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all duration-300", activeRole === 'Assembler' ? "bg-blue-500" : "bg-amber-500")}
                style={{ width: `${preChecklistStats.totalCount === 0 ? 0 : (preChecklistStats.checkedCount / preChecklistStats.totalCount) * 100}%` }}
              ></div>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button
                type="button"
                title="Reset checklist"
                onClick={handleClearPreChecklist}
                className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors mobile-tap-target"
              >
                Reset List
              </button>
              <button
                type="button"
                title="Check all items"
                onClick={handleMarkAllPreChecked}
                className="px-3.5 py-2 bg-amber-100 hover:bg-amber-205 text-amber-800 border border-amber-250 text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors mobile-tap-target"
              >
                Check All
              </button>
              <button
                type="button"
                title="Done and staged"
                onClick={() => setShowPreChecklist(false)}
                className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-805 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors text-center mobile-tap-target"
              >
                Done & Staged
              </button>
            </div>
          </div>
        ) : undefined}
      >
        <div className="space-y-2">
          {uniquePreChecklistItems.length === 0 ? (
            <div className="text-center py-10 text-zinc-400 text-xs font-mono">No items available for this dispatch.</div>
          ) : (
            uniquePreChecklistItems.map((item, idx) => {
              const key = `${item.stockCode.trim().toUpperCase()}_${item.description.trim().toUpperCase()}`;
              const isChecked = !!preCheckedState[key];

              return (
                <div
                  key={`pre-item-${item.stockCode}-${idx}`}
                  onClick={() => togglePreCheck(key)}
                  className={cn(
                    "p-3.5 rounded-2xl border transition-all flex items-start gap-3.5 select-none active:scale-[0.99]",
                    isChecked ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {isChecked ? (
                      <div className="w-4 h-4 bg-amber-600 rounded flex items-center justify-center text-white border border-amber-700 shadow-sm">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 border border-zinc-300 rounded bg-zinc-50/50"></div>
                    )}
                  </div>
                  <div className="flex-grow min-w-0 text-left">
                    <div className="flex justify-between items-baseline gap-2">
                      <span className="text-[10px] font-mono font-black text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded truncate">
                        {item.stockCode}
                      </span>
                      <span className="text-xs font-mono font-black text-zinc-900 shrink-0 bg-zinc-100/80 px-2 py-0.5 rounded-full border border-zinc-200">
                        Qty: {item.qty}
                      </span>
                    </div>
                    <p className={cn("text-[11px] font-semibold text-zinc-700 leading-snug mt-1.5", isChecked && "text-zinc-400 line-through")}>
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </MobileSheet>
    </div>
  );
}
