import { useState } from 'react';
import { Loader2, X, FileText, FileCheck } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { UIInvoice } from '../../invoices/hooks/useInvoices';

export function DeliveredInvoicesModal({ invoices, onClose, onUpdateStatus }: {
  invoices: UIInvoice[];
  onClose: () => void;
  onUpdateStatus: (id: string, data: Partial<Record<string, unknown>>) => Promise<boolean>;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState<UIInvoice | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleMarkAsInvoiced = async (invoiceId: string) => {
    setUpdatingId(invoiceId);
    try {
      await onUpdateStatus(invoiceId, { status: 'invoiced' });
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(prev => prev ? { ...prev, status: 'invoiced' } : null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 text-zinc-900">
      <div className="absolute inset-0 bg-zinc-900/45 backdrop-blur-sm" onClick={onClose}></div>

      <div className={cn(
        "bg-white rounded-2xl w-full relative z-10 shadow-2xl overflow-hidden transition-all duration-300 flex flex-col max-h-[85vh] md:flex-row",
        selectedInvoice ? "max-w-4xl" : "max-w-xl"
      )}>
        {/* Left Side: Invoice List */}
        <div className={cn("flex flex-col flex-1 border-r border-zinc-100 max-h-[85vh]", selectedInvoice ? "md:max-w-md" : "w-full")}>
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
            <div>
              <h2 className="text-lg font-bold">Delivered Invoices</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">In Completed Status ({invoices.length})</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {invoices.length === 0 ? (
              <div className="py-12 text-center">
                <FileCheck className="w-12 h-12 text-zinc-200 mx-auto mb-4" />
                <p className="text-zinc-500 font-bold uppercase tracking-wide text-xs">No Completed Invoices</p>
                <p className="text-zinc-400 text-[10px] mt-1">When trip deliveries are finalized, invoices appear here.</p>
              </div>
            ) : (
              invoices.map((inv) => (
                <div
                  key={inv.id}
                  className={cn(
                    "p-4 border rounded-xl transition-all flex flex-col gap-3 relative overflow-hidden group",
                    selectedInvoice?.id === inv.id
                      ? "border-brand-primary bg-brand-primary/5 shadow-sm"
                      : "border-zinc-100 hover:border-zinc-200 bg-white"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="cursor-pointer flex-1"
                      onClick={() => setSelectedInvoice(inv.id === selectedInvoice?.id ? null : inv)}
                    >
                      <p className="text-sm font-black text-zinc-900 flex items-center gap-1.5 hover:text-brand-primary">
                        {inv.number}
                        <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold tracking-widest uppercase rounded">
                          {inv.status}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">{inv.client}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs font-black text-zinc-800">R {inv.amount.toLocaleString()}</span>
                        <span className="text-[10px] text-zinc-400">{inv.date}</span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 justify-center">
                      <button
                        onClick={() => setSelectedInvoice(inv.id === selectedInvoice?.id ? null : inv)}
                        className="px-2.5 py-1 text-[10px] font-bold border border-zinc-200 rounded-lg bg-zinc-50 hover:bg-zinc-100 transition-all flex items-center gap-1 self-end"
                        title="View Info"
                      >
                        <FileText className="w-3 h-3 text-zinc-500" />
                        Info
                      </button>
                      <button
                        onClick={() => handleMarkAsInvoiced(inv.id)}
                        disabled={updatingId === inv.id}
                        className="px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
                      >
                        {updatingId === inv.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileCheck className="w-3.5 h-3.5" />
                        )}
                        Invoice
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Invoice Detail Pane */}
        {selectedInvoice && (
          <div className="flex-1 flex flex-col max-h-[85vh] bg-zinc-50/50 w-full md:w-[480px] animate-in slide-in-from-right duration-250">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="font-bold text-sm">Invoice Information</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5 font-mono">{selectedInvoice.number}</p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 hover:bg-zinc-250 rounded text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Client and Metadata Info */}
              <div className="bg-white border border-zinc-100 p-4 rounded-xl space-y-3 shadow-inner">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">School / Client Name</span>
                  <p className="text-sm font-bold text-zinc-800">{selectedInvoice.client}</p>
                </div>
                {selectedInvoice.clientEmail && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Client Email</span>
                    <p className="text-xs text-zinc-650 font-mono">{selectedInvoice.clientEmail}</p>
                  </div>
                )}
                {selectedInvoice.district && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Delivery District</span>
                    <p className="text-xs text-zinc-650 font-bold">{selectedInvoice.district}</p>
                  </div>
                )}
                {(selectedInvoice.deliveryAddressLine1 || selectedInvoice.deliveryAddressLine2) && (
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Delivery Address</span>
                    <p className="text-xs text-zinc-650 leading-relaxed">
                      {selectedInvoice.deliveryAddressLine1} {selectedInvoice.deliveryAddressLine2}
                    </p>
                  </div>
                )}
              </div>

              {/* Financials Summary */}
              <div className="bg-white border border-zinc-100 p-4 rounded-xl space-y-3.5 shadow-inner">
                <div className="flex justify-between items-center pb-2.5 border-b border-zinc-100">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Invoice Subtotal</span>
                  <span className="text-sm font-black text-zinc-900">R {selectedInvoice.amount.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#a0aec0]">Invoice Issue Date</span>
                  <p className="text-xs text-zinc-700">{selectedInvoice.date}</p>
                </div>
              </div>

              {/* Line Items checklist */}
              {selectedInvoice.lineItems && selectedInvoice.lineItems.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Product Line Items</h4>
                  <div className="bg-white border border-zinc-100 rounded-xl divide-y divide-zinc-50 overflow-hidden">
                    {selectedInvoice.lineItems.map((item, idx) => (
                      <div key={idx} className="p-3 flex justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-zinc-800">{item.description}</p>
                          <span className="text-[10px] font-mono text-zinc-400">Code: {item.stockCode || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-zinc-850">Qty: {item.qty}</p>
                          <p className="text-[10px] text-zinc-400 font-mono">Value: R {item.value?.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex items-center justify-between gap-4">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-100 text-zinc-600"
              >
                Clear Selection
              </button>
              {selectedInvoice.status.toLowerCase() !== 'invoiced' && (
                <button
                  onClick={() => handleMarkAsInvoiced(selectedInvoice.id)}
                  disabled={updatingId === selectedInvoice.id}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                >
                  {updatingId === selectedInvoice.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileCheck className="w-3.5 h-3.5" />
                  )}
                  Mark Invoiced
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
