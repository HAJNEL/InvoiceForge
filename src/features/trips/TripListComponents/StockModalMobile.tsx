import { Package } from 'lucide-react';
import { UIInvoice } from '../../invoices/hooks/useInvoices';
import { MobileSheet } from '../../../components/mobile/MobileSheet';

// StockModal only ever shows Code / Description / Qty (no unitPrice/value), so this
// renders a lighter-weight row rather than the full MobileLineItemRow shape.
export function StockModalMobile({ invoice, onClose }: { invoice: UIInvoice; onClose: () => void }) {
  return (
    <MobileSheet
      isOpen={true}
      onClose={onClose}
      title="Stock Manifest"
      subtitle={`${invoice.number} • ${invoice.client}`}
      fullHeight={false}
    >
      {(!invoice.lineItems || invoice.lineItems.length === 0) ? (
        <div className="py-12 text-center text-zinc-400 text-sm italic font-medium">
          <Package className="w-8 h-8 text-zinc-200 mx-auto mb-3" />
          No line items extracted for this invoice.
        </div>
      ) : (
        <div className="space-y-2.5">
          {invoice.lineItems.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold text-brand-primary truncate">
                    {item.stockCode || <span className="text-zinc-300 italic font-sans font-normal">None</span>}
                  </p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    {item.description || <span className="text-zinc-300 italic">No description</span>}
                  </p>
                </div>
                <span className="text-xs font-black text-right bg-zinc-100 text-zinc-800 px-2 py-1 rounded font-mono tabular-nums shrink-0">
                  Qty: {item.qty}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </MobileSheet>
  );
}
