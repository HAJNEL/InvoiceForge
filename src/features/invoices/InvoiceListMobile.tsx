import React from 'react';
import {
  Search,
  Filter,
  Calendar,
  Upload,
  Loader2,
  AlertCircle,
  ArrowUpDown,
  Layers,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit3,
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { UIInvoice } from './hooks/useInvoices';
import { MobileSheet } from '../../components/mobile/MobileSheet';
import { MobileCardActionsMenu } from '../../components/mobile/MobileCard';
import { MobileLineItemRow } from '../../components/mobile/MobileLineItemRow';

const STATUS_DISPLAY_MAP: Record<string, string> = {
  'partially_complete': 'Partially Complete',
  draft: 'Draft',
  pending: 'Pending',
  proposed: 'Proposed',
  assembled: 'Assembled',
  'on-route': 'On Route',
  'on_route': 'On Route',
  delivered: 'Delivered',
  complete: 'Complete',
  invoiced: 'Complete'
};

const STATUS_BADGE_STYLES: Record<string, string> = {
  'partially_complete': "bg-rose-50 text-rose-600 border-rose-100",
  draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
  pending: "bg-violet-50 text-violet-600 border-violet-100",
  proposed: "bg-amber-50 text-amber-600 border-amber-100",
  assembled: "bg-blue-50 text-blue-600 border-blue-100",
  'on-route': "bg-sky-50 text-sky-600 border-sky-100",
  'on_route': "bg-sky-50 text-sky-600 border-sky-100",
  delivered: "bg-teal-50 text-teal-600 border-teal-100",
  complete: "bg-emerald-50 text-emerald-600 border-emerald-100",
  invoiced: "bg-emerald-50 text-emerald-600 border-emerald-100"
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Trip = any;

interface InvoiceListMobileProps {
  loading: boolean;
  error: string | null;
  invoices: UIInvoice[];
  trips: Trip[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  sortBy: 'number' | 'date' | 'amount' | 'district';
  setSortBy: (v: 'number' | 'date' | 'amount' | 'district') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (v: 'asc' | 'desc') => void;
  groupBy: 'none' | 'district' | 'status';
  setGroupBy: (v: 'none' | 'district' | 'status') => void;
  currentPage: number;
  setCurrentPage: (updater: (prev: number) => number) => void;
  totalPages: number;
  sortedAndFilteredInvoices: UIInvoice[];
  groupedInvoices: Record<string, UIInvoice[]>;
  deleteInvoice: (id: string) => Promise<boolean>;
  updateInvoice: (id: string, data: Record<string, unknown>) => Promise<boolean>;
  onFlaggedClick: (invoice: UIInvoice, trip: Trip, itemKeys: string[]) => void;
}

export function InvoiceListMobile({
  loading,
  error,
  trips,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  groupBy,
  setGroupBy,
  currentPage,
  setCurrentPage,
  totalPages,
  sortedAndFilteredInvoices,
  groupedInvoices,
  deleteInvoice,
  updateInvoice,
  onFlaggedClick
}: InvoiceListMobileProps) {
  const navigate = useNavigate();
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [expandedInvoiceId, setExpandedInvoiceId] = React.useState<string | null>(null);

  // Status change sheet state
  const [selectedInvoiceForStatus, setSelectedInvoiceForStatus] = React.useState<UIInvoice | null>(null);
  const [newStatusValue, setNewStatusValue] = React.useState<string>('');
  const [deliveredDateInput, setDeliveredDateInput] = React.useState<string>(() => new Date().toISOString().split('T')[0]);
  const [isUpdatingStatus, setIsUpdatingStatus] = React.useState(false);
  const [statusError, setStatusError] = React.useState<string | null>(null);
  const [bypassWarning, setBypassWarning] = React.useState(false);

  React.useEffect(() => {
    setStatusError(null);
    setBypassWarning(false);
  }, [selectedInvoiceForStatus, newStatusValue]);

  const findFlagged = (invoice: UIInvoice): { trip: Trip; itemKeys: string[] } | null => {
    for (const trip of trips) {
      if (trip.invoiceIds?.includes(invoice.id) && trip.partialItems) {
        const partialItems = trip.partialItems;
        const tripPartialKeys = Object.keys(partialItems).filter((k) => partialItems[k]?.isPartial);
        if (tripPartialKeys.length > 0) {
          const matchedKeys = tripPartialKeys.filter((k) => {
            const pi = partialItems[k];
            const piCode = String(pi.stockCode || '').trim().toLowerCase();
            const piDesc = String(pi.description || '').trim().toLowerCase();
            const codeUsable = piCode !== '' && piCode !== 'n/a';
            return (invoice.lineItems || []).some((li) => {
              const liCode = String(li.stockCode || '').trim().toLowerCase();
              const liDesc = String(li.description || '').trim().toLowerCase();
              const codeMatch = codeUsable && liCode !== '' && liCode !== 'n/a' && liCode === piCode;
              const descMatch = piDesc !== '' && liDesc === piDesc;
              return codeMatch || descMatch;
            });
          });
          if (matchedKeys.length > 0) {
            return { trip, itemKeys: matchedKeys };
          }
        }
      }
    }
    return null;
  };

  const toggleExpanded = (invoiceId: string) => {
    setExpandedInvoiceId((prev) => (prev === invoiceId ? null : invoiceId));
  };

  const openStatusSheet = (invoice: UIInvoice) => {
    setSelectedInvoiceForStatus(invoice);
    setNewStatusValue(invoice.status.toLowerCase());
    setDeliveredDateInput(invoice.deliveredDate || new Date().toISOString().split('T')[0]);
  };

  const handleSaveStatus = async () => {
    if (!selectedInvoiceForStatus) return;
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      const isDelivered = newStatusValue === 'delivered' || newStatusValue === 'completed' || newStatusValue === 'complete';

      if (isDelivered) {
        const { auth } = await import('../../lib/firebase');
        const { validateAndSubtractInventory } = await import('../../utils/inventory');
        const userUid = auth.currentUser?.uid || '';
        const invCheck = await validateAndSubtractInventory(selectedInvoiceForStatus.id, userUid, bypassWarning);
        if (!invCheck.success) {
          setStatusError(
            (invCheck.error || "Limited inventory stock available.") +
            "\n\nYou can still proceed to catch up on data. Click 'Save Anyway' to bypass validation and record delivery."
          );
          setBypassWarning(true);
          setIsUpdatingStatus(false);
          return;
        }
      }

      const updateData: Record<string, unknown> = { status: newStatusValue };
      if (isDelivered) {
        updateData.deliveredDate = deliveredDateInput;
      }
      await updateInvoice(selectedInvoiceForStatus.id, updateData);
      setSelectedInvoiceForStatus(null);
    } catch (e) {
      console.error("Failed to update status:", e);
      setStatusError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        <p className="text-zinc-500 text-sm">Loading your invoices...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <div className="text-center">
          <p className="text-zinc-900 font-bold">Failed to load invoices</p>
          <p className="text-zinc-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight">Invoices</h1>
        <p className="text-zinc-500 text-xs">Manage, track and extract data from your invoices.</p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            title="Search invoices"
            className="pl-10 pr-4 py-2.5 border border-zinc-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all w-full"
          />
        </div>
        <button
          onClick={() => setIsFilterOpen(true)}
          title="Filter and sort invoices"
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-2.5 border rounded-lg text-sm font-semibold transition-all shadow-sm shrink-0 mobile-tap-target",
            sortBy !== 'date' || groupBy !== 'none' || activeTab !== 'All'
              ? "bg-brand-primary text-white border-brand-primary"
              : "border-zinc-200 text-zinc-600 bg-white"
          )}
        >
          <Filter className="w-4 h-4" />
          {(sortBy !== 'date' || groupBy !== 'none' || activeTab !== 'All') && (
            <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
          )}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/invoices/import"
          title="Import invoices"
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-zinc-200 rounded-lg text-xs font-semibold bg-white shadow-sm mobile-tap-target"
        >
          <Upload className="w-4 h-4 text-zinc-400" />
          Import
        </Link>
        <Link
          to="/invoices/new"
          title="Create new invoice"
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary text-white rounded-lg text-xs font-semibold shadow-sm mobile-tap-target"
        >
          Create New
        </Link>
      </div>

      {sortedAndFilteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-zinc-300" />
          </div>
          <h3 className="text-base font-bold text-zinc-900">No invoices found</h3>
          <p className="text-zinc-500 text-xs max-w-xs mx-auto mt-1">
            Try adjusting your filters or search terms to find what you're looking for.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {(Object.entries(groupedInvoices) as [string, UIInvoice[]][]).map(([groupName, groupItems]) => (
            <div key={groupName} className="bg-white rounded-2xl p-4 shadow-xs border border-zinc-200 space-y-3">
              {groupBy !== 'none' && (
                <div className="flex justify-between items-center border-b border-zinc-100 pb-2.5">
                  <h3 className="text-xs font-black text-brand-primary tracking-tight uppercase flex items-center gap-1.5 min-w-0">
                    <Layers className="w-4 h-4 text-zinc-500 shrink-0" />
                    <span className="truncate">{groupName}</span>
                  </h3>
                  <span className="bg-zinc-100 text-zinc-800 font-black px-2 py-0.5 rounded-full text-[9px] tracking-wider uppercase border border-zinc-200 shrink-0">
                    {groupItems.length}
                  </span>
                </div>
              )}
              <div className="-mx-4 divide-y divide-zinc-100">
                {groupItems.map((invoice) => {
                  const norm = invoice.status.toLowerCase();
                  const label = STATUS_DISPLAY_MAP[norm] || invoice.status;
                  const flagged = findFlagged(invoice);
                  const isExpanded = expandedInvoiceId === invoice.id;
                  const lineItems = invoice.lineItems || [];
                  return (
                    <div key={invoice.id}>
                      <div
                        onClick={() => toggleExpanded(invoice.id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-3 cursor-pointer border-l-4 transition-colors",
                          isExpanded ? "bg-brand-accent/5 border-l-brand-accent" : "border-l-transparent active:bg-zinc-50"
                        )}
                      >
                        <ChevronDown className={cn("w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform", isExpanded && "rotate-180")} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-zinc-900">{invoice.number}</span>
                            {flagged && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFlaggedClick(invoice, flagged.trip, flagged.itemKeys);
                                }}
                                title="Team flagged this invoice as partially complete! Tap to process split"
                                className="p-1 px-1.5 bg-amber-50 border border-amber-200 text-amber-700 font-mono text-[9px] font-black uppercase rounded-lg flex items-center gap-1 inline-flex animate-pulse select-none shrink-0 mobile-tap-target"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                FLAGGED
                              </button>
                            )}
                          </div>
                          <p className="text-sm font-bold text-zinc-900 truncate mt-0.5">{invoice.client}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tight bg-zinc-100 px-1.5 py-0.5 rounded">
                              {invoice.district || 'Unassigned'}
                            </span>
                            <span className="font-mono italic text-[10px] text-zinc-500">{invoice.date}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border whitespace-nowrap",
                            STATUS_BADGE_STYLES[norm] || STATUS_BADGE_STYLES.draft
                          )}>
                            {label}
                          </span>
                          <span className="font-mono font-black text-sm text-zinc-900 tabular-nums">
                            {formatCurrency(invoice.amount)}
                          </span>
                        </div>
                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                          <MobileCardActionsMenu
                            actions={[
                              { label: 'Edit', icon: Edit3, onClick: () => navigate(`/invoices/${invoice.id}`) },
                              { label: 'Change Status', icon: RefreshCw, onClick: () => openStatusSheet(invoice) },
                              { label: 'Delete', icon: Trash2, destructive: true, onClick: () => deleteInvoice(invoice.id) }
                            ]}
                          />
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-3 bg-zinc-50/60 space-y-2">
                          {lineItems.length === 0 ? (
                            <p className="py-6 text-center text-zinc-400 italic text-xs">No line items present for this invoice.</p>
                          ) : (
                            lineItems.map((item, idx) => {
                              const isCodeMatched = searchQuery.trim().length > 0 &&
                                (item.stockCode || '').toLowerCase().includes(searchQuery.toLowerCase());
                              return <MobileLineItemRow key={idx} item={item} highlight={isCodeMatched} />;
                            })
                          )}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="p-2 border border-zinc-200 bg-white rounded-lg disabled:opacity-40 text-zinc-700 transition mobile-tap-target"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-zinc-500 font-medium">
            Page <span className="font-bold text-zinc-800">{currentPage}</span> of <span className="font-bold text-zinc-800">{totalPages}</span>
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="p-2 border border-zinc-200 bg-white rounded-lg disabled:opacity-40 text-zinc-700 transition mobile-tap-target"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter sheet */}
      <MobileSheet isOpen={isFilterOpen} onClose={() => setIsFilterOpen(false)} title="Filter & Sort" fullHeight={false}>
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
              <Filter className="w-3 h-3" />
              Status
            </p>
            <select
              aria-label="Filter by status"
              title="Filter by status"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              className="text-xs font-bold p-2.5 border border-zinc-200 rounded-xl bg-zinc-50 w-full focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
            >
              {['All', 'Partially Complete', 'Draft', 'Proposed', 'Assembled', 'On Route', 'Delivered'].map((tab) => (
                <option key={tab} value={tab}>{tab}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
              <ArrowUpDown className="w-3 h-3" />
              Sort Order
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Sort by"
                title="Sort by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'number' | 'date' | 'amount' | 'district')}
                className="text-xs font-bold p-2.5 border border-zinc-200 rounded-xl bg-zinc-50 w-full focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
              >
                <option value="date">Date</option>
                <option value="number">Inv No</option>
                <option value="amount">Subtotal</option>
                <option value="district">District</option>
              </select>
              <select
                aria-label="Sort order"
                title="Sort order"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="text-xs font-bold p-2.5 border border-zinc-200 rounded-xl bg-zinc-50 w-full focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
              <Layers className="w-3 h-3" />
              Group Results
            </p>
            <div className="flex flex-col gap-1">
              {['none', 'district', 'status'].map((option) => (
                <button
                  key={option}
                  onClick={() => setGroupBy(option as 'none' | 'district' | 'status')}
                  title={`Group by ${option}`}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-tight mobile-tap-target",
                    groupBy === option
                      ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200"
                      : "text-zinc-600 bg-zinc-50"
                  )}
                >
                  {option}
                  {groupBy === option && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
            <button
              onClick={() => {
                setActiveTab('All');
                setSortBy('date');
                setSortOrder('desc');
                setGroupBy('none');
              }}
              title="Reset all filters"
              className="text-[10px] font-black uppercase text-zinc-400 mobile-tap-target"
            >
              Reset All
            </button>
            <button
              onClick={() => setIsFilterOpen(false)}
              title="Apply filters"
              className="text-[10px] font-black uppercase text-brand-accent px-3 py-1.5 bg-brand-accent/10 rounded-lg mobile-tap-target"
            >
              Apply
            </button>
          </div>
        </div>
      </MobileSheet>

      {/* Update Status sheet */}
      <MobileSheet
        isOpen={!!selectedInvoiceForStatus}
        onClose={() => {
          setSelectedInvoiceForStatus(null);
          setStatusError(null);
        }}
        title="Update Status"
        subtitle={selectedInvoiceForStatus?.number}
        fullHeight={false}
        footer={
          <div className="flex items-center gap-3">
            <button
              type="button"
              title="Cancel"
              onClick={() => {
                setSelectedInvoiceForStatus(null);
                setStatusError(null);
              }}
              className="flex-1 py-2.5 border border-zinc-200 rounded-xl text-xs font-bold uppercase mobile-tap-target"
            >
              Cancel
            </button>
            <button
              type="button"
              title="Save status"
              onClick={handleSaveStatus}
              disabled={isUpdatingStatus}
              className="flex-1 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-bold uppercase shadow-md flex items-center justify-center gap-2 mobile-tap-target"
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : bypassWarning ? (
                'Save Anyway'
              ) : (
                'Save'
              )}
            </button>
          </div>
        }
      >
        {selectedInvoiceForStatus && (
          <div className="space-y-5">
            <div className="space-y-2.5">
              <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">
                Choose New Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['partially_complete', 'draft', 'pending', 'proposed', 'assembled', 'on_route', 'delivered', 'complete'].map((status) => {
                  const displayLabel = STATUS_DISPLAY_MAP[status] || status;
                  const isSelected = newStatusValue === status ||
                    (status === 'partially_complete' && (newStatusValue === 'partially_complete' || newStatusValue === 'partially complete' || newStatusValue === 'loaded')) ||
                    (status === 'assembled' && (newStatusValue === 'assembled' || newStatusValue === 'assembly')) ||
                    (status === 'on_route' && (newStatusValue === 'on_route' || newStatusValue === 'on-route' || newStatusValue === 'on route')) ||
                    (status === 'complete' && (newStatusValue === 'complete' || newStatusValue === 'completed' || newStatusValue === 'invoiced'));
                  return (
                    <button
                      key={status}
                      type="button"
                      title={displayLabel}
                      onClick={() => setNewStatusValue(status)}
                      className={cn(
                        "px-3 py-2.5 border text-[10px] font-black rounded-xl uppercase tracking-wider text-center transition-all mobile-tap-target",
                        isSelected
                          ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200"
                          : "border-zinc-200 text-zinc-600"
                      )}
                    >
                      {displayLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {(newStatusValue === 'delivered' || newStatusValue === 'completed' || newStatusValue === 'complete') && (
              <div className="space-y-2 p-4 bg-zinc-50 rounded-xl border border-zinc-200/50">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  Delivered Date
                </label>
                <input
                  aria-label="Delivered date"
                  title="Delivered date"
                  type="date"
                  value={deliveredDateInput}
                  onChange={(e) => setDeliveredDateInput(e.target.value)}
                  className="w-full text-xs font-mono font-bold p-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                  required
                />
                <p className="text-[9px] text-zinc-400 italic">
                  This date will be saved to Firestore as the load's offload timestamp.
                </p>
              </div>
            )}

            {statusError && (
              <div className={cn(
                "p-3 text-xs font-semibold rounded-lg leading-relaxed whitespace-pre-wrap text-left font-sans border",
                bypassWarning
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-red-50 border-red-200 text-red-700"
              )}>
                {bypassWarning && <span className="font-black block uppercase tracking-widest text-[9px] mb-1 text-amber-600">Low Stock Warning:</span>}
                {statusError}
              </div>
            )}
          </div>
        )}
      </MobileSheet>
    </div>
  );
}
