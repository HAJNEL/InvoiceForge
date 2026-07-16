/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  Plus, Search, FileCheck, CheckCircle2, RotateCcw,
  Loader2, FileText, Inbox, Edit3, Trash2, AlertTriangle, Download, Route,
  ExternalLink, RefreshCw
} from 'lucide-react';
import { cn, toTitleCase } from '../../../lib/utils';
import { sanitizeDistrict } from '../../../lib/geocoding';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { SelfInvoice } from '../../../types';
import { useSelfInvoices } from '../hooks/useSelfInvoices';
import { sendZohoInvoice, listZohoContacts, ZohoContactSummary } from '../../../lib/zoho';
import { ZohoCustomerPickerModalMobile } from './ZohoCustomerPickerModalMobile';
import { useClientDistances } from '../hooks/useClientDistances';
import { useSettings } from '../../settings/hooks/useSettings';
import { STATUS_DISPLAY_MAP } from '../constants';
import { calculateJobRevenue, invoiceToRevenueJob } from '../../reports/weeklyRevenue';
import { exportClientInvoiceReport } from '../utils/exportClientInvoiceReport';
import { MobileNavStack, NavStackFrame } from '../../../components/mobile/MobileNavStack';
import { MobileCard, MobileCardActionsMenu } from '../../../components/mobile/MobileCard';

type Tab = 'invoices' | 'history';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

