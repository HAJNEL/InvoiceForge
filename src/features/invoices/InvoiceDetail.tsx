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

export function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { invoice, loading, error } = useInvoice(id);
  const { deleteInvoice, updateInvoice } = useInvoices();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

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

  const invoiceStatuses = ['draft', 'assembly', 'loaded', 'delivered', 'invoiced'];
  const totalQty = invoice.lineItems?.reduce((sum, item) => sum + (parseFloat(item.qty?.toString()) || 0), 0) || 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link 
            to="/invoices" 
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-zinc-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Invoice #{invoice.taxInvoice || invoice.invoiceNumber || 'NO-NUM'}</h1>
              <div className="relative group">
                <StatusBadge status={invoice.status} />
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
              {invoiceStatuses.map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={isUpdatingStatus || invoice.status === status}
                  className={cn(
                    "flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-bold transition-all",
                    invoice.status === status 
                      ? "bg-brand-primary text-white border-brand-primary" 
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                  )}
                >
                  <span className="uppercase tracking-tight">{status}</span>
                  {invoice.status === status && <CheckCircle2 className="w-4 h-4" />}
                  {isUpdatingStatus && invoice.status !== status && <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />}
                </button>
              ))}
            </div>
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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    invoiced: "bg-emerald-50 text-emerald-600 border-emerald-100",
    delivered: "bg-indigo-50 text-indigo-600 border-indigo-100",
    loaded: "bg-amber-50 text-amber-600 border-amber-100",
    assembly: "bg-blue-50 text-blue-600 border-blue-100",
    draft: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };

  return (
    <div className={cn(
      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-2",
      styles[status] || styles.draft
    )}>
      <div className={cn("w-1.5 h-1.5 rounded-full", (styles[status] || styles.draft).replace('bg-', 'bg-opacity-100 ').split(' ')[1])}></div>
      {status}
    </div>
  );
}
