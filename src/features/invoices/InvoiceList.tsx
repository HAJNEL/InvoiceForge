import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  RefreshCw,
  Calendar,
  Trash2, 
  ExternalLink, 
  Upload, 
  Loader2, 
  AlertCircle, 
  Edit3,
  ArrowUpDown,
  Layers,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { useInvoices, UIInvoice } from './hooks/useInvoices';
import { useTrips } from '../trips/hooks/useTrips';
import { validateAndSubtractInventory } from '../../utils/inventory';
import { auth } from '../../lib/firebase';
import { PartialConfirmModal } from '../../components/PartialConfirmModal';
import { AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_DISPLAY_MAP: Record<string, string> = {
  'partially_complete': 'Partially Complete',
  draft: 'Draft',
  proposed: 'Proposed',
  assembled: 'Assembled',
  'on-route': 'On Route',
  'on_route': 'On Route',
  delivered: 'Delivered',
  complete: 'Complete',
  invoiced: 'Complete'
};

export function InvoicesList() {
  const { invoices, loading, error, deleteInvoice, updateInvoice } = useInvoices();
  const { trips } = useTrips();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const [partialModalData, setPartialModalData] = useState<{
    isOpen: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    invoice: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trip: any;
    itemKeys: string[];
  }>({
    isOpen: false,
    invoice: null,
    trip: null,
    itemKeys: []
  });
  
  // Status Modal State
  const [selectedInvoiceForStatus, setSelectedInvoiceForStatus] = useState<UIInvoice | null>(null);
  const [newStatusValue, setNewStatusValue] = useState<string>('');
  const [deliveredDateInput, setDeliveredDateInput] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [bypassWarning, setBypassWarning] = useState(false);

  useEffect(() => {
    setStatusError(null);
    setBypassWarning(false);
  }, [selectedInvoiceForStatus, newStatusValue]);
  
  // Filter & Sort State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'number' | 'date' | 'amount' | 'district'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<'none' | 'district' | 'status'>('none');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Custom states for Row expansion & stock search
  const [expandedInvoiceIds, setExpandedInvoiceIds] = useState<Record<string, boolean>>({});

  const toggleInvoiceExpanded = (invoiceId: string) => {
    setExpandedInvoiceIds(prev => ({
      ...prev,
      [invoiceId]: !prev[invoiceId]
    }));
  };

  // Auto-expand search matches when user types a matching stock code
  useEffect(() => {
    if (searchQuery.trim().length >= 1) {
      setExpandedInvoiceIds(prev => {
        const newExpanded = { ...prev };
        let updated = false;
        invoices.forEach(inv => {
          const matchesStock = inv.lineItems?.some(item => 
            (item.stockCode || '').toLowerCase().includes(searchQuery.toLowerCase())
          );
          if (matchesStock && !newExpanded[inv.id]) {
            newExpanded[inv.id] = true;
            updated = true;
          }
        });
        return updated ? newExpanded : prev;
      });
    }
  }, [searchQuery, invoices]);
  
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const sortedAndFilteredInvoices = useMemo(() => {
    // 1. Filter
    const filtered = invoices.filter(invoice => {
      const normStatus = invoice.status.toLowerCase();
      let matchesTab = activeTab === 'All';
      if (!matchesTab) {
        const displayLabel = STATUS_DISPLAY_MAP[normStatus] || normStatus;
        matchesTab = displayLabel.toLowerCase() === activeTab.toLowerCase();
      }
      const matchesSearch = 
        invoice.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (invoice.district || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (invoice.lineItems || []).some(item => (item.stockCode || '').toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesTab && matchesSearch;
    });

    // 2. Sort
    return [...filtered].sort((a, b) => {
      let valA: string | number = a[sortBy] || '';
      let valB: string | number = b[sortBy] || '';

      if (sortBy === 'date') {
        valA = new Date(valA as string).getTime();
        valB = new Date(valB as string).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [invoices, activeTab, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, sortBy, sortOrder, groupBy]);

  const totalPages = Math.ceil(sortedAndFilteredInvoices.length / itemsPerPage);

  const paginatedInvoices = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFilteredInvoices.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFilteredInvoices, currentPage, itemsPerPage]);

  const groupedInvoices = useMemo((): Record<string, UIInvoice[]> => {
    if (groupBy === 'none') return { 'All Invoices': paginatedInvoices };

    return paginatedInvoices.reduce((acc: Record<string, UIInvoice[]>, inv) => {
      const key = (inv[groupBy as keyof UIInvoice] || 'Unassigned') as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(inv);
      return acc;
    }, {});
  }, [paginatedInvoices, groupBy]);

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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage, track and extract data from your invoices.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={filterRef}>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-semibold transition-all shadow-sm",
                isFilterOpen || sortBy !== 'date' || groupBy !== 'none'
                  ? "bg-brand-primary text-white border-brand-primary"
                  : "border-zinc-200 text-zinc-600 hover:bg-zinc-50 bg-white"
              )}
            >
              <Filter className="w-4 h-4" />
              Filter
              {(sortBy !== 'date' || groupBy !== 'none') && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
              )}
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 bg-white border border-zinc-200 rounded-2xl shadow-2xl z-[100] p-4 overflow-hidden"
                >
                  <div className="space-y-5">
                    <div>
                      <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
                        <ArrowUpDown className="w-3 h-3" />
                        Sort Order
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <select aria-label="Sort by" 
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as 'number' | 'date' | 'amount' | 'district')}
                          className="text-xs font-bold p-2.5 border border-zinc-200 rounded-xl bg-zinc-50 w-full focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
                        >
                          <option value="date">Date</option>
                          <option value="number">Inv No</option>
                          <option value="amount">Subtotal</option>
                          <option value="district">District</option>
                        </select>
                        <select aria-label="Sort order" 
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
                            className={cn(
                              "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all uppercase tracking-tight",
                              groupBy === option 
                                ? "bg-zinc-900 text-white shadow-lg shadow-zinc-200" 
                                : "text-zinc-600 hover:bg-zinc-100"
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
                          setSortBy('date');
                          setSortOrder('desc');
                          setGroupBy('none');
                        }}
                        className="text-[10px] font-black uppercase text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        Reset All
                      </button>
                      <button 
                        onClick={() => setIsFilterOpen(false)}
                        className="text-[10px] font-black uppercase text-brand-accent px-3 py-1.5 bg-brand-accent/10 rounded-lg"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Search invoices..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent focus:outline-none transition-all w-full sm:w-[200px] lg:w-[240px]"
            />
          </div>
          <Link 
            to="/invoices/import"
            className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold hover:bg-zinc-50 transition-colors bg-white shadow-sm"
          >
            <Upload className="w-4 h-4 text-zinc-400" />
            Import
          </Link>
          <Link 
            to="/invoices/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-colors shadow-sm"
          >
            Create New
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-zinc-200 overflow-x-auto scroller-hide">
        {['All', 'Partially Complete', 'Draft', 'Proposed', 'Assembled', 'On Route', 'Delivered'].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "pb-4 text-sm font-semibold px-1 relative transition-colors whitespace-nowrap",
              activeTab === tab ? "text-brand-primary" : "text-zinc-400 hover:text-zinc-600"
            )}
          >
            {tab}
            {activeTab === tab && (
              <motion.div 
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary" 
              />
            )}
          </button>
        ))}
      </div>

      <div className="saas-card overflow-hidden">
        {sortedAndFilteredInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-zinc-300" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900">No invoices found</h3>
            <p className="text-zinc-500 text-sm max-w-xs mx-auto mt-1">
              Try adjusting your filters or search terms to find what you're looking for.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 italic font-mono text-[11px] uppercase tracking-wider text-zinc-400">
                  <th className="px-6 py-4 font-normal">Invoice</th>
                  <th className="px-6 py-4 font-normal">Client / School</th>
                  <th className="px-6 py-4 font-normal">District</th>
                  <th className="px-6 py-4 font-normal">Due Date</th>
                  <th className="px-6 py-4 font-normal text-right">Subtotal</th>
                  <th className="px-6 py-4 font-normal">Status</th>
                  <th className="px-6 py-4 font-normal"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {(Object.entries(groupedInvoices) as [string, UIInvoice[]][]).map(([groupName, groupItems]) => (
                  <React.Fragment key={groupName}>
                    {groupBy !== 'none' && (
                      <tr className="bg-zinc-50/50">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                              {groupBy}:
                            </span>
                            <span className="text-[11px] font-black text-zinc-900 uppercase tracking-tight bg-white px-2 py-0.5 rounded border border-zinc-200">
                              {groupName}
                            </span>
                            <span className="text-[10px] font-bold text-zinc-400 ml-auto bg-zinc-100 px-2 py-0.5 rounded-full">
                              {groupItems.length} {groupItems.length === 1 ? 'invoice' : 'invoices'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {groupItems.map((invoice) => {
                      const isExpanded = !!expandedInvoiceIds[invoice.id];
                      return (
                        <React.Fragment key={invoice.id}>
                          <tr 
                            onClick={() => toggleInvoiceExpanded(invoice.id)}
                            className={cn(
                              "group hover:bg-zinc-50/70 border-b border-zinc-100 transition-colors cursor-pointer",
                              isExpanded ? "bg-zinc-50/40" : ""
                            )}
                          >
                            <td className="px-6 py-4 text-xs" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-col gap-1 items-start">
                                <Link to={`/invoices/${invoice.id}`} className="font-mono font-bold hover:text-brand-accent hover:underline flex items-center gap-2">
                                   {invoice.number}
                                   <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                                {(() => {
                                  // Find if this invoice is flagged as partially complete in any active, associated trips!
                                  for (const trip of trips) {
                                    if (trip.invoiceIds?.includes(invoice.id) && trip.partialItems) {
                                      const partialItems = trip.partialItems;
                                      const tripPartialKeys = Object.keys(partialItems).filter(k => partialItems[k]?.isPartial);
                                      if (tripPartialKeys.length > 0) {
                                        // Match line items
                                        const matchedKeys = tripPartialKeys.filter(k => {
                                          const pi = partialItems[k];
                                          return (invoice.lineItems || []).some(li => 
                                            String(li.stockCode).trim().toLowerCase() === String(pi.stockCode).trim().toLowerCase() &&
                                            String(li.description).trim().toLowerCase() === String(pi.description).trim().toLowerCase()
                                          );
                                        });
                                        if (matchedKeys.length > 0) {
                                          return (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setPartialModalData({
                                                  isOpen: true,
                                                  invoice: invoice,
                                                  trip: trip,
                                                  itemKeys: matchedKeys
                                                });
                                              }}
                                              className="p-1 px-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-mono text-[9px] font-black uppercase rounded-lg flex items-center gap-1 inline-flex animate-pulse select-none shrink-0"
                                              title="Team flagged this invoice as partially complete! Click to process split"
                                            >
                                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                              FLAGGED
                                            </button>
                                          );
                                        }
                                      }
                                    }
                                  }
                                  return null;
                                })()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm font-bold text-zinc-900 line-clamp-1">
                                {invoice.client}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs font-black text-zinc-400 uppercase tracking-tight bg-zinc-100 px-2 py-0.5 rounded">
                                {invoice.district || 'Unassigned'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-500 font-mono italic">
                              {invoice.date}
                            </td>
                            <td className="px-6 py-4 text-sm font-black text-right tabular-nums">
                              {formatCurrency(invoice.amount)}
                            </td>
                             <td className="px-6 py-4">
                              <StatusBadge status={invoice.status} deliveredDate={invoice.deliveredDate} />
                            </td>
                            <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                <Link 
                                  to={`/invoices/${invoice.id}`}
                                  className="p-2 hover:bg-white border-transparent hover:border-zinc-200 border rounded-lg text-zinc-500 transition-all"
                                  title="Edit"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Link>
                                <button 
                                  onClick={() => {
                                    setSelectedInvoiceForStatus(invoice);
                                    setNewStatusValue(invoice.status.toLowerCase());
                                    setDeliveredDateInput(invoice.deliveredDate || new Date().toISOString().split('T')[0]);
                                  }}
                                  className="p-2 hover:bg-white border-transparent hover:border-zinc-200 border rounded-lg text-zinc-500 transition-all" 
                                  title="Change Status"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => deleteInvoice(invoice.id)}
                                  className="p-2 hover:bg-red-50 border-transparent hover:border-red-100 border rounded-lg text-red-500 transition-all ml-2"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          
                          {/* Expanded Line Items Dropdown Row */}
                          {isExpanded && (
                            <tr className="bg-zinc-50/20" onClick={(e) => e.stopPropagation()}>
                              <td colSpan={7} className="px-6 py-4 border-b border-zinc-100">
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                  <div className="flex items-center justify-between">
                                    <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Line Items</h4>
                                    <span className="text-[10px] font-bold text-zinc-400 bg-white border border-zinc-200 px-2 py-0.5 rounded-full">
                                      {(invoice.lineItems || []).length} items
                                    </span>
                                  </div>
                                  <div className="overflow-hidden border border-zinc-200/60 rounded-xl bg-white shadow-sm">
                                    <table className="w-full text-left table-fixed">
                                      <thead>
                                        <tr className="border-b border-zinc-100 bg-zinc-50/50 italic font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                                          <th className="px-4 py-3 font-normal w-[25%]">Stock Code</th>
                                          <th className="px-4 py-3 font-normal w-[45%]">Description</th>
                                          <th className="px-4 py-3 font-normal text-right w-[10%]">Qty</th>
                                          <th className="px-4 py-3 font-normal text-right w-[10%]">Unit Price</th>
                                          <th className="px-4 py-3 font-normal text-right w-[10%]">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-100 text-xs">
                                        {(invoice.lineItems || []).length === 0 ? (
                                          <tr>
                                            <td colSpan={5} className="px-4 py-4 text-center text-zinc-400 italic">
                                              No line items present for this invoice.
                                            </td>
                                          </tr>
                                        ) : (
                                          (invoice.lineItems || []).map((item, idx) => {
                                            const isCodeMatched = searchQuery.trim().length > 0 && 
                                              (item.stockCode || '').toLowerCase().includes(searchQuery.toLowerCase());
                                            return (
                                              <tr 
                                                key={idx} 
                                                className={cn(
                                                  "hover:bg-zinc-50/30 transition-colors",
                                                  isCodeMatched ? "bg-amber-50/80 hover:bg-amber-50" : ""
                                                )}
                                              >
                                                <td className="px-4 py-3 font-mono">
                                                  {isCodeMatched ? (
                                                    <mark className="bg-amber-200 text-amber-950 px-1 py-0.5 rounded font-black">
                                                      {item.stockCode}
                                                    </mark>
                                                  ) : (
                                                    item.stockCode || <span className="text-zinc-300 italic">None</span>
                                                  )}
                                                </td>
                                                <td className="px-4 py-3 text-zinc-600 truncate" title={item.description}>
                                                  {item.description || <span className="text-zinc-300 italic">No description</span>}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-zinc-500 tabular-nums">
                                                  {item.qty}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-zinc-500 tabular-nums">
                                                  {formatCurrency(item.unitPrice)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 tabular-nums">
                                                  {formatCurrency(item.value)}
                                                </td>
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
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-150 bg-zinc-50/50">
            <span className="text-xs text-zinc-500 font-medium">
              Showing <span className="font-bold text-zinc-800">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-zinc-800">{Math.min(currentPage * itemsPerPage, sortedAndFilteredInvoices.length)}</span> of <span className="font-bold text-zinc-800">{sortedAndFilteredInvoices.length}</span> invoices
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pNum = i + 1;
                  if (totalPages > 5 && Math.abs(currentPage - pNum) > 1 && pNum !== 1 && pNum !== totalPages) {
                    if (Math.abs(currentPage - pNum) === 2) {
                      return <span key={pNum} className="text-xs text-zinc-400 font-bold px-0.5">...</span>;
                    }
                    return null;
                  }
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      className={cn(
                        "w-7 h-7 flex items-center justify-center text-xs font-bold rounded-lg border transition",
                        currentPage === pNum 
                          ? "bg-brand-primary border-brand-primary text-white" 
                          : "border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700"
                      )}
                    >
                      {pNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-zinc-250 bg-white rounded-lg hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* UPDATE STATUS DIALOG */}
      <AnimatePresence>
        {selectedInvoiceForStatus && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInvoiceForStatus(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white w-full max-w-sm rounded-2xl shadow-3xl overflow-hidden z-10 border border-zinc-100"
            >
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-md font-black text-zinc-900 tracking-tight">Update Status</h3>
                  <p className="text-zinc-500 text-xs mt-1">
                    Invoice: <span className="font-mono font-bold text-brand-primary">{selectedInvoiceForStatus.number}</span>
                  </p>
                </div>

                <div className="space-y-2.5">
                  <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">
                    Choose New Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {['partially_complete', 'draft', 'proposed', 'assembled', 'on_route', 'delivered', 'complete'].map((status) => {
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
                          onClick={() => setNewStatusValue(status)}
                          className={cn(
                            "px-3 py-2.5 border text-[10px] font-black rounded-xl uppercase tracking-wider text-center transition-all",
                            isSelected
                              ? "bg-zinc-900 text-white border-zinc-900 shadow-lg shadow-zinc-200" 
                              : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                          )}
                        >
                          {displayLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {(newStatusValue === 'delivered' || newStatusValue === 'completed' || newStatusValue === 'complete') && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-2 p-4 bg-zinc-50 rounded-xl border border-zinc-200/50"
                  >
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      Delivered Date
                    </label>
                    <input aria-label="Delivered date" 
                      type="date" 
                      value={deliveredDateInput}
                      onChange={(e) => setDeliveredDateInput(e.target.value)}
                      className="w-full text-xs font-mono font-bold p-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                      required
                    />
                    <p className="text-[9px] text-zinc-400 italic">
                      This date will be saved to Firestore as the load's offload timestamp.
                    </p>
                  </motion.div>
                )}

                {statusError && (
                  <div className={cn(
                    "p-3 text-xs font-semibold rounded-lg leading-relaxed whitespace-pre-wrap text-left font-sans mt-3 border",
                    bypassWarning
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-red-50 border-red-200 text-red-700"
                  )}>
                    {bypassWarning && <span className="font-black block uppercase tracking-widest text-[9px] mb-1 text-amber-600">⚠️ Low Stock Warning:</span>}
                    {statusError}
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedInvoiceForStatus(null);
                      setStatusError(null);
                    }}
                    className="flex-1 py-2 border border-zinc-200 rounded-xl text-xs font-bold uppercase hover:bg-zinc-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!selectedInvoiceForStatus) return;
                      setIsUpdatingStatus(true);
                      setStatusError(null);
                      try {
                        const isDelivered = newStatusValue === 'delivered' || newStatusValue === 'completed' || newStatusValue === 'complete';
                        
                        if (isDelivered) {
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

                        const updateData: Record<string, unknown> = {
                          status: newStatusValue
                        };
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
                    }}
                    disabled={isUpdatingStatus}
                    className="flex-1 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold uppercase hover:opacity-90 transition-all shadow-md flex items-center justify-center gap-2"
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {partialModalData.isOpen && (
        <PartialConfirmModal
          isOpen={partialModalData.isOpen}
          onClose={() => setPartialModalData(prev => ({ ...prev, isOpen: false }))}
          invoice={partialModalData.invoice}
          trip={partialModalData.trip}
          itemKeys={partialModalData.itemKeys}
          onSuccess={() => {
            // Updated successfully, list will live updates
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status, deliveredDate }: { status: string; deliveredDate?: string }) {
  const norm = status.toLowerCase();
  const styles: Record<string, string> = {
    'partially_complete': "bg-rose-50 text-rose-600 border-rose-100",
    draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
    proposed: "bg-amber-50 text-amber-600 border-amber-100",
    assembled: "bg-blue-50 text-blue-600 border-blue-100",
    'on-route': "bg-sky-50 text-sky-600 border-sky-100",
    'on_route': "bg-sky-50 text-sky-600 border-sky-100",
    delivered: "bg-teal-50 text-teal-600 border-teal-100",
    complete: "bg-emerald-50 text-emerald-600 border-emerald-100",
    invoiced: "bg-emerald-50 text-emerald-600 border-emerald-100"
  };

  const label = STATUS_DISPLAY_MAP[norm] || status;

  return (
    <div className="flex flex-col gap-0.5 items-start">
      <span className={cn(
        "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
        styles[norm] || styles.draft
      )}>
        {label}
      </span>
      {(norm === 'delivered' || norm === 'completed' || norm === 'complete') && deliveredDate && (
        <span className="text-[9px] text-zinc-400 font-mono italic">
          Delivered: {deliveredDate}
        </span>
      )}
    </div>
  );
}
