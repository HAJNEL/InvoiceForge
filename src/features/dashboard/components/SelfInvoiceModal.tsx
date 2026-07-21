/// <reference types="google.maps" />
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  X, Plus, Search, ArrowLeft, FileCheck, CheckCircle2, RotateCcw,
  Loader2, FileText, Inbox, Edit3, Trash2, Check, AlertTriangle, Download, Route,
  ArrowUp, ArrowDown, ArrowUpDown, ExternalLink, RefreshCw
} from 'lucide-react';
import { cn, toTitleCase } from '../../../lib/utils';
import { sanitizeDistrict } from '../../../lib/geocoding';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { SelfInvoice } from '../../../types';
import { useSelfInvoices } from '../hooks/useSelfInvoices';
import { sendZohoInvoice, listZohoContacts, ZohoContactSummary } from '../../../lib/zoho';
import { ZohoCustomerPickerModal } from './ZohoCustomerPickerModal';
import { useClientDistances } from '../hooks/useClientDistances';
import { useSettings } from '../../settings/hooks/useSettings';
import { STATUS_DISPLAY_MAP, isPartialInvoice } from '../constants';
import { calculateJobRevenue, invoiceToRevenueJob } from '../../reports/weeklyRevenue';
import { exportClientInvoiceReport } from '../utils/exportClientInvoiceReport';

type Tab = 'invoices' | 'history';
type View = 'list' | 'create';
type SortColumn = 'number' | 'client' | 'status' | 'date' | 'distance' | 'total';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';

