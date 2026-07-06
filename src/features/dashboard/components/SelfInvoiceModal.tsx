import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  X, Plus, Search, ArrowLeft, FileCheck, CheckCircle2, RotateCcw,
  Loader2, FileText, Inbox, Edit3, Trash2, Check, AlertTriangle, Download
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { SelfInvoice } from '../../../types';
import { useSelfInvoices } from '../hooks/useSelfInvoices';
import { STATUS_DISPLAY_MAP } from '../constants';
import { calculateJobRevenue, invoiceToRevenueJob } from '../../reports/weeklyRevenue';
import { exportClientInvoiceReport } from '../utils/exportClientInvoiceReport';

type Tab = 'invoices' | 'history';
type View = 'list' | 'create';

const STATUS_FILTER_OPTIONS = ['draft', 'proposed', 'assembled', 'on_route', 'partially_complete', 'delivered', 'invoiced'];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function SelfInvoiceModal({ invoices, updateInvoice, onClose }: {
  invoices: UIInvoice[];
  updateInvoice: (id: string, data: Partial<Record<string, unknown>>) => Promise<boolean>;
  onClose: () => void;
}) {
  const { selfInvoices, loading, addSelfInvoice, completeSelfInvoice, revertSelfInvoice, updateSelfInvoiceInvoices, deleteSelfInvoice } = useSelfInvoices();

  const [tab, setTab] = useState<Tab>('invoices');
  const [view, setView] = useState<View>('list');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Create-view selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('invoiced');
  const [submitting, setSubmitting] = useState(false);
  // Set while editing an existing self-invoice's bundle instead of creating a new one.
  const [editingSelfInvoiceId, setEditingSelfInvoiceId] = useState<string | null>(null);

  // Distance drafts keyed by invoice id, for the inline distance input in the
  // create/edit table - a single map instead of one useState per row. Untouched
  // rows fall back to the invoice's own persisted distanceKm.
  const [distanceDrafts, setDistanceDrafts] = useState<Record<string, string>>({});
  const [savingDistanceId, setSavingDistanceId] = useState<string | null>(null);

  const getDistanceDraftValue = (inv: UIInvoice) =>
    distanceDrafts[inv.id] ?? (typeof inv.distanceKm === 'number' ? String(inv.distanceKm) : '');

  // Effective distance = unsaved draft (if the row has been touched this session)
  // else the invoice's persisted distanceKm, else null (no distance recorded yet).
  const getEffectiveDistance = (inv: UIInvoice): number | null => {
    const draft = distanceDrafts[inv.id];
    if (draft !== undefined) {
      const trimmed = draft.trim();
      if (trimmed === '') return null;
      const parsed = parseFloat(trimmed);
      return isNaN(parsed) ? null : parsed;
    }
    return typeof inv.distanceKm === 'number' ? inv.distanceKm : null;
  };

  const hasEffectiveDistance = (inv: UIInvoice) => getEffectiveDistance(inv) !== null;

  const getInvoiceRevenue = (inv: UIInvoice) =>
    calculateJobRevenue(invoiceToRevenueJob(inv, getEffectiveDistance(inv)));

  const handleDistanceChange = (id: string, value: string) => {
    setDistanceDrafts(prev => ({ ...prev, [id]: value }));
  };

  // Not required - blank is valid and simply means "no distance recorded", which
  // calculateJobRevenue treats as Local. Only writes to Firestore when the value
  // actually changed from what's persisted, mirroring InvoiceDetail.tsx's guard.
  const handleDistanceBlur = async (inv: UIInvoice) => {
    const draft = distanceDrafts[inv.id];
    if (draft === undefined) return;
    const trimmed = draft.trim();
    if (trimmed === '') {
      if (inv.distanceKm === undefined) return;
      setSavingDistanceId(inv.id);
      try {
        await updateInvoice(inv.id, { distanceKm: null });
      } finally {
        setSavingDistanceId(null);
      }
      return;
    }
    const parsed = parseFloat(trimmed);
    if (isNaN(parsed) || parsed < 0 || parsed === inv.distanceKm) return;
    setSavingDistanceId(inv.id);
    try {
      await updateInvoice(inv.id, { distanceKm: parsed });
    } finally {
      setSavingDistanceId(null);
    }
  };

  const openSelfInvoices = useMemo(() => selfInvoices.filter(si => si.status === 'open'), [selfInvoices]);
  const completedSelfInvoices = useMemo(() => selfInvoices.filter(si => si.status === 'completed'), [selfInvoices]);

  // An underlying invoice already billed on any OTHER self-invoice (open or completed)
  // can't be picked again, so the client is never double-billed. The self-invoice
  // currently being edited is excluded from that check so its own bundled invoices
  // stay visible (and deselectable) in the picker.
  const availableInvoices = useMemo(() => {
    const usedIds = new Set(
      selfInvoices.filter(si => si.id !== editingSelfInvoiceId).flatMap(si => si.invoiceIds)
    );
    return invoices.filter(inv => !usedIds.has(inv.id));
  }, [invoices, selfInvoices, editingSelfInvoiceId]);

  const filteredInvoices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return availableInvoices.filter(inv => {
      const matchesStatus = statusFilter === 'all' || inv.status.toLowerCase() === statusFilter;
      const matchesSearch = !q || inv.number.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [availableInvoices, searchTerm, statusFilter]);

  const allFilteredSelected = filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedIds.has(inv.id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredInvoices.forEach(inv => next.delete(inv.id));
      } else {
        filteredInvoices.forEach(inv => next.add(inv.id));
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Calculated total (delivery/assembly fee), not the raw subtotal - recomputed
  // live as distance drafts change so what's shown always matches what gets saved.
  const selectedTotal = useMemo(() => {
    const sum = invoices
      .filter(inv => selectedIds.has(inv.id))
      .reduce((acc, inv) => acc + getInvoiceRevenue(inv).totalRevenue, 0);
    return round2(sum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, selectedIds, distanceDrafts]);

  // Distance is required to submit (not required to exist on every candidate row) -
  // the Total is meaningless without knowing which pricing tier applies.
  const selectedMissingDistanceCount = useMemo(() => {
    return invoices.filter(inv => selectedIds.has(inv.id) && !hasEffectiveDistance(inv)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, selectedIds, distanceDrafts]);

  const startCreate = () => {
    setEditingSelfInvoiceId(null);
    setSelectedIds(new Set());
    setSearchTerm('');
    setStatusFilter('invoiced');
    setDistanceDrafts({});
    setView('create');
  };

  const startEdit = (si: SelfInvoice) => {
    setEditingSelfInvoiceId(si.id);
    setSelectedIds(new Set(si.invoiceIds));
    setSearchTerm('');
    setStatusFilter('all');
    setDistanceDrafts({});
    setView('create');
  };

  const cancelCreate = () => {
    setEditingSelfInvoiceId(null);
    setView('list');
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0 || selectedMissingDistanceCount > 0) return;
    setSubmitting(true);
    try {
      const ok = editingSelfInvoiceId
        ? await updateSelfInvoiceInvoices(editingSelfInvoiceId, Array.from(selectedIds), selectedTotal)
        : await addSelfInvoice(Array.from(selectedIds), selectedTotal);
      if (ok) {
        setEditingSelfInvoiceId(null);
        setView('list');
        setTab('invoices');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = async (id: string) => {
    setBusyId(id);
    try {
      await completeSelfInvoice(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleRevert = async (id: string) => {
    setBusyId(id);
    try {
      await revertSelfInvoice(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await deleteSelfInvoice(id);
      setDeleteConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

  const [exportingId, setExportingId] = useState<string | null>(null);
  const handleExport = async (si: SelfInvoice) => {
    setExportingId(si.id);
    try {
      await exportClientInvoiceReport(si, invoices);
    } catch (err) {
      console.error('Export Client Invoice Error:', err);
      toast.error('Export Failed', { description: 'Could not generate the Excel report.' });
    } finally {
      setExportingId(null);
    }
  };

  const renderStatusBadge = (status: string) => {
    const norm = status.toLowerCase();
    const label = STATUS_DISPLAY_MAP[norm] || status;
    const colorClass =
      norm === 'invoiced' || norm === 'complete' || norm === 'completed' || norm === 'delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
      norm === 'partially_complete' || norm === 'partially-completed' || norm === 'partially complete' ? 'bg-amber-50 text-amber-700 border-amber-200' :
      norm === 'assembled' ? 'bg-blue-50 text-blue-700 border-blue-200' :
      norm === 'proposed' ? 'bg-violet-50 text-violet-700 border-violet-200' :
      'bg-zinc-100 text-zinc-500 border-zinc-200';
    return (
      <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0", colorClass)}>
        {label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-zinc-900">
      <div className="absolute inset-0 bg-zinc-900/45 backdrop-blur-sm" onClick={onClose}></div>

      <div className="bg-white rounded-2xl w-full max-w-4xl relative z-10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50 shrink-0">
          <div className="flex items-center gap-3">
            {view === 'create' && (
              <button
                type="button"
                title="Back to list"
                onClick={cancelCreate}
                className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileCheck className="w-4.5 h-4.5 text-emerald-600" />
                {view === 'create' ? (editingSelfInvoiceId ? 'Edit Client Invoice' : 'New Client Invoice') : 'Client Invoicing'}
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                {view === 'create' ? 'Select the invoices to bundle into this invoice' : 'Bundle invoiced deliveries into client invoices'}
              </p>
            </div>
          </div>
          <button onClick={onClose} title="Close" className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {view === 'list' ? (
          <>
            {/* Tabs */}
            <div className="px-6 pt-4 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-1 bg-zinc-100 border border-zinc-200 rounded-xl p-1 w-fit">
                {(['invoices', 'history'] as Tab[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    title={t === 'invoices' ? 'Invoices' : 'History'}
                    onClick={() => setTab(t)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg font-black text-[11px] uppercase tracking-wider transition-all",
                      tab === t ? "bg-white text-brand-primary shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                    )}
                  >
                    {t === 'invoices' ? `Invoices (${openSelfInvoices.length})` : `History (${completedSelfInvoices.length})`}
                  </button>
                ))}
              </div>

              {tab === 'invoices' && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-zinc-800 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  Create New Invoice
                </button>
              )}
            </div>

            {/* List body */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-7 h-7 text-brand-accent animate-spin" />
                </div>
              ) : tab === 'invoices' ? (
                openSelfInvoices.length === 0 ? (
                  <div className="py-16 text-center">
                    <Inbox className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                    <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Client Invoices Yet</p>
                    <p className="text-zinc-400 text-[11px] mt-1">Create one to bundle invoiced deliveries for billing.</p>
                  </div>
                ) : (
                  openSelfInvoices.map(si => (
                    <div key={si.id} className="p-4 border border-zinc-200 rounded-xl flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-zinc-900 font-mono">{si.invoiceNumber}</p>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          {si.invoiceIds.length} {si.invoiceIds.length === 1 ? 'invoice' : 'invoices'} bundled · {si.createdAt.split('T')[0]}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-zinc-800 mr-1">R {si.totalAmount.toLocaleString()}</span>
                        <button
                          type="button"
                          title="Export Excel report"
                          onClick={() => handleExport(si)}
                          disabled={exportingId === si.id}
                          className="p-2 text-zinc-400 hover:text-brand-primary hover:bg-zinc-50 rounded-lg border border-transparent hover:border-zinc-200 transition-all disabled:opacity-50"
                        >
                          {exportingId === si.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit invoice"
                          onClick={() => startEdit(si)}
                          className="p-2 text-zinc-400 hover:text-brand-primary hover:bg-zinc-50 rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === si.id ? (
                          <>
                            <button
                              type="button"
                              title="Confirm delete"
                              onClick={() => handleDelete(si.id)}
                              disabled={busyId === si.id}
                              className="p-2 text-white bg-red-500 rounded-lg border border-red-600 transition-all disabled:opacity-50"
                            >
                              {busyId === si.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              title="Cancel delete"
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            title="Delete invoice"
                            onClick={() => setDeleteConfirmId(si.id)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-50 rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleComplete(si.id)}
                          disabled={busyId === si.id}
                          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                        >
                          {busyId === si.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Complete
                        </button>
                      </div>
                    </div>
                  ))
                )
              ) : (
                completedSelfInvoices.length === 0 ? (
                  <div className="py-16 text-center">
                    <FileText className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                    <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Completed Invoices</p>
                    <p className="text-zinc-400 text-[11px] mt-1">Completed client invoices will be archived here.</p>
                  </div>
                ) : (
                  completedSelfInvoices.map(si => (
                    <div key={si.id} className="p-4 border border-zinc-200 rounded-xl flex items-center justify-between gap-4 bg-zinc-50/50">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-zinc-900 font-mono">{si.invoiceNumber}</p>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          {si.invoiceIds.length} {si.invoiceIds.length === 1 ? 'invoice' : 'invoices'} bundled · Completed {(si.completedAt || '').split('T')[0]}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-zinc-800 mr-1">R {si.totalAmount.toLocaleString()}</span>
                        <button
                          type="button"
                          title="Export Excel report"
                          onClick={() => handleExport(si)}
                          disabled={exportingId === si.id}
                          className="p-2 text-zinc-400 hover:text-brand-primary hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all disabled:opacity-50"
                        >
                          {exportingId === si.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          title="Edit invoice"
                          onClick={() => startEdit(si)}
                          className="p-2 text-zinc-400 hover:text-brand-primary hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {deleteConfirmId === si.id ? (
                          <>
                            <button
                              type="button"
                              title="Confirm delete"
                              onClick={() => handleDelete(si.id)}
                              disabled={busyId === si.id}
                              className="p-2 text-white bg-red-500 rounded-lg border border-red-600 transition-all disabled:opacity-50"
                            >
                              {busyId === si.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              title="Cancel delete"
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            title="Delete invoice"
                            onClick={() => setDeleteConfirmId(si.id)}
                            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRevert(si.id)}
                          disabled={busyId === si.id}
                          className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-all flex items-center gap-1.5"
                        >
                          {busyId === si.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Revert
                        </button>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </>
        ) : (
          <>
            {/* Create view: filters */}
            <div className="px-6 py-4 border-b border-zinc-100 flex flex-wrap items-center gap-3 shrink-0 bg-zinc-50/30">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search invoice number..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                />
              </div>
              <select
                title="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 w-fit"
              >
                <option value="all">All Statuses</option>
                {STATUS_FILTER_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_DISPLAY_MAP[s] || s}</option>
                ))}
              </select>
              <span className="text-[10px] font-mono font-bold text-zinc-400 shrink-0 ml-auto">
                {filteredInvoices.length} available
              </span>
            </div>

            {/* Create view: table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-zinc-150 text-[10px] uppercase tracking-widest font-black text-zinc-400">
                    <th className="py-3 pl-6 pr-2 w-10">
                      <button
                        type="button"
                        title={allFilteredSelected ? 'Deselect all' : 'Select all'}
                        onClick={toggleSelectAll}
                        disabled={filteredInvoices.length === 0}
                        className={cn(
                          "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all disabled:opacity-40",
                          allFilteredSelected ? "bg-brand-primary border-brand-primary text-white" : "border-zinc-300 bg-white"
                        )}
                      >
                        {allFilteredSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    </th>
                    <th className="py-3 px-3">Invoice #</th>
                    <th className="py-3 px-3">Client</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3 text-center">Distance (km)</th>
                    <th className="py-3 pr-6 pl-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-zinc-400 text-sm">
                        <FileText className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
                        No available invoices match your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map(inv => {
                      const isSelected = selectedIds.has(inv.id);
                      const revenue = getInvoiceRevenue(inv);
                      const missingDistance = isSelected && !hasEffectiveDistance(inv);
                      return (
                        <tr
                          key={inv.id}
                          onClick={() => toggleSelectOne(inv.id)}
                          className={cn("cursor-pointer transition-colors", isSelected ? "bg-brand-primary/5" : "hover:bg-zinc-50")}
                        >
                          <td className="py-3 pl-6 pr-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              title={isSelected ? 'Deselect' : 'Select'}
                              onClick={() => toggleSelectOne(inv.id)}
                              className={cn(
                                "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all",
                                isSelected ? "bg-brand-primary border-brand-primary text-white" : "border-zinc-300 bg-white"
                              )}
                            >
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-xs font-mono font-bold text-zinc-800">{inv.number}</td>
                          <td className="py-3 px-3 text-xs text-zinc-700 truncate max-w-[180px]">{inv.client}</td>
                          <td className="py-3 px-3">{renderStatusBadge(inv.status)}</td>
                          <td className="py-3 px-3 text-[11px] text-zinc-400">{inv.date}</td>
                          <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              {missingDistance && (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                              )}
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                title="Delivery distance in km (optional)"
                                placeholder="—"
                                value={getDistanceDraftValue(inv)}
                                onChange={(e) => handleDistanceChange(inv.id, e.target.value)}
                                onBlur={() => handleDistanceBlur(inv)}
                                className="w-16 text-center text-xs bg-white border border-zinc-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
                              />
                              {savingDistanceId === inv.id && <Loader2 className="w-3 h-3 animate-spin text-zinc-400 shrink-0" />}
                            </div>
                          </td>
                          <td className="py-3 pr-6 pl-3 text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-xs font-black text-zinc-800">R {revenue.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] text-zinc-400">R {(inv.amount || 0).toLocaleString()} subtotal</span>
                                <span className={cn(
                                  "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border",
                                  revenue.isRegional ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200"
                                )}>
                                  {revenue.isRegional ? 'Regional' : 'Local'}
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Create view: footer */}
            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-4 shrink-0">
              <div className="text-xs text-zinc-600">
                <span className="font-black text-zinc-900">{selectedIds.size}</span> selected ·
                <span className="font-black text-zinc-900 ml-1">R {selectedTotal.toLocaleString()}</span> total
                {selectedMissingDistanceCount > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 text-amber-600 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {selectedMissingDistanceCount} selected {selectedMissingDistanceCount === 1 ? 'invoice needs' : 'invoices need'} a distance before you can submit
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelCreate}
                  className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-100 text-zinc-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={selectedIds.size === 0 || submitting || selectedMissingDistanceCount > 0}
                  title={selectedMissingDistanceCount > 0 ? 'Enter a distance for every selected invoice before submitting' : undefined}
                  className="px-4 py-2 bg-brand-primary text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
                  {editingSelfInvoiceId ? 'Save Changes' : 'Submit'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
