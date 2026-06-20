import { Package, X } from 'lucide-react';
import { UIInvoice } from '../../invoices/hooks/useInvoices';

export function StockModal({ invoice, onClose }: { invoice: UIInvoice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-brand-primary/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl w-full max-w-xl relative z-10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
        <div className="px-8 py-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <h3 className="text-xl font-black text-brand-primary uppercase tracking-tight">Stock Manifest</h3>
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mt-1">
              {invoice.number} • {invoice.client}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100">
                <th className="pb-4 px-2">Code</th>
                <th className="pb-4 px-4">Description</th>
                <th className="pb-4 px-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {(!invoice.lineItems || invoice.lineItems.length === 0) ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-zinc-400 text-sm italic font-medium p-8">
                    <Package className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
                    No line items extracted for this invoice.
                  </td>
                </tr>
              ) : (
                invoice.lineItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="py-4 px-2 text-xs font-mono font-bold text-brand-primary">{item.stockCode}</td>
                    <td className="py-4 px-4 text-xs font-medium text-zinc-600">{item.description}</td>
                    <td className="py-4 px-2 text-xs font-black text-right tabular-nums bg-zinc-50 group-hover:bg-zinc-100 transition-colors w-20 rounded-lg">{item.qty}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-zinc-100 bg-zinc-50/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white border border-zinc-200 rounded-xl font-bold text-sm text-zinc-600 hover:bg-zinc-50 transition-all shadow-sm"
          >
            Close manifest
          </button>
        </div>
      </div>
    </div>
  );
}
