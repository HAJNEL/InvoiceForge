import { formatCurrency } from '../../lib/utils';

export interface MobileLineItem {
  stockCode?: string;
  description?: string;
  qty?: number | string;
  unitPrice?: number | string;
  value?: number | string;
}

interface MobileLineItemRowProps {
  item: MobileLineItem;
  highlight?: boolean;
}

/**
 * One reusable row for the recurring Stock Code / Description / Qty / Unit
 * Price / Total shape (InvoiceDetail, TripForm, StockModal, ExtractionReview,
 * pushed invoice line-item views). Pure presentational, read-only.
 */
export function MobileLineItemRow({ item, highlight }: MobileLineItemRowProps) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'bg-amber-50/80 border-amber-200' : 'bg-zinc-50/50 border-zinc-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold text-brand-primary truncate">
            {item.stockCode || <span className="text-zinc-300 italic font-sans font-normal">None</span>}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {item.description || <span className="text-zinc-300 italic">No description</span>}
          </p>
        </div>
        <p className="font-mono text-sm font-black text-zinc-900 tabular-nums shrink-0">
          {formatCurrency(item.value)}
        </p>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
        <span>Qty {item.qty ?? 0}</span>
        <span>&times; {formatCurrency(item.unitPrice)}</span>
      </div>
    </div>
  );
}

/** Editable variant used by ExtractionReview where extracted values can be corrected. */
export function MobileLineItemEditRow({
  item,
  onChange,
  onRemove,
}: {
  item: MobileLineItem;
  onChange: (patch: Partial<MobileLineItem>) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Stock Code</span>
          <input
            type="text"
            value={item.stockCode || ''}
            onChange={(e) => onChange({ stockCode: e.target.value })}
            title="Stock code"
            className="w-full mt-1 px-2 py-1.5 text-xs font-mono border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
          />
        </label>
        <label className="block">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Qty</span>
          <input
            type="number"
            value={item.qty ?? ''}
            onChange={(e) => onChange({ qty: e.target.value })}
            title="Quantity"
            className="w-full mt-1 px-2 py-1.5 text-xs font-mono border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
          />
        </label>
      </div>
      <label className="block">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Description</span>
        <input
          type="text"
          value={item.description || ''}
          onChange={(e) => onChange({ description: e.target.value })}
          title="Description"
          className="w-full mt-1 px-2 py-1.5 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
        />
      </label>
      <div className="grid grid-cols-2 gap-2 items-end">
        <label className="block">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Unit Price</span>
          <input
            type="number"
            value={item.unitPrice ?? ''}
            onChange={(e) => onChange({ unitPrice: e.target.value })}
            title="Unit price"
            className="w-full mt-1 px-2 py-1.5 text-xs font-mono border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
          />
        </label>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove line item"
            className="justify-self-end px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-red-600 hover:bg-red-50 rounded-lg mobile-tap-target"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}
