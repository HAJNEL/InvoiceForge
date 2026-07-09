import { useState, type ReactNode } from 'react';
import { FileText, Package, X, Eye, ExternalLink, Phone } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { GeocodedInvoice } from './types';
import { useSchoolPhone } from './useSchoolPhone';
import { SchoolPhoneDialog } from './SchoolPhoneDialog';

// Shared invoice detail readout used both below the standard map (as a horizontal
// card) and inside the fullscreen map's left sidebar (as a vertical panel).
export function InvoiceDetailsPanel({
  invoice,
  variant = 'card',
  onClose,
  onViewInvoice,
  extraActions
}: {
  invoice: GeocodedInvoice;
  variant?: 'card' | 'sidebar';
  onClose: () => void;
  onViewInvoice: () => void;
  extraActions?: ReactNode;
}) {
  const isSidebar = variant === 'sidebar';
  const phone = useSchoolPhone(invoice.client, invoice.district);
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);

  return (
    <div className={cn(
      isSidebar
        ? "flex flex-col h-full"
        : "bg-white p-6 rounded-2xl shadow-xl border border-zinc-200 z-10 animate-in slide-in-from-top-4 duration-300 ring-4 ring-brand-primary/5"
    )}>
      <div className={cn(
        "flex justify-between items-start",
        isSidebar ? "p-5 border-b border-zinc-100 shrink-0" : "mb-4"
      )}>
        <div className="flex-1 min-w-0">
          <div className={cn("flex items-center gap-2 mb-1", isSidebar && "flex-wrap")}>
            <h4 className={cn(
              "font-black text-brand-primary uppercase tracking-tight flex items-center gap-2",
              isSidebar ? "text-base" : "text-xl"
            )}>
              <FileText className={isSidebar ? "w-4 h-4 text-brand-primary shrink-0" : "w-5 h-5 text-brand-primary shrink-0"} strokeWidth={2.5} />
              <span className="truncate">Invoice {invoice.number}</span>
            </h4>
            <span className="px-2 py-0.5 bg-brand-primary/5 text-brand-primary rounded-md text-[10px] font-black uppercase tracking-widest border border-brand-primary/10 shrink-0">
              {invoice.district || 'No District'}
            </span>
          </div>
          {invoice.client && (
            <div className={cn("flex items-center gap-2 flex-wrap", isSidebar ? "mb-1" : "mb-0.5")}>
              <p className={cn(
                "font-black text-zinc-800 normal-case",
                isSidebar ? "text-sm" : "text-base"
              )}>
                {invoice.client}
              </p>
              {phone && (
                <button
                  type="button"
                  title={`View phone number for ${invoice.client}`}
                  onClick={() => setShowPhoneDialog(true)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-brand-primary/5 hover:bg-brand-primary/10 text-brand-primary rounded-md text-[10px] font-black tracking-tight border border-brand-primary/10 transition-colors shrink-0"
                >
                  <Phone className="w-3 h-3" />
                  {phone}
                </button>
              )}
            </div>
          )}
          <p className={cn(
            "font-bold text-zinc-400 uppercase tracking-widest leading-relaxed",
            isSidebar ? "text-[10px] flex flex-col gap-0.5" : "text-[11px] flex items-center gap-1.5"
          )}>
            <span>Delivery Address:</span>
            <span className="text-zinc-800 normal-case font-extrabold">{invoice.address}</span>
          </p>
        </div>
        <div className={cn("flex gap-2 shrink-0", isSidebar && "flex-col")}>
          {extraActions}
          <button
            title="View Invoice"
            onClick={onViewInvoice}
            className={cn(
              "flex items-center justify-center gap-2 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-sm group",
              isSidebar ? "px-3 py-2 text-[11px]" : "px-4 py-2 text-xs"
            )}
          >
            <Eye className="w-4 h-4" />
            {!isSidebar && 'View Invoice'}
            <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            title="Close Invoice Details"
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stock Items Section */}
      <div className={cn(
        isSidebar ? "bg-zinc-50 border-t border-zinc-100 p-5 flex-1 min-h-0 overflow-y-auto" : "bg-zinc-50 rounded-2xl border border-zinc-100 p-5"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white rounded-lg border border-zinc-100 shadow-sm">
              <Package className="w-3.5 h-3.5 text-brand-accent" />
            </div>
            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Stock Manifest</h5>
          </div>
          {invoice.lineItems && invoice.lineItems.length > 0 && (
            <span className="text-[9px] font-black text-zinc-400 bg-white px-2 py-1 rounded-md border border-zinc-200">
              {invoice.lineItems.length} ITEMS
            </span>
          )}
        </div>

        <div className={cn(isSidebar ? "flex flex-col gap-3" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3")}>
          {(!invoice.lineItems || invoice.lineItems.length === 0) ? (
            <div className="col-span-full py-8 text-center bg-white rounded-xl border border-dashed border-zinc-200">
              <Package className="w-6 h-6 text-zinc-200 mx-auto mb-2" />
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tight">No stock items found</p>
            </div>
          ) : (
            invoice.lineItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-zinc-100 shadow-sm group hover:border-brand-accent/30 transition-all">
                <div className="px-2 py-1 bg-brand-primary/5 rounded-lg font-mono text-[10px] font-black text-brand-primary border border-brand-primary/10 shrink-0">
                  {item.stockCode}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-zinc-800 truncate leading-tight group-hover:text-brand-primary transition-colors">{item.description}</p>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter mt-1">Qty: <span className="text-zinc-900">{item.qty}</span></p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showPhoneDialog && phone && (
        <SchoolPhoneDialog
          schoolName={invoice.client}
          phone={phone}
          onClose={() => setShowPhoneDialog(false)}
        />
      )}
    </div>
  );
}
