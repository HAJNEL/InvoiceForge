import { 
  ArrowLeft, 
  Download, 
  Plus, 
  Send, 
  Edit3,
  Building2,
  CreditCard,
  FileCheck2,
  Loader2,
  AlertCircle,
  Trash2,
  Package,
  MapPin,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useInvoice } from './hooks/useInvoice';
import { useInvoices } from './hooks/useInvoices';
import { cn, formatCurrency } from '../../lib/utils';

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

export function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { invoice, loading, error } = useInvoice(id);
  const { deleteInvoice, updateInvoice } = useInvoices();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showDeliveredPrompt, setShowDeliveredPrompt] = useState(false);
  const [deliveredDateInput, setDeliveredDateInput] = useState(() => new Date().toISOString().split('T')[0]);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [bypassWarning, setBypassWarning] = useState(false);

  const handleDelete = async () => {
    if (id) {
      if (confirm('Are you sure you want to delete this invoice?')) {
        const success = await deleteInvoice(id);
        if (success) {
          navigate('/invoices');
        }
      }
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (id && invoice) {
      setStatusError(null);
      setBypassWarning(false);
      if (newStatus === 'delivered' || newStatus === 'complete' || newStatus === 'completed') {
        setPendingStatus(newStatus === 'completed' ? 'complete' : newStatus);
        setShowDeliveredPrompt(true);
        return;
      }
      setIsUpdatingStatus(true);
      try {
        await updateInvoice(id, { status: newStatus });
      } catch (err) {
        console.error('Failed to update status:', err);
      } finally {
        setIsUpdatingStatus(false);
      }
    }
  };

  const handleSaveDeliveredStatus = async () => {
    if (id && invoice) {
      setIsUpdatingStatus(true);
      setStatusError(null);
      try {
        // Stock is now deducted at assembly (per item, when the Assembler counts it),
        // so delivery no longer touches inventory — it only records the delivery.
        await updateInvoice(id, {
          status: pendingStatus || 'delivered',
          deliveredDate: deliveredDateInput
        });
        setPendingStatus(null);
        setShowDeliveredPrompt(false);
        setBypassWarning(false);
      } catch (err) {
        console.error('Failed to update status:', err);
        setStatusError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsUpdatingStatus(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
        <p className="text-zinc-500 text-sm">Loading invoice details...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <div className="text-center">
          <p className="text-zinc-900 font-bold">{error ? 'Failed to load invoice' : 'Invoice not found'}</p>
          <p className="text-zinc-500 text-sm">{error || "The invoice you're looking for doesn't exist."}</p>
        </div>
        <Link to="/invoices" className="text-brand-accent font-bold hover:underline">Back to Invoices</Link>
      </div>
    );
  }

  const invoiceStatuses = ['partially_complete', 'draft', 'proposed', 'assembled', 'on_route', 'delivered', 'complete'];
  const totalQty = invoice.lineItems?.reduce((sum, item) => sum + (parseFloat(item.qty?.toString()) || 0), 0) || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/invoices"
            aria-label="Back to invoices"
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-zinc-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Invoice #{invoice.taxInvoice || invoice.invoiceNumber || 'NO-NUM'}</h1>
              <div className="relative group">
                <StatusBadge status={invoice.status} deliveredDate={invoice.deliveredDate} />
              </div>
            </div>
            <p className="text-zinc-500 text-sm mt-1">Generated on {invoice.invoiceDate || invoice.issueDate || 'N/A'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link 
            to={`/invoices/${id}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold bg-white hover:bg-zinc-50 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </Link>
          <button className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-200">
            <Send className="w-4 h-4" />
            Send Invoice
          </button>
          <button 
            onClick={handleDelete}
            className="p-2 border border-zinc-200 rounded-lg hover:bg-red-50 hover:text-red-600 text-zinc-500 transition-colors"
            title="Delete Invoice"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Invoice Visual */}
          <div className="saas-card p-12 bg-white shadow-2xl shadow-zinc-200">
             <div className="flex justify-between items-start mb-16">
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center text-white">
                   <Building2 className="w-6 h-6" />
                 </div>
                 <div>
                   <h2 className="text-xl font-bold tracking-tighter uppercase italic">{invoice.companyName || 'InvoiceForge'}</h2>
                   <p className="text-[10px] text-zinc-400 font-mono">FINANCIAL SYSTEMS INC.</p>
                 </div>
               </div>
               
               <div className="text-right">
                 <h2 className="text-4xl font-light tracking-tighter uppercase mb-1">Invoice</h2>
                 <p className="text-sm font-mono text-zinc-500 uppercase tracking-widest">#{invoice.taxInvoice || invoice.invoiceNumber || 'NO-NUM'}</p>
               </div>
             </div>

             <div className="grid grid-cols-2 gap-12 mb-16 px-2">
               <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 border-l-2 border-brand-accent pl-3">From</p>
                  <div className="text-sm">
                    <p className="font-bold text-lg mb-1">{invoice.companyName || 'InvoiceForge Inc.'}</p>
                    {invoice.companyAddressLine1 && <p className="text-zinc-500">{invoice.companyAddressLine1}</p>}
                    {invoice.companyAddressLine2 && <p className="text-zinc-500">{invoice.companyAddressLine2}</p>}
                    {invoice.companyVatNo && <p className="text-zinc-500 font-mono mt-2 text-xs">VAT ID: {invoice.companyVatNo}</p>}
                  </div>
               </div>
                <div className="space-y-4">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 border-l-2 border-brand-accent pl-3">Bill To</p>
                  <div className="text-sm">
                    <p className="font-bold text-lg mb-1">{invoice.schoolName || invoice.customerName || invoice.clientName || 'Unknown Client'}</p>
                    {invoice.schoolName && invoice.customerName && <p className="text-xs text-zinc-500 italic mt-0.5">{invoice.customerName}</p>}
                    <p className="text-zinc-500 mt-2">{invoice.streetAddress || invoice.customerAddressLine1 || invoice.clientAddress}</p>
                    <p className="text-zinc-500">
                      {[invoice.suburb, invoice.district].filter(Boolean).join(', ') || invoice.customerAddressLine2}
                    </p>
                    {invoice.email && <p className="text-zinc-500 mt-2 font-medium underline">{invoice.email}</p>}
                  </div>
               </div>
             </div>

             <div className="mb-16">
               <table className="w-full text-left">
                 <thead>
                   <tr className="border-b-2 border-zinc-900 h-12 italic font-mono text-[11px] uppercase tracking-wider">
                     <th className="pb-2 font-bold px-2">Description</th>
                     <th className="pb-2 font-bold px-2 text-right">Qty</th>
                     <th className="pb-2 font-bold px-2 text-right">Price</th>
                     <th className="pb-2 font-bold px-2 text-right">Total</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-100">
                   {(invoice.lineItems || []).map((item, idx: number) => (
                     <tr key={idx}>
                       <td className="py-6 px-2 text-sm font-medium text-zinc-800">{item.description}</td>
                       <td className="py-6 px-2 text-sm text-zinc-500 text-right tabular-nums">{item.qty}</td>
                       <td className="py-6 px-2 text-sm text-zinc-500 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                       <td className="py-6 px-2 text-sm font-bold text-zinc-900 text-right tabular-nums">{formatCurrency(item.value)}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>

             <div className="flex justify-end pr-2">
                <div className="w-full max-w-[280px] space-y-4 p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <div className="flex justify-between text-xs text-zinc-500 font-bold uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span className="text-zinc-900 tabular-nums whitespace-nowrap">{formatCurrency(invoice.subTotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500 font-bold uppercase tracking-widest">
                    <span>VAT ({invoice.vatPercentage || 15}%)</span>
                    <span className="text-zinc-900 tabular-nums whitespace-nowrap">{formatCurrency(invoice.vatAmount)}</span>
                  </div>
                  {invoice.freight > 0 && (
                    <div className="flex justify-between text-xs text-amber-600 font-bold uppercase tracking-widest">
                      <span>Freight</span>
                      <span className="tabular-nums whitespace-nowrap">{formatCurrency(invoice.freight)}</span>
                    </div>
                  )}
                  <div className="pt-4 border-t border-zinc-200 flex justify-between">
                    <span className="text-sm font-bold uppercase tracking-tighter">Total Due</span>
                    <span className="text-xl font-black text-brand-primary tabular-nums whitespace-nowrap">{formatCurrency(invoice.totalDue || invoice.amountIncl)}</span>
                  </div>
                </div>
             </div>
             
             <div className="mt-20 pt-10 border-t border-zinc-50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-zinc-400" />
                  <div className="text-[10px] text-zinc-500 leading-normal uppercase font-bold tracking-widest max-w-[400px]">
                    Payable via ACH or Credit Card. Check your email for a secure payment link. Banking: {invoice.bankName} - {invoice.account} - {invoice.swift}
                  </div>
                </div>
                <div className="w-24 h-24 bg-zinc-50 flex items-center justify-center rounded border border-zinc-100">
                  <span className="text-[8px] text-zinc-300 font-mono text-center">QR Code Area</span>
                </div>
             </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Status Update Controller */}
           <div className="saas-card p-6">
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
                    className={cn(
                      "flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all",
                      isSelected 
                        ? "bg-brand-primary text-white border-brand-primary" 
                        : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
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
                    {bypassWarning && <span className="font-black block uppercase tracking-widest text-[9px] mb-1 text-amber-600">⚠️ Low Stock Warning:</span>}
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
                    className="flex-1 py-1.5 border border-zinc-200 rounded-lg text-xs font-bold hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDeliveredStatus}
                    className="flex-1 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-sm"
                  >
                    {bypassWarning ? 'Confirm Anyway' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="saas-card p-6">
            <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4" />
              Audit Summary
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Extraction</p>
                  <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-black uppercase">Verified</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-black text-emerald-600">CONFIRMED</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 leading-none">Total Qty</p>
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3 h-3 text-zinc-400" />
                    <span className="text-sm font-black text-zinc-900">{totalQty}</span>
                  </div>
                </div>
                <div className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 col-span-2">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1 leading-none">District</p>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-zinc-400" />
                    <span className="text-sm font-black text-zinc-900 uppercase font-bold">{invoice.district || 'N/A'}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                 <button className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest p-3 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all text-zinc-500 group">
                    <span>Export Audit Trail</span>
                    <Download className="w-3.5 h-3.5 text-zinc-400 group-hover:text-brand-accent transition-colors" />
                 </button>
                 <button className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest p-3 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-all text-zinc-500 group">
                    <span>View Metadata</span>
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400 group-hover:text-brand-accent transition-colors" />
                 </button>
              </div>
            </div>
          </div>

          <div className="saas-card p-6">
            <h3 className="font-bold text-xs uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Recent Updates
            </h3>
            <div className="space-y-6 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-100">
              {[
                { date: invoice.updatedAt || invoice.createdAt || 'N/A', event: `Status: ${invoice.status.toUpperCase()}`, desc: 'Workflow synchronization complete' }
              ].map((update, i) => (
                <div key={i} className="relative pl-8">
                  <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full bg-white border-2 border-zinc-200 z-10 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-accent"></div>
                  </div>
                  <p className="text-[11px] font-black text-zinc-900 uppercase tracking-tight">{update.event}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5 leading-tight">{update.desc}</p>
                  <p className="text-[9px] text-zinc-400 mt-2 font-mono uppercase font-bold">{new Date(update.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
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

  const key = norm;
  const activeStyle = styles[key] || styles.draft;
  const label = STATUS_DISPLAY_MAP[key] || status;

  return (
    <div className="flex flex-col gap-0.5 items-start">
      <div className={cn(
        "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-2",
        activeStyle
      )}>
        <div className={cn("w-1.5 h-1.5 rounded-full", activeStyle.replace('bg-', 'bg-opacity-100 ').split(' ')[1])}></div>
        {label}
      </div>
      {(norm === 'delivered' || norm === 'completed' || norm === 'complete') && deliveredDate && (
        <span className="text-[9px] text-zinc-400 font-mono italic px-1 mt-1 font-semibold">
          Delivered: {deliveredDate}
        </span>
      )}
    </div>
  );
}