const STATUS_FILTER_OPTIONS = ['draft', 'proposed', 'assembled', 'on_route', 'partially_complete', 'delivered', 'invoiced'];
// Filter values that aren't real invoice statuses - handled separately in filteredInvoices.
const EXTRA_FILTER_OPTIONS = [
  { value: 'checked', label: 'Checked (Selected)' },
  { value: 'needs_distance', label: 'Needs Distance' },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function SelfInvoiceModal({ invoices, updateInvoice, onClose }: {
  invoices: UIInvoice[];
  updateInvoice: (id: string, data: Partial<Record<string, unknown>>) => Promise<boolean>;
  onClose: () => void;
}) {
  const { selfInvoices, loading, addSelfInvoice, completeSelfInvoice, revertSelfInvoice, updateSelfInvoiceInvoices, setSelfInvoiceZohoStatus, renameSelfInvoice, deleteSelfInvoice } = useSelfInvoices();
  const { getClientDistance, saveClientDistance } = useClientDistances();
  const { settings } = useSettings();

  const [tab, setTab] = useState<Tab>('invoices');
  const [view, setView] = useState<View>('list');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Create-view selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  // Set while editing an existing self-invoice's bundle instead of creating a new one.
  const [editingSelfInvoiceId, setEditingSelfInvoiceId] = useState<string | null>(null);

  // Invoice number shown/editable at the top of the create/edit dialog. For a new
  // (unsaved) bundle this is just a preview of what addSelfInvoice will assign
  // unless overridden; for an existing one, editing it renames it immediately.
  const [invoiceNumberDraft, setInvoiceNumberDraft] = useState('');
  const [editingNumber, setEditingNumber] = useState(false);

  const [zohoSyncingId, setZohoSyncingId] = useState<string | null>(null);
  // Populated once a bundle's Zoho org turns out to have more than one
  // customer, so the user can pick which one this invoice links to -
  // see startZohoFlow/handleConfirmZohoCustomer below.
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

  // Distance drafts keyed by invoice id, for the inline distance input in the
  // create/edit table - a single map instead of one useState per row. Untouched
  // rows fall back to the invoice's own persisted distanceKm.
  const [distanceDrafts, setDistanceDrafts] = useState<Record<string, string>>({});
  const [savingDistanceId, setSavingDistanceId] = useState<string | null>(null);
  // Invoice ids whose distance was auto-filled from a confirmed cached client
  // distance (see the effect below) - drives the green highlight on the input.
  // Cleared the moment the user edits that row by hand.
  const [autoFilledIds, setAutoFilledIds] = useState<Set<string>>(new Set());
  // Persists across re-renders (unlike autoFilledIds) so each invoice is only
  // considered for auto-fill once per modal session, even after the write below
  // causes `invoices` to refresh.
  const autoFillAttempted = useRef<Set<string>>(new Set());

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
    // A hand-edited value is no longer "the saved distance" - drop the green highlight.
    setAutoFilledIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
      // Cache it for next time so a returning client doesn't need a fresh Google
      // Maps lookup - not yet "completed" until this bundle is actually completed.
      await saveClientDistance(inv.client, parsed, false);
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
    // Invoices already bundled into the one currently being edited stay visible/deselectable
    // even if they're partial - only fresh candidates are hidden from the picker.
    const currentBundleIds = new Set(selfInvoices.find(si => si.id === editingSelfInvoiceId)?.invoiceIds || []);
    return invoices.filter(inv => !usedIds.has(inv.id) && (currentBundleIds.has(inv.id) || !isPartialInvoice(inv)));
  }, [invoices, selfInvoices, editingSelfInvoiceId]);

  // Auto-populates any invoice missing a distance from a *confirmed* cached
  // client distance (one backed by a self-invoice that's actually reached
  // "Completed" - see handleComplete), so a returning client's distance never
  // needs a fresh Google Maps lookup. Each invoice id is only attempted once
  // per modal session (autoFillAttempted), so this can't loop once the write
  // below refreshes `invoices` from Firestore.
  useEffect(() => {
    if (view !== 'create') return;
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
  }, [view, availableInvoices, getClientDistance]);

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

  const [sortColumn, setSortColumn] = useState<SortColumn>('number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sorting is applied on top of filteredInvoices, not baked into it, so the
  // filter/select-all logic below (which doesn't care about order) stays simple.
  const sortedInvoices = useMemo(() => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...filteredInvoices].sort((a, b) => {
      switch (sortColumn) {
        case 'number':
          return a.number.localeCompare(b.number, undefined, { numeric: true }) * dir;
        case 'client':
          return toTitleCase(a.client).localeCompare(toTitleCase(b.client)) * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'date':
          return (a.date || '').localeCompare(b.date || '') * dir;
        case 'distance': {
          const da = getEffectiveDistance(a);
          const db = getEffectiveDistance(b);
          if (da === null && db === null) return 0;
          if (da === null) return 1; // invoices missing a distance always sort last
          if (db === null) return -1;
          return (da - db) * dir;
        }
        case 'total':
          return (getInvoiceRevenue(a).totalRevenue - getInvoiceRevenue(b).totalRevenue) * dir;
        default:
          return 0;
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredInvoices, sortColumn, sortDirection, distanceDrafts]);

  const renderSortableHeader = (column: SortColumn, label: string, align: 'left' | 'center' | 'right' = 'left') => (
    <button
      type="button"
      title={`Sort by ${label}`}
      onClick={() => handleSort(column)}
      className={cn(
        "inline-flex items-center gap-1 hover:text-zinc-600 transition-colors",
        align === 'right' && 'justify-end w-full',
        align === 'center' && 'justify-center w-full',
        sortColumn === column && 'text-zinc-600'
      )}
    >
      {label}
      {sortColumn === column ? (
        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-30" />
      )}
    </button>
  );

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
    setStatusFilter('all');
    setDistanceDrafts({});
    setInvoiceNumberDraft(computeNextInvoiceNumber());
    setEditingNumber(false);
    setView('create');
  };

  const startEdit = (si: SelfInvoice) => {
    setEditingSelfInvoiceId(si.id);
    setSelectedIds(new Set(si.invoiceIds));
    setSearchTerm('');
    setStatusFilter('all');
    setDistanceDrafts({});
    setInvoiceNumberDraft(si.invoiceNumber);
    setEditingNumber(false);
    setView('create');
  };

  const cancelCreate = () => {
    setEditingSelfInvoiceId(null);
    setView('list');
  };

  // Renames the invoice number as soon as the user finishes editing it (blur/Enter),
  // rather than waiting for Submit - only meaningful for an already-saved bundle;
  // for a brand-new one the typed value is just held in invoiceNumberDraft until
  // Submit creates it with that number (see handleSubmit/addSelfInvoice below).
  const commitInvoiceNumberEdit = async () => {
    setEditingNumber(false);
    const trimmed = invoiceNumberDraft.trim();
    if (!editingSelfInvoiceId) return;
    const current = selfInvoices.find(si => si.id === editingSelfInvoiceId);
    if (!trimmed || trimmed === current?.invoiceNumber) {
      setInvoiceNumberDraft(current?.invoiceNumber || trimmed);
      return;
    }
    const ok = await renameSelfInvoice(editingSelfInvoiceId, trimmed);
    if (!ok) setInvoiceNumberDraft(current?.invoiceNumber || trimmed);
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0 || selectedMissingDistanceCount > 0) return;
    setSubmitting(true);
    try {
      const ok = editingSelfInvoiceId
        ? await updateSelfInvoiceInvoices(editingSelfInvoiceId, Array.from(selectedIds), selectedTotal)
        : await addSelfInvoice(Array.from(selectedIds), selectedTotal, invoiceNumberDraft);
      if (ok) {
        setEditingSelfInvoiceId(null);
        setView('list');
        setTab('invoices');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Entry point for pushing a bundle to Zoho Books - loads the org's customer
  // list and either auto-picks the sole customer or opens the picker dialog
  // for the user to choose one. Reused by handleComplete and the manual Retry
  // button on already-completed bundles.
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

  // Pushes a bundle to Zoho Books, linked to the given customer: one line item
  // per underlying invoice. Best-effort - failures are recorded on the
  // self-invoice doc (zohoSyncError) rather than thrown, so a Zoho outage never
  // undoes the "Completed" status.
  const createZohoInvoiceForCustomer = async (si: SelfInvoice, contact: ZohoContactSummary) => {
    // Partially-delivered invoices aren't billable yet, so they're left off the Zoho invoice
    // until they reach a real completed status.
    const bundledInvoices = invoices.filter(inv => si.invoiceIds.includes(inv.id) && !isPartialInvoice(inv));
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
      // Confirm the cached distance for every client in this bundle now that the
      // self-invoice has actually reached "Completed" - only from this point on
      // is it trusted to auto-populate other invoices for the same client.
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
      setDeleteConfirmId(null);
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyClientName = async (name: string) => {
    try {
      await navigator.clipboard.writeText(name);
      toast.success(`Copied "${name}" to clipboard`);
    } catch (err) {
      console.error('Clipboard write failed:', err);
      toast.error('Could not copy to clipboard');
    }
  };

  // Warehouse origin for the Auto Distance button below. Coordinates take
  // priority over the raw address text since they're already geocoded, but
  // tolerate either being stored as a string (e.g. hand-edited Firestore data)
  // rather than a number.
  const warehouseLat = Number(settings?.warehouseLat);
  const warehouseLng = Number(settings?.warehouseLng);
  const warehouseOrigin = Number.isFinite(warehouseLat) && Number.isFinite(warehouseLng)
    ? `${warehouseLat},${warehouseLng}`
    : settings?.warehouseAddress?.trim() || '';

  // Applies distances resolved by AutoDistanceButton: updates the local drafts
  // (so the inputs reflect the new values immediately), persists each one, and
  // caches it per client (unconfirmed - see saveClientDistance) so a repeat
  // invoice for the same school can skip Google Maps entirely next time.
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
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
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
            <div className="min-w-0">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FileCheck className="w-4.5 h-4.5 text-emerald-600" />
                {view === 'create' ? (editingSelfInvoiceId ? 'Edit Client Invoice' : 'New Client Invoice') : 'Client Invoicing'}
              </h2>
              {view === 'create' && (
                editingNumber ? (
                  <input
                    type="text"
                    autoFocus
                    value={invoiceNumberDraft}
                    onChange={(e) => setInvoiceNumberDraft(e.target.value)}
                    onBlur={commitInvoiceNumberEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      if (e.key === 'Escape') {
                        setInvoiceNumberDraft(editingSelfInvoiceId ? (selfInvoices.find(si => si.id === editingSelfInvoiceId)?.invoiceNumber || '') : computeNextInvoiceNumber());
                        setEditingNumber(false);
                      }
                    }}
                    className="text-[11px] font-mono font-black uppercase tracking-widest text-brand-primary bg-white border border-brand-accent/40 rounded-lg px-1.5 py-0.5 mt-0.5 w-32 focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingNumber(true)}
                    title="Click to edit invoice number"
                    className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-mono font-black uppercase tracking-widest text-zinc-500 hover:text-brand-primary transition-colors"
                  >
                    {invoiceNumberDraft || 'INV00001'}
                    <Edit3 className="w-2.5 h-2.5 opacity-50" />
                  </button>
                )
              )}
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
                        {si.zohoInvoiceId ? (
                          <a
                            href={si.zohoInvoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Open in Zoho Books"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {si.zohoCustomerName ? `Synced to Zoho Books · ${si.zohoCustomerName}` : 'Synced to Zoho Books'}
                          </a>
                        ) : si.zohoSyncError ? (
                          <span
                            title={si.zohoSyncError}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 mt-1"
                          >
                            <AlertTriangle className="w-3 h-3" /> Zoho sync failed
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-black text-zinc-800 mr-1">R {si.totalAmount.toLocaleString()}</span>
                        {si.zohoSyncError && (
                          <button
                            type="button"
                            title="Retry sending to Zoho Books"
                            onClick={() => handleRetryZoho(si.id)}
                            disabled={zohoSyncingId === si.id}
                            className="p-2 text-zinc-400 hover:text-brand-primary hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all disabled:opacity-50"
                          >
                            {zohoSyncingId === si.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                          </button>
                        )}
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
              <AutoDistanceButton
                origin={warehouseOrigin}
                targets={filteredInvoices.filter(inv => !hasEffectiveDistance(inv))}
                onApply={handleApplyAutoDistances}
              />
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
                {EXTRA_FILTER_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
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
                    <th className="py-3 px-3">{renderSortableHeader('number', 'Invoice #')}</th>
                    <th className="py-3 px-3">{renderSortableHeader('client', 'Client')}</th>
                    <th className="py-3 px-3">{renderSortableHeader('status', 'Status')}</th>
                    <th className="py-3 px-3">{renderSortableHeader('date', 'Date')}</th>
                    <th className="py-3 px-3 text-center">{renderSortableHeader('distance', 'Distance (km)', 'center')}</th>
                    <th className="py-3 pr-6 pl-3 text-right">{renderSortableHeader('total', 'Total', 'right')}</th>
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
                    sortedInvoices.map(inv => {
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
                          <td
                            className="py-3 px-3 text-xs text-zinc-700 truncate max-w-[180px] cursor-pointer hover:text-brand-primary hover:underline"
                            title="Click to copy client name"
                            onClick={(e) => { e.stopPropagation(); handleCopyClientName(toTitleCase(inv.client)); }}
                          >
                            {toTitleCase(inv.client)}
                          </td>
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
                                title={autoFilledIds.has(inv.id) ? 'Auto-filled from this client\'s saved distance' : 'Delivery distance in km (optional)'}
                                placeholder="—"
                                value={getDistanceDraftValue(inv)}
                                onChange={(e) => handleDistanceChange(inv.id, e.target.value)}
                                onBlur={() => handleDistanceBlur(inv)}
                                className={cn(
                                  "w-16 text-center text-xs rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent transition-all",
                                  autoFilledIds.has(inv.id)
                                    ? "bg-emerald-50 border border-emerald-400 text-emerald-800 font-bold"
                                    : "bg-white border border-zinc-200"
                                )}
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
    {zohoContactPicker && (
      <ZohoCustomerPickerModal
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
// get typing it into Google Maps' search box (same AutocompleteService + 'za'
// restriction as GoogleMapsAutocomplete.tsx), instead of handing the raw text
// straight to Directions and hoping its own geocoder guesses the right place.
// `bias` (usually the warehouse's coordinates) is passed through as a location
// + radius so a same-named school near the warehouse outranks one hundreds of
// km away, the way Google Maps' own search ranks by proximity.
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
      request.radius = 75000; // 75km - biases toward the warehouse's region without hard-excluding real matches farther out
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

// The origin string is either "lat,lng" (warehouse coords, preferred) or a raw
// address; only the former can be used as an autocomplete location bias.
function parseLatLng(value: string): { lat: number; lng: number } | null {
  const parts = value.split(',').map(s => parseFloat(s.trim()));
  return parts.length === 2 && parts.every(n => Number.isFinite(n)) ? { lat: parts[0], lng: parts[1] } : null;
}

// Renders inside the APIProvider above so useMapsLibrary can resolve the Maps
// JavaScript SDK's DirectionsService - the REST Distance Matrix API doesn't
// support browser CORS, but the JS SDK's own channel does, and it's already the
// pattern this codebase uses for driving directions (see MapComponent.tsx).
//
// DistanceMatrixService only ever returns the single "best" route, which is
// usually the fastest one - not necessarily the longest. Billing here is meant
// to match what a human gets by opening Google Maps directions and taking the
// longest of the listed route alternatives (e.g. the N2 alternative is often
// shorter but the billed distance should reflect the worst-case route), so we
// use DirectionsService with provideRouteAlternatives and take the max.
function AutoDistanceButton({
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
      // DirectionsService takes one origin/destination pair per request (no
      // batching like Distance Matrix), so resolve each invoice in turn.
      for (const inv of targets) {
        const schoolName = (inv.schoolName || inv.client || '').trim();
        const district = sanitizeDistrict(inv.district);
        try {
          // Search by the school name alone first, biased toward the warehouse's
          // location - same as typing just the name into Google Maps' search box
          // and taking the first suggestion. Only fall back to appending the
          // district (and retrying) if that plain-name search finds nothing,
          // since a wrong/placeholder district can send the geocoder to a
          // same-named school in a totally different province.
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
            // Match google.co.za/maps: bias the school-name lookup and routing
            // to South Africa, same as the 'za' restriction in GoogleMapsAutocomplete.
            region: 'za'
          });
          const routeSummaries = result.routes.map(route => {
            const meters = route.legs.reduce((sum, leg) => sum + (leg.distance?.value || 0), 0);
            // Google's own resolved address for where the route actually ends -
            // if this doesn't match the intended school, the query string above
            // geocoded to the wrong place, which is why the distance looks wrong.
            const endAddress = route.legs[route.legs.length - 1]?.end_address || '(unknown)';
            return { meters, km: Math.round((meters / 1000) * 10) / 10, endAddress, summary: route.summary || '' };
          });
          const maxMeters = Math.max(0, ...routeSummaries.map(r => r.meters));

          console.groupCollapsed(`[Auto Distance] ${inv.client} → query: "${queryUsed}"`);
          console.log(`Autocomplete match: ${match ? `"${match.description}"` : '(none - fell back to raw query text)'}`);
          routeSummaries.forEach((r, i) => {
            const selected = r.meters === maxMeters ? '  ← SELECTED' : '';
            console.log(`Route ${i + 1}${r.summary ? ` (${r.summary})` : ''}: ${r.km} km, resolved to "${r.endAddress}"${selected}`);
          });
          console.groupEnd();

          if (maxMeters > 0) {
            results[inv.id] = Math.round((maxMeters / 1000) * 10) / 10;
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
      className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-200 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-50 hover:text-brand-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Route className="w-3.5 h-3.5" />}
      Auto Distance
    </button>
  );
}
