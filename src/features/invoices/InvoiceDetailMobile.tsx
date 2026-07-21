import {
  ArrowLeft,
  Edit3,
  Trash2,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  Loader2,
  Save,
  Route
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatCurrency } from '../../lib/utils';
import { MobileLineItemRow } from '../../components/mobile/MobileLineItemRow';
import { FirestoreInvoice } from './hooks/useInvoice';

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

interface InvoiceDetailMobileProps {
  id?: string;
  invoice: FirestoreInvoice;
  invoiceStatuses: string[];
  totalQty: number;
  isUpdatingStatus: boolean;
  showDeliveredPrompt: boolean;
  deliveredDateInput: string;
  setDeliveredDateInput: (v: string) => void;
  statusError: string | null;
  bypassWarning: boolean;
  distanceInput: string;
  setDistanceInput: (v: string) => void;
  isDistanceValid: boolean;
  distanceChanged: boolean;
  isSavingDistance: boolean;
  handleSaveDistance: () => void;
  handleStatusChange: (status: string) => void;
  handleSaveDeliveredStatus: () => void;
  handleDelete: () => void;
  setShowDeliveredPrompt: (v: boolean) => void;
  setStatusError: (v: string | null) => void;
  setBypassWarning: (v: boolean) => void;
}

export function InvoiceDetailMobile({
  id,
  invoice,
  invoiceStatuses,
  totalQty,
  isUpdatingStatus,
  showDeliveredPrompt,
  deliveredDateInput,
  setDeliveredDateInput,
  statusError,
  bypassWarning,
  distanceInput,
  setDistanceInput,
  isDistanceValid,
  distanceChanged,
  isSavingDistance,
  handleSaveDistance,
  handleStatusChange,
  handleSaveDeliveredStatus,
  handleDelete,
  setShowDeliveredPrompt,
  setStatusError,
  setBypassWarning
}: InvoiceDetailMobileProps) {
  const norm = invoice.status.toLowerCase();
  const label = STATUS_DISPLAY_MAP[norm] || invoice.status;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex items-center gap-3">
        <Link
          to="/invoices"
          aria-label="Back to invoices"
          title="Back to invoices"
          className="p-2 bg-white rounded-lg border border-zinc-200 text-zinc-500 shrink-0 mobile-tap-target"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight truncate">
            Invoice #{invoice.taxInvoice || invoice.invoiceNumber || 'NO-NUM'}
          </h1>
          <p className="text-zinc-500 text-xs mt-0.5">
            Generated on {invoice.invoiceDate || invoice.issueDate || 'N/A'}
          </p>
        </div>
        <button
          onClick={handleDelete}
          title="Delete Invoice"
          className="p-2 border border-zinc-200 rounded-lg text-zinc-500 shrink-0 mobile-tap-target"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
          STATUS_BADGE_STYLES[norm] || STATUS_BADGE_STYLES.draft
        )}>
          {label}
        </span>
        {(norm === 'delivered' || norm === 'complete') && invoice.deliveredDate && (
          <span className="text-[10px] text-zinc-400 font-mono italic">Delivered: {invoice.deliveredDate}</span>
        )}
        <Link
          to={`/invoices/${id}/edit`}
          title="Edit invoice"
          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-lg text-xs font-semibold bg-white mobile-tap-target"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit
        </Link>
      </div>

      {/* Bill To / Client info */}
      <div className="saas-card p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-l-2 border-brand-accent pl-2">Bill To</p>
        <div className="text-sm space-y-1">
          <p className="font-bold text-base">{invoice.schoolName || invoice.customerName || invoice.clientName || 'Unknown Client'}</p>
          {invoice.schoolName && invoice.customerName && <p className="text-xs text-zinc-500 italic">{invoice.customerName}</p>}
          <p className="text-zinc-500 text-xs">{invoice.deliveryAddressLine1 || invoice.clientAddress}</p>
          <p className="text-zinc-500 text-xs">
            {[invoice.deliveryAddressLine2, invoice.deliveryRegion, invoice.district].filter(Boolean).join(', ')}
          </p>
          {invoice.email && <p className="text-zinc-500 text-xs mt-1 font-medium underline">{invoice.email}</p>}
        </div>
      </div>

      {/* Line Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Line Items</h3>
          <span className="text-[10px] font-bold text-zinc-400 bg-white border border-zinc-200 px-2 py-0.5 rounded-full">
            {(invoice.lineItems || []).length} items
          </span>
        </div>
        <div className="space-y-2">
          {(invoice.lineItems || []).length === 0 ? (
            <p className="py-8 text-center text-zinc-400 italic text-xs">No line items present for this invoice.</p>
          ) : (
            (invoice.lineItems || []).map((item, idx) => <MobileLineItemRow key={idx} item={item} />)
          )}
        </div>
      </div>

      {/* Totals */}
      <div className="saas-card p-4 space-y-3">
        <div className="flex justify-between text-xs text-zinc-500 font-bold uppercase tracking-widest">
          <span>Subtotal</span>
          <span className="text-zinc-900 tabular-nums">{formatCurrency(invoice.subTotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-zinc-500 font-bold uppercase tracking-widest">
          <span>VAT ({invoice.vatPercentage || 15}%)</span>
          <span className="text-zinc-900 tabular-nums">{formatCurrency(invoice.vatAmount)}</span>
        </div>
        {invoice.freight > 0 && (
          <div className="flex justify-between text-xs text-amber-600 font-bold uppercase tracking-widest">
            <span>Freight</span>
            <span className="tabular-nums">{formatCurrency(invoice.freight)}</span>
          </div>
        )}
        <div className="pt-3 border-t border-zinc-200 flex justify-between">
          <span className="text-sm font-bold uppercase tracking-tighter">Total Due</span>
          <span className="text-lg font-black text-brand-primary tabular-nums">
            {formatCurrency(invoice.totalDue || invoice.amountIncl)}
          </span>
        </div>
      </div>

      {/* Status Update Controller */}
      <div className="saas-card p-4">
        <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-400 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Invoice Status
        </h3>
        <div className="grid grid-cols-1 gap-2">
          {invoiceStatuses.map((status) => {
            const displayLabel = STATUS_DISPLAY_MAP[status] || status;
            const isSelected = invoice.status === status ||
              (status === 'partially_complete' && (invoice.status === 'partially_complete' || invoice.status === 'partially complete' || invoice.status === 'loaded')) ||
              (status === 'assembled' && (invoice.status === 'assembled' || invoice.status === 'assembly')) ||
              (status === 'on_route' && (invoice.status === 'on_route' || invoice.status === 'on-route' || invoice.status === 'on route')) ||
              (status === 'complete' && (invoice.status === 'complete' || invoice.status === 'completed' || invoice.status === 'invoiced'));
            return (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={isUpdatingStatus || isSelected}
                title={displayLabel}
                className={cn(
                  "flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all mobile-tap-target",
                  isSelected
                    ? "bg-brand-primary text-white border-brand-primary"
                    : "bg-white text-zinc-600 border-zinc-200"
                )}
              >
                <span className="uppercase tracking-tight">{displayLabel}</span>
                {isSelected && <CheckCircle2 className="w-4 h-4" />}
                {isUpdatingStatus && !isSelected && <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />}
              </button>
            );
          })}
        </div>

        {showDeliveredPrompt && (
          <div className="mt-4 p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
            <p className="text-xs font-bold text-zinc-700">Specify Delivered Date:</p>
            <input
              type="date"
              aria-label="Delivered date"
              title="Delivered date"
              value={deliveredDateInput}
              onChange={(e) => setDeliveredDateInput(e.target.value)}
              className="w-full text-xs font-mono font-bold p-2 bg-white border border-zinc-200 rounded-lg focus:outline-none"
            />

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

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeliveredPrompt(false);
                  setStatusError(null);
                  setBypassWarning(false);
                }}
                title="Cancel"
                className="flex-1 py-2 border border-zinc-200 rounded-lg text-xs font-bold mobile-tap-target"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDeliveredStatus}
                title={bypassWarning ? 'Confirm anyway' : 'Confirm'}
                className="flex-1 py-2 bg-brand-primary text-white rounded-lg text-xs font-bold shadow-sm mobile-tap-target"
              >
                {bypassWarning ? 'Confirm Anyway' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audit Summary */}
      <div className="saas-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 leading-none">Total Qty</p>
            <div className="flex items-center gap-1.5">
              <Package className="w-3 h-3 text-zinc-400" />
              <span className="text-sm font-black text-zinc-900">{totalQty}</span>
            </div>
          </div>
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 leading-none">Distance (KM)</p>
            <div className="flex items-center gap-1.5">
              <Route className="w-3 h-3 text-zinc-400 shrink-0" />
              <input
                type="number"
                min="0"
                step="0.1"
                title="Delivery distance in km"
                aria-label="Delivery distance in km"
                placeholder="—"
                value={distanceInput}
                onChange={(e) => setDistanceInput(e.target.value)}
                className="w-full min-w-0 bg-transparent text-sm font-black text-zinc-900 focus:outline-none"
              />
              {distanceChanged && (
                <button
                  onClick={handleSaveDistance}
                  disabled={isSavingDistance}
                  title="Save distance"
                  className="p-1 rounded-md text-zinc-400 shrink-0 mobile-tap-target"
                >
                  {isSavingDistance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            {isDistanceValid && (
              <p className="text-[9px] text-zinc-400 mt-1 font-bold uppercase tracking-widest">
                {parseFloat(distanceInput) >= 50 ? 'Regional (8% + 2%)' : 'Local (6% + 1.5%)'}
              </p>
            )}
          </div>
          <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 col-span-2">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 leading-none">District</p>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-zinc-400" />
              <span className="text-sm font-black text-zinc-900 uppercase font-bold">{invoice.district || 'N/A'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
