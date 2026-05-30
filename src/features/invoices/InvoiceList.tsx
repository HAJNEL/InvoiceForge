import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Mail, 
  Trash2, 
  ExternalLink, 
  Upload, 
  Loader2, 
  AlertCircle, 
  Edit3,
  ArrowUpDown,
  Layers,
  Check
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { useInvoices, UIInvoice } from './hooks/useInvoices';
import { motion, AnimatePresence } from 'motion/react';

export function InvoicesList() {
  const { invoices, loading, error, deleteInvoice } = useInvoices();
  const [activeTab, setActiveTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filter & Sort State
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'number' | 'date' | 'amount' | 'district'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<'none' | 'district' | 'status'>('none');
  
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
      const matchesTab = activeTab === 'All' || invoice.status.toLowerCase() === activeTab.toLowerCase();
      const matchesSearch = 
        invoice.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (invoice.district || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.client.toLowerCase().includes(searchQuery.toLowerCase());
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

  const groupedInvoices = useMemo((): Record<string, UIInvoice[]> => {
    if (groupBy === 'none') return { 'All Invoices': sortedAndFilteredInvoices };

    return sortedAndFilteredInvoices.reduce((acc: Record<string, UIInvoice[]>, inv) => {
      const key = (inv[groupBy as keyof UIInvoice] || 'Unassigned') as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(inv);
      return acc;
    }, {});
  }, [sortedAndFilteredInvoices, groupBy]);

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
                        <select 
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as 'number' | 'date' | 'amount' | 'district')}
                          className="text-xs font-bold p-2.5 border border-zinc-200 rounded-xl bg-zinc-50 w-full focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
                        >
                          <option value="date">Date</option>
                          <option value="number">Inv No</option>
                          <option value="amount">Amount</option>
                          <option value="district">District</option>
                        </select>
                        <select 
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
        {['All', 'Draft', 'Assembly', 'Loaded', 'Delivered', 'Invoiced'].map((tab) => (
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
                  <th className="px-6 py-4 font-normal text-right">Amount</th>
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
                    {groupItems.map((invoice) => (
                      <tr key={invoice.id} className="group hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs">
                          <Link to={`/invoices/${invoice.id}`} className="font-mono font-bold hover:text-brand-accent hover:underline flex items-center gap-2">
                             {invoice.number}
                             <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
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
                          <StatusBadge status={invoice.status} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <Link 
                              to={`/invoices/${invoice.id}/edit`}
                              className="p-2 hover:bg-white border-transparent hover:border-zinc-200 border rounded-lg text-zinc-500 transition-all"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Link>
                            <button className="p-2 hover:bg-white border-transparent hover:border-zinc-200 border rounded-lg text-zinc-500 transition-all" title="Download">
                              <Download className="w-4 h-4" />
                            </button>
                            <button className="p-2 hover:bg-white border-transparent hover:border-zinc-200 border rounded-lg text-zinc-500 transition-all" title="Email">
                              <Mail className="w-4 h-4" />
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
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    invoiced: "bg-emerald-50 text-emerald-600 border-emerald-100",
    delivered: "bg-indigo-50 text-indigo-600 border-indigo-100",
    loaded: "bg-amber-50 text-amber-600 border-amber-100",
    assembly: "bg-blue-50 text-blue-600 border-blue-100",
    draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
      styles[status.toLowerCase()] || styles.draft
    )}>
      {status}
    </span>
  );
}