const STATUS_FILTER_OPTIONS = ['draft', 'proposed', 'assembled', 'on_route', 'partially_complete', 'delivered', 'invoiced'];
const EXTRA_FILTER_OPTIONS = [
  { value: 'checked', label: 'Checked (Selected)' },
  { value: 'needs_distance', label: 'Needs Distance' },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function renderStatusBadge(status: string) {
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
}

export function SelfInvoiceModalMobile({ invoices, updateInvoice, onClose }: {
  invoices: UIInvoice[];
  updateInvoice: (id: string, data: Partial<Record<string, unknown>>) => Promise<boolean>;
  onClose: () => void;
}) {
  const { selfInvoices, loading, addSelfInvoice, completeSelfInvoice, revertSelfInvoice, updateSelfInvoiceInvoices, setSelfInvoiceZohoStatus, renameSelfInvoice, deleteSelfInvoice } = useSelfInvoices();
  const { getClientDistance, saveClientDistance } = useClientDistances();
  const { settings } = useSettings();

  const [tab, setTab] = useState<Tab>('invoices');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create/edit-view selection state - kept flat here (rather than inside the
  // pushed frame) so it survives being re-rendered as `push`'s content changes.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [editingSelfInvoiceId, setEditingSelfInvoiceId] = useState<string | null>(null);
  const [invoiceNumberDraft, setInvoiceNumberDraft] = useState('');

  const [zohoSyncingId, setZohoSyncingId] = useState<string | null>(null);
  const [zohoContactPicker, setZohoContactPicker] = useState<{ si: SelfInvoice; contacts: ZohoContactSummary[] } | null>(null);

  const computeNextInvoiceNumber = () => {
    let maxNum = 0;
    selfInvoices.forEach(si => {
      const match = /INV(\d+)/.exec(si.invoiceNumber || '');
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    return `INV${String(maxNum + 1).padStart(5, '0')}`;
  };

  const [distanceDrafts, setDistanceDrafts] = useState<Record<string, string>>({});
  const [savingDistanceId, setSavingDistanceId] = useState<string | null>(null);
  const [autoFilledIds, setAutoFilledIds] = useState<Set<string>>(new Set());
  const autoFillAttempted = useRef<Set<string>>(new Set());

  // Tracks whether the create/edit drill-down frame is currently on screen -
  // drives the distance auto-fill effect the same way `view === 'create'` did
  // on desktop (there's no single `view` state here since nav depth can be
  // arbitrary; this mirrors "is the create/edit frame open").
  const [inCreateView, setInCreateView] = useState(false);

  const getDistanceDraftValue = (inv: UIInvoice) =>
    distanceDrafts[inv.id] ?? (typeof inv.distanceKm === 'number' ? String(inv.distanceKm) : '');

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
    setAutoFilledIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

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
      await saveClientDistance(inv.client, parsed, false);
    } finally {
      setSavingDistanceId(null);
    }
  };

  const openSelfInvoices = useMemo(() => selfInvoices.filter(si => si.status === 'open'), [selfInvoices]);
  const completedSelfInvoices = useMemo(() => selfInvoices.filter(si => si.status === 'completed'), [selfInvoices]);

  const availableInvoices = useMemo(() => {
    const usedIds = new Set(
      selfInvoices.filter(si => si.id !== editingSelfInvoiceId).flatMap(si => si.invoiceIds)
    );
    return invoices.filter(inv => !usedIds.has(inv.id));
  }, [invoices, selfInvoices, editingSelfInvoiceId]);

  useEffect(() => {
    if (!inCreateView) return;
    const toFill = availableInvoices.filter(inv => {
      if (autoFillAttempted.current.has(inv.id)) return false;
      if (hasEffectiveDistance(inv)) return false;
      const cached = getClientDistance(inv.client);
      return !!cached?.completed;
    });
    if (toFill.length === 0) return;
    toFill.forEach(inv => autoFillAttempted.current.add(inv.id));

    (async () => {
      const filledIds: string[] = [];
      for (const inv of toFill) {
        const cached = getClientDistance(inv.client);
        if (!cached) continue;
        setDistanceDrafts(prev => ({ ...prev, [inv.id]: String(cached.distanceKm) }));
        await updateInvoice(inv.id, { distanceKm: cached.distanceKm });
        filledIds.push(inv.id);
      }
      if (filledIds.length > 0) {
        setAutoFilledIds(prev => {
          const next = new Set(prev);
          filledIds.forEach(id => next.add(id));
          return next;
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCreateView, availableInvoices, getClientDistance]);

  const filteredInvoices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return availableInvoices.filter(inv => {
      const matchesStatus =
        statusFilter === 'all' ? true :
        statusFilter === 'checked' ? selectedIds.has(inv.id) :
        statusFilter === 'needs_distance' ? (selectedIds.has(inv.id) && !hasEffectiveDistance(inv)) :
        inv.status.toLowerCase() === statusFilter;
      const matchesSearch = !q || inv.number.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableInvoices, searchTerm, statusFilter, selectedIds, distanceDrafts]);

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedTotal = useMemo(() => {
    const sum = invoices
      .filter(inv => selectedIds.has(inv.id))
      .reduce((acc, inv) => acc + getInvoiceRevenue(inv).totalRevenue, 0);
    return round2(sum);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, selectedIds, distanceDrafts]);

  const selectedMissingDistanceCount = useMemo(() => {
    return invoices.filter(inv => selectedIds.has(inv.id) && !hasEffectiveDistance(inv)).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, selectedIds, distanceDrafts]);

  const handleSubmit = async () => {
    if (selectedIds.size === 0 || selectedMissingDistanceCount > 0) return;
    setSubmitting(true);
    try {
      const ok = editingSelfInvoiceId
        ? await updateSelfInvoiceInvoices(editingSelfInvoiceId, Array.from(selectedIds), selectedTotal)
        : await addSelfInvoice(Array.from(selectedIds), selectedTotal, invoiceNumberDraft);
      if (ok) {
        setEditingSelfInvoiceId(null);
        setInCreateView(false);
        setTab('invoices');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startZohoFlow = async (si: SelfInvoice) => {
    setZohoSyncingId(si.id);
    try {
      const result = await listZohoContacts();
      if (!result.success) {
        await setSelfInvoiceZohoStatus(si.id, { zohoSyncError: result.error });
        toast.error('Could not load Zoho Books customers', { description: result.error });
        return;
      }
      if (result.contacts.length === 0) {
        const message = 'No customers found in Zoho Books. Add one there first.';
        await setSelfInvoiceZohoStatus(si.id, { zohoSyncError: message });
        toast.error(message);
        return;
      }
      if (result.contacts.length === 1) {
        await createZohoInvoiceForCustomer(si, result.contacts[0]);
      } else {
        setZohoContactPicker({ si, contacts: result.contacts });
      }
    } finally {
      setZohoSyncingId(null);
    }
  };

  const createZohoInvoiceForCustomer = async (si: SelfInvoice, contact: ZohoContactSummary) => {
    const bundledInvoices = invoices.filter(inv => si.invoiceIds.includes(inv.id));
    if (bundledInvoices.length === 0) {
      await setSelfInvoiceZohoStatus(si.id, { zohoSyncError: 'No bundled invoices to send.' });
      return;
    }
    setZohoSyncingId(si.id);
    try {
      const lineItems = bundledInvoices.map(inv => ({
        description: `${inv.number} - ${toTitleCase(inv.client)}`,
        quantity: 1,
        rate: round2(getInvoiceRevenue(inv).totalRevenue),
      }));
      const result = await sendZohoInvoice({
        customerId: contact.id,
        invoiceNumber: si.invoiceNumber,
        invoiceDate: new Date().toISOString().slice(0, 10),
        lineItems,
      });
      if (result.success) {
        await setSelfInvoiceZohoStatus(si.id, {
          zohoInvoiceId: result.zohoInvoiceId,
          zohoInvoiceUrl: result.zohoInvoiceUrl,
          zohoCustomerId: contact.id,
          zohoCustomerName: contact.name,
        });
        toast.success(`Sent to Zoho Books (${contact.name})`);
      } else {
        await setSelfInvoiceZohoStatus(si.id, { zohoSyncError: result.error });
        toast.error('Sending to Zoho Books failed', { description: result.error });
      }
    } finally {
      setZohoSyncingId(null);
    }
  };

  const handleConfirmZohoCustomer = async (contact: ZohoContactSummary) => {
    const picker = zohoContactPicker;
    if (!picker) return;
    setZohoContactPicker(null);
    await createZohoInvoiceForCustomer(picker.si, contact);
  };

  const handleComplete = async (id: string) => {
    setBusyId(id);
    try {
      const ok = await completeSelfInvoice(id);
      if (ok) {
        const si = selfInvoices.find(s => s.id === id);
        if (si) {
          const bundled = invoices.filter(inv => si.invoiceIds.includes(inv.id) && typeof inv.distanceKm === 'number');
          await Promise.all(bundled.map(inv => saveClientDistance(inv.client, inv.distanceKm as number, true)));
          await startZohoFlow(si);
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRetryZoho = async (id: string) => {
    const si = selfInvoices.find(s => s.id === id);
    if (si) await startZohoFlow(si);
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

  const warehouseLat = Number(settings?.warehouseLat);
  const warehouseLng = Number(settings?.warehouseLng);
  const warehouseOrigin = Number.isFinite(warehouseLat) && Number.isFinite(warehouseLng)
    ? `${warehouseLat},${warehouseLng}`
    : settings?.warehouseAddress?.trim() || '';

  const handleApplyAutoDistances = async (results: Record<string, number>) => {
    setDistanceDrafts(prev => {
      const next = { ...prev };
      for (const [id, km] of Object.entries(results)) next[id] = String(km);
      return next;
    });
    await Promise.all(Object.entries(results).map(async ([id, km]) => {
      await updateInvoice(id, { distanceKm: km });
      const client = invoices.find(inv => inv.id === id)?.client;
      if (client) await saveClientDistance(client, km, false);
    }));
  };

  const startCreate = () => {
    setEditingSelfInvoiceId(null);
    setSelectedIds(new Set());
    setSearchTerm('');
    setStatusFilter('all');
    setDistanceDrafts({});
    setInvoiceNumberDraft(computeNextInvoiceNumber());
    setInCreateView(true);
  };

  const startEdit = (si: SelfInvoice) => {
    setEditingSelfInvoiceId(si.id);
    setSelectedIds(new Set(si.invoiceIds));
    setSearchTerm('');
    setStatusFilter('all');
    setDistanceDrafts({});
    setInvoiceNumberDraft(si.invoiceNumber);
    setInCreateView(true);
  };

  const cancelCreate = () => {
    setInCreateView(false);
    setEditingSelfInvoiceId(null);
  };

  // Renders the create/edit drill-down body directly (rather than pushing a
  // NavStackFrame) so it always reflects current state on every render -
  // no stale-closure risk from a frame captured once at push-time.
  function renderCreateView(editing: SelfInvoice | null) {
    return (
        <div className="space-y-4">
          <label className="block">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Invoice Number</span>
            <input
              type="text"
              value={invoiceNumberDraft}
              onChange={(e) => setInvoiceNumberDraft(e.target.value)}
              onBlur={async () => {
                const trimmed = invoiceNumberDraft.trim();
                if (!editingSelfInvoiceId) return;
                const current = selfInvoices.find(s => s.id === editingSelfInvoiceId);
                if (!trimmed || trimmed === current?.invoiceNumber) {
                  setInvoiceNumberDraft(current?.invoiceNumber || trimmed);
                  return;
                }
                const ok = await renameSelfInvoice(editingSelfInvoiceId, trimmed);
                if (!ok) setInvoiceNumberDraft(current?.invoiceNumber || trimmed);
              }}
              title="Invoice number"
              className="w-full mt-1 px-3 py-2.5 text-sm font-mono font-black uppercase tracking-widest text-brand-primary bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
            />
          </label>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search invoice number..."
              title="Search invoice number"
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              title="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 text-xs bg-white border border-zinc-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
            >
              <option value="all">All Statuses</option>
              {STATUS_FILTER_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_DISPLAY_MAP[s] || s}</option>
              ))}
              {EXTRA_FILTER_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <AutoDistanceButtonMobile
              origin={warehouseOrigin}
              targets={filteredInvoices.filter(inv => !hasEffectiveDistance(inv))}
              onApply={handleApplyAutoDistances}
            />
          </div>
          <p className="text-[10px] font-mono font-bold text-zinc-400">{filteredInvoices.length} available</p>

          <div className="space-y-2">
            {filteredInvoices.length === 0 ? (
              <div className="py-12 text-center text-zinc-400 text-sm">
                <FileText className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
                No available invoices match your filters.
              </div>
            ) : (
              filteredInvoices.map(inv => {
                const isSelected = selectedIds.has(inv.id);
                const revenue = getInvoiceRevenue(inv);
                const missingDistance = isSelected && !hasEffectiveDistance(inv);
                return (
                  <MobileCard
                    key={inv.id}
                    onClick={() => toggleSelectOne(inv.id)}
                    className={isSelected ? 'border-brand-primary bg-brand-primary/5' : undefined}
                  >
                    <MobileCard.Primary>
                      <div className="min-w-0 flex items-center gap-2">
                        <span className={cn(
                          "w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all",
                          isSelected ? "bg-brand-primary border-brand-primary text-white" : "border-zinc-300 bg-white"
                        )}>
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-mono font-black text-zinc-800">{inv.number}</p>
                          <p className="text-xs text-zinc-600 truncate">{toTitleCase(inv.client)}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-black text-zinc-800">R {revenue.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        <span className={cn(
                          "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border",
                          revenue.isRegional ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200"
                        )}>
                          {revenue.isRegional ? 'Regional' : 'Local'}
                        </span>
                      </div>
                    </MobileCard.Primary>
                    <MobileCard.Secondary>
                      {renderStatusBadge(inv.status)}
                      <span>{inv.date}</span>
                      <span>R {(inv.amount || 0).toLocaleString()} subtotal</span>
                    </MobileCard.Secondary>
                    <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Distance (km)</span>
                      {missingDistance && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        title={autoFilledIds.has(inv.id) ? "Auto-filled from this client's saved distance" : 'Delivery distance in km (optional)'}
                        placeholder="—"
                        value={getDistanceDraftValue(inv)}
                        onChange={(e) => handleDistanceChange(inv.id, e.target.value)}
                        onBlur={() => handleDistanceBlur(inv)}
                        className={cn(
                          "w-20 text-center text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all mobile-tap-target",
                          autoFilledIds.has(inv.id)
                            ? "bg-emerald-50 border border-emerald-400 text-emerald-800 font-bold"
                            : "bg-white border border-zinc-200"
                        )}
                      />
                      {savingDistanceId === inv.id && <Loader2 className="w-3 h-3 animate-spin text-zinc-400 shrink-0" />}
                    </div>
                  </MobileCard>
                );
              })
            )}
          </div>
        </div>
      );
  }

  function renderCreateFooter(editing: SelfInvoice | null) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-zinc-600">
          <span className="font-black text-zinc-900">{selectedIds.size}</span> selected ·
          <span className="font-black text-zinc-900 ml-1">R {selectedTotal.toLocaleString()}</span> total
          {selectedMissingDistanceCount > 0 && (
            <div className="mt-1 inline-flex items-center gap-1 text-amber-600 font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              {selectedMissingDistanceCount} selected {selectedMissingDistanceCount === 1 ? 'invoice needs' : 'invoices need'} a distance
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Cancel"
            onClick={cancelCreate}
            className="px-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-100 text-zinc-600 mobile-tap-target"
          >
            Cancel
          </button>
          <button
            type="button"
            title={selectedMissingDistanceCount > 0 ? 'Enter a distance for every selected invoice before submitting' : 'Submit'}
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || submitting || selectedMissingDistanceCount > 0}
            className="flex-1 px-4 py-2.5 bg-brand-primary text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm mobile-tap-target"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
            {editing ? 'Save Changes' : 'Submit'}
          </button>
        </div>
      </div>
    );
  }

  function renderListView() {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-1 bg-zinc-100 border border-zinc-200 rounded-xl p-1">
          {(['invoices', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              title={t === 'invoices' ? 'Invoices' : 'History'}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg font-black text-[11px] uppercase tracking-wider transition-all mobile-tap-target",
                tab === t ? "bg-white text-brand-primary shadow-sm" : "text-zinc-500"
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
            className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-zinc-800 transition-colors shadow-sm mobile-tap-target"
          >
            <Plus className="w-4 h-4" />
            Create New Invoice
          </button>
        )}

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
            <div className="space-y-2">
              {openSelfInvoices.map(si => (
                <MobileCard key={si.id}>
                  <MobileCard.Primary>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-zinc-900 font-mono">{si.invoiceNumber}</p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        {si.invoiceIds.length} {si.invoiceIds.length === 1 ? 'invoice' : 'invoices'} · {si.createdAt.split('T')[0]}
                      </p>
                    </div>
                    <span className="text-sm font-black text-zinc-800 shrink-0">R {si.totalAmount.toLocaleString()}</span>
                  </MobileCard.Primary>
                  <MobileCard.Actions>
                    <button
                      type="button"
                      onClick={() => handleComplete(si.id)}
                      disabled={busyId === si.id}
                      title="Mark this bundle as complete"
                      className="flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-1.5 mobile-tap-target"
                    >
                      {busyId === si.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Complete
                    </button>
                    <MobileCardActionsMenu
                      actions={[
                        { label: exportingId === si.id ? 'Exporting...' : 'Export Excel report', icon: Download, onClick: () => handleExport(si) },
                        { label: 'Edit invoice', icon: Edit3, onClick: () => startEdit(si) },
                        { label: busyId === si.id ? 'Deleting...' : 'Delete invoice', icon: Trash2, destructive: true, onClick: () => handleDelete(si.id) },
                      ]}
                    />
                  </MobileCard.Actions>
                </MobileCard>
              ))}
            </div>
          )
        ) : (
          completedSelfInvoices.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
              <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Completed Invoices</p>
              <p className="text-zinc-400 text-[11px] mt-1">Completed client invoices will be archived here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {completedSelfInvoices.map(si => (
                <MobileCard key={si.id} className="bg-zinc-50/50">
                  <MobileCard.Primary>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-zinc-900 font-mono">{si.invoiceNumber}</p>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        {si.invoiceIds.length} {si.invoiceIds.length === 1 ? 'invoice' : 'invoices'} · Completed {(si.completedAt || '').split('T')[0]}
                      </p>
                      {si.zohoInvoiceId ? (
                        <a
                          href={si.zohoInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          title="Open in Zoho Books"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 mt-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {si.zohoCustomerName ? `Synced · ${si.zohoCustomerName}` : 'Synced to Zoho Books'}
                        </a>
                      ) : si.zohoSyncError ? (
                        <span title={si.zohoSyncError} className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 mt-1">
                          <AlertTriangle className="w-3 h-3" /> Zoho sync failed
                        </span>
                      ) : null}
                    </div>
                    <span className="text-sm font-black text-zinc-800 shrink-0">R {si.totalAmount.toLocaleString()}</span>
                  </MobileCard.Primary>
                  <MobileCard.Actions>
                    <button
                      type="button"
                      onClick={() => handleRevert(si.id)}
                      disabled={busyId === si.id}
                      title="Revert to open"
                      className="flex-1 px-3 py-2 text-[10px] font-black uppercase tracking-widest bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 mobile-tap-target"
                    >
                      {busyId === si.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      Revert
                    </button>
                    <MobileCardActionsMenu
                      actions={[
                        ...(si.zohoSyncError ? [{ label: zohoSyncingId === si.id ? 'Retrying...' : 'Retry sending to Zoho', icon: RefreshCw, onClick: () => handleRetryZoho(si.id) }] : []),
                        { label: exportingId === si.id ? 'Exporting...' : 'Export Excel report', icon: Download, onClick: () => handleExport(si) },
                        { label: 'Edit invoice', icon: Edit3, onClick: () => startEdit(si) },
                        { label: busyId === si.id ? 'Deleting...' : 'Delete invoice', icon: Trash2, destructive: true, onClick: () => handleDelete(si.id) },
                      ]}
                    />
                  </MobileCard.Actions>
                </MobileCard>
              ))}
            </div>
          )
        )}
      </div>
    )
  };

  const handleClose = () => {
    setInCreateView(false);
    setEditingSelfInvoiceId(null);
    onClose();
  };

  const handlePop = () => {
    setInCreateView(false);
    setEditingSelfInvoiceId(null);
  };

  // Built fresh on every render (not via useNavStack's push, which would
  // capture a stale snapshot) so the create/edit drill-down always reflects
  // current state - see the comment on renderCreateView above.
  const editingSelfInvoice = selfInvoices.find(s => s.id === editingSelfInvoiceId) || null;

  const root: NavStackFrame = {
    title: 'Client Invoices',
    content: renderListView(),
  };

  const stack: NavStackFrame[] = inCreateView
    ? [{
        title: editingSelfInvoice ? 'Edit Invoice' : 'New Invoice',
        subtitle: invoiceNumberDraft || undefined,
        content: renderCreateView(editingSelfInvoice),
        footer: renderCreateFooter(editingSelfInvoice),
      }]
    : [];

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <MobileNavStack isOpen onClose={handleClose} root={root} stack={stack} onPop={handlePop} />
      {zohoContactPicker && (
        <ZohoCustomerPickerModalMobile
          contacts={zohoContactPicker.contacts}
          busy={zohoSyncingId === zohoContactPicker.si.id}
          onConfirm={handleConfirmZohoCustomer}
          onCancel={() => setZohoContactPicker(null)}
        />
      )}
    </APIProvider>
  );
}

// Resolves a free-text query to the same top autocomplete match a user would
// get typing it into Google Maps' search box - identical logic to the desktop
// AutoDistanceButton, just rendered as a compact icon button here.
function getTopPlaceMatch(
  autocompleteService: google.maps.places.AutocompleteService,
  query: string,
  bias?: { lat: number; lng: number }
): Promise<google.maps.places.AutocompletePrediction | null> {
  return new Promise((resolve) => {
    const request: google.maps.places.AutocompletionRequest = {
      input: query,
      componentRestrictions: { country: 'za' }
    };
    if (bias) {
      request.location = new google.maps.LatLng(bias.lat, bias.lng);
      request.radius = 75000;
    }
    autocompleteService.getPlacePredictions(request, (preds, status) => {
      if (status === 'OK' && preds && preds.length > 0) {
        resolve(preds[0]);
      } else {
        resolve(null);
      }
    });
  });
}

function parseLatLng(value: string): { lat: number; lng: number } | null {
  const parts = value.split(',').map(s => parseFloat(s.trim()));
  return parts.length === 2 && parts.every(n => Number.isFinite(n)) ? { lat: parts[0], lng: parts[1] } : null;
}

function AutoDistanceButtonMobile({
  origin,
  targets,
  onApply
}: {
  origin: string;
  targets: UIInvoice[];
  onApply: (results: Record<string, number>) => Promise<void>;
}) {
  const routesLib = useMapsLibrary('routes');
  const placesLib = useMapsLibrary('places');
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (!origin) {
      toast.error('Set a warehouse address in Settings first.');
      return;
    }
    if (!routesLib || !placesLib) {
      toast.error('Google Maps is still loading. Try again in a moment.');
      return;
    }
    if (targets.length === 0) {
      toast.info('No invoices in the current view need a distance.');
      return;
    }
    setBusy(true);
    try {
      const directionsService = new routesLib.DirectionsService();
      const autocompleteService = new placesLib.AutocompleteService();
      const results: Record<string, number> = {};
      const originBias = parseLatLng(origin) || undefined;
      for (const inv of targets) {
        const schoolName = (inv.schoolName || inv.client || '').trim();
        const district = sanitizeDistrict(inv.district);
        try {
          let match = await getTopPlaceMatch(autocompleteService, schoolName, originBias);
          let queryUsed = schoolName;
          if (!match && district) {
            queryUsed = [schoolName, district, 'South Africa'].join(', ');
            match = await getTopPlaceMatch(autocompleteService, queryUsed, originBias);
          }
          const destination = match ? { placeId: match.place_id } : (queryUsed || schoolName);

          const result = await directionsService.route({
            origin,
            destination,
            travelMode: google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true,
            region: 'za'
          });
          const meters = Math.max(0, ...result.routes.map(route =>
            route.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0)
          ));
          if (meters > 0) {
            results[inv.id] = Math.round((meters / 1000) * 10) / 10;
          }
        } catch (err) {
          console.error(`Directions lookup failed for invoice ${inv.id}:`, err);
        }
      }
      const updatedCount = Object.keys(results).length;
      if (updatedCount === 0) {
        toast.error('Could not resolve distances for any of the selected invoices.');
      } else {
        await onApply(results);
        toast.success(`Updated distance for ${updatedCount} of ${targets.length} invoice${targets.length === 1 ? '' : 's'}.`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      title={origin ? 'Auto-fill distances from the warehouse (Settings) to each school via Google Maps' : 'Set a warehouse address in Settings first'}
      onClick={handleClick}
      disabled={busy}
      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all mobile-tap-target"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Route className="w-3.5 h-3.5" />}
    </button>
  );
}
