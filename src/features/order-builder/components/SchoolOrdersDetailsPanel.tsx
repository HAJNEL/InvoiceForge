import { School, X, Eye, ExternalLink, Edit2, MapPinOff, Package } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { Order } from '../../orders/hooks/useOrders';
import type { OrderLocationIssue } from '../../orders/hooks/useOrderLocationIssues';
import { useStockLookups } from '../hooks/useStockLookups';

// Shown when a school pin is clicked on the overview map - lists that school's
// orders, both below the standard map (as a horizontal card) and inside the
// fullscreen map's left sidebar (as a vertical panel). Modeled on Trip's
// InvoiceDetailsPanel (variant: 'card' | 'sidebar'), including its per-item
// "Stock Manifest" readout (stock code + description + qty) rather than just
// a SKU/unit count summary.
export function SchoolOrdersDetailsPanel({
  schoolName,
  orders,
  locationIssueByOrderId,
  variant = 'card',
  onClose,
  onViewInOrders,
  onEditOrder
}: {
  schoolName: string;
  orders: Order[];
  locationIssueByOrderId: Map<string, OrderLocationIssue>;
  variant?: 'card' | 'sidebar';
  onClose: () => void;
  onViewInOrders: () => void;
  onEditOrder?: (order: Order) => void;
}) {
  const isSidebar = variant === 'sidebar';
  const totalUnits = (o: Order) => o.lineItems.reduce((s, l) => s + l.qty, 0);
  const { descriptionByStockCode } = useStockLookups();

  return (
    <div className={cn(
      isSidebar
        ? 'flex flex-col h-full'
        : 'bg-white p-6 rounded-2xl shadow-xl border border-zinc-200 z-10 animate-in slide-in-from-top-4 duration-300 ring-4 ring-brand-primary/5'
    )}>
      <div className={cn(
        'flex justify-between items-start',
        isSidebar ? 'p-5 border-b border-zinc-100 shrink-0' : 'mb-4'
      )}>
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            'font-black text-brand-primary uppercase tracking-tight flex items-center gap-2',
            isSidebar ? 'text-base' : 'text-xl'
          )}>
            <School className={isSidebar ? 'w-4 h-4 text-brand-primary shrink-0' : 'w-5 h-5 text-brand-primary shrink-0'} strokeWidth={2.5} />
            <span className="truncate">{schoolName}</span>
          </h4>
          <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
            {orders.length} order{orders.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className={cn('flex gap-2 shrink-0', isSidebar && 'flex-col')}>
          <button
            type="button"
            title="View in Orders"
            onClick={onViewInOrders}
            className={cn(
              'flex items-center justify-center gap-2 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-sm group',
              isSidebar ? 'px-3 py-2 text-[11px]' : 'px-4 py-2 text-xs'
            )}
          >
            <Eye className="w-4 h-4" />
            {!isSidebar && 'View in Orders'}
            <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
          </button>
          <button
            type="button"
            title="Close school details"
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 rounded-xl text-zinc-400 transition-all border border-transparent hover:border-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className={cn(
        isSidebar ? 'bg-zinc-50 border-t border-zinc-100 p-5 flex-1 min-h-0 overflow-y-auto' : 'bg-zinc-50 rounded-2xl border border-zinc-100 p-5'
      )}>
        {/* Always a single column now - each order card carries a full stock
            manifest grid of its own, so a 2-up order layout would squeeze
            that inner grid down to the point it can't lay out like the
            Invoice card's stock manifest anymore. */}
        <div className="flex flex-col gap-3">
          {orders.map((o) => {
            const issue = locationIssueByOrderId.get(o.id);
            return (
              <div key={o.id} className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-bold text-zinc-800 truncate">{o.orderNumber || '—'}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide',
                        o.status === 'Complete' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {o.status}
                      </span>
                      <span className="text-[10px] text-zinc-400 truncate">{o.area || '—'}</span>
                      {issue && (
                        <span title={`School geocodes ~${Math.round(issue.distanceKm)}km from "${o.area}"`}>
                          <MapPinOff className="w-3 h-3 text-red-500 shrink-0" />
                        </span>
                      )}
                    </div>
                  </div>
                  {onEditOrder && (
                    <button
                      type="button"
                      title="Edit order"
                      onClick={() => onEditOrder(o)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors shrink-0"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-brand-accent" />
                      <h5 className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-400">Stock Manifest</h5>
                    </div>
                    <span className="text-[9px] font-black text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded-md border border-zinc-100">
                      {o.lineItems.length} SKU{o.lineItems.length === 1 ? '' : 's'} · {totalUnits(o)} units
                    </span>
                  </div>
                  {o.lineItems.length === 0 ? (
                    <p className="text-[10px] text-zinc-400 italic">No line items.</p>
                  ) : (
                    <div className={cn(isSidebar ? 'flex flex-col gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2')}>
                      {o.lineItems.map((item, idx) => {
                        const description = descriptionByStockCode[item.stockCode.toLowerCase().trim()];
                        return (
                          <div key={idx} className="flex items-center gap-2 bg-zinc-50 p-2 rounded-lg border border-zinc-100 group hover:border-brand-accent/30 transition-all">
                            <div className="px-1.5 py-0.5 bg-brand-primary/5 rounded-md font-mono text-[9px] font-black text-brand-primary border border-brand-primary/10 shrink-0">
                              {item.stockCode || '—'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-zinc-800 truncate leading-tight group-hover:text-brand-primary transition-colors">{description || '—'}</p>
                              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-tighter mt-0.5">Qty: <span className="text-zinc-900">{item.qty}</span></p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
