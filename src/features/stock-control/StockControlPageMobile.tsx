import { useState } from 'react';
import { Boxes, ClipboardList, Hammer, PackageCheck, RefreshCw, PackageSearch, Plus, Search, RotateCcw, Truck, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { useStockControl } from './hooks/useStockControl';
import type { StockControlFilterState } from './components/PhaseFilters';
import { PhaseKpiBar } from './components/PhaseKpiBar';
import { PhaseProgressBar } from './components/PhaseColumn';
import type { OrderRow, StockRow } from './utils/phaseCalculations';

type Phase = 'stock' | 'booked' | 'assembly' | 'ready';

const TABS: { id: Phase; label: string; icon: typeof Boxes }[] = [
  { id: 'stock', label: 'Stock', icon: Boxes },
  { id: 'booked', label: 'Booked', icon: ClipboardList },
  { id: 'assembly', label: 'Assembly', icon: Hammer },
  { id: 'ready', label: 'Ready', icon: PackageCheck }
];

export default function StockControlPageMobile({
  stockControl,
  filters,
  setFilters,
  bookedOrders,
  assemblyOrders,
  readyOrders,
  filteredStockRows,
  onSyncFromStock,
  onSyncFromOrders,
  syncingOrders,
  onAddManualBooking,
  onAllocate,
  onOpenAssembly,
  onOpenOrder,
  onViewProduct,
  onAddToTrip,
  onRevert,
  onAutoBook
}: {
  stockControl: ReturnType<typeof useStockControl>;
  filters: StockControlFilterState;
  setFilters: (next: StockControlFilterState) => void;
  bookedOrders: OrderRow[];
  assemblyOrders: OrderRow[];
  readyOrders: OrderRow[];
  filteredStockRows: StockRow[];
  onSyncFromStock: () => void;
  onSyncFromOrders: () => void;
  syncingOrders: boolean;
  onAddManualBooking: () => void;
  onAllocate: (row: StockRow) => void;
  onOpenAssembly: (order: OrderRow) => void;
  onOpenOrder: (order: OrderRow) => void;
  onViewProduct: (stockCode: string) => void;
  onAddToTrip: (order: OrderRow) => void;
  onRevert: (order: OrderRow) => void;
  onAutoBook: () => void;
}) {
  const [tab, setTab] = useState<Phase>('stock');

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-black uppercase tracking-wider text-brand-primary">Product Phases</h1>
        <p className="text-[11px] text-zinc-500 font-mono">Track your build progress in real-time.</p>
      </div>

      <div className="flex gap-2">
        <button type="button" title="Refresh live stock calculations" onClick={onSyncFromStock}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-zinc-200 rounded-xl text-[9px] font-black uppercase text-zinc-700">
          <RefreshCw className="w-3 h-3" /> Sync Stock
        </button>
        <button type="button" title="Scan orders for missing SKUs" onClick={onSyncFromOrders} disabled={syncingOrders}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-white border border-zinc-200 rounded-xl text-[9px] font-black uppercase text-zinc-700 disabled:opacity-50">
          <PackageSearch className="w-3 h-3" /> {syncingOrders ? 'Syncing…' : 'Sync Orders'}
        </button>
        <button type="button" title="Add a manual booking" onClick={onAddManualBooking}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 bg-brand-primary text-white rounded-xl text-[9px] font-black uppercase">
          <Plus className="w-3 h-3" /> Booking
        </button>
      </div>

      <PhaseKpiBar kpis={stockControl.kpis} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          title="Search products, SKUs, schools, order numbers…"
          placeholder="Search products, SKUs, schools…"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-full pl-9 pr-3 py-2.5 bg-white border border-zinc-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-accent/20"
        />
      </div>

      {stockControl.shortStockOrders.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 font-semibold">
          {stockControl.shortStockOrders.reduce((s, o) => s + o.shortUnits, 0)} units short across {stockControl.shortStockOrders.length} order{stockControl.shortStockOrders.length === 1 ? '' : 's'}.
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto scroller-hide">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = id === 'stock' ? filteredStockRows.length
            : id === 'booked' ? bookedOrders.length
            : id === 'assembly' ? assemblyOrders.length
            : readyOrders.length;
          const isActive = tab === id;
          return (
            <button
              key={id}
              type="button"
              title={`Show ${label}`}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wide shrink-0 transition-all',
                isActive ? 'bg-brand-primary text-white' : 'bg-white border border-zinc-200 text-zinc-600'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              <span className={cn('px-1.5 py-0.5 rounded-md text-[9px]', isActive ? 'bg-white/20' : 'bg-zinc-100')}>{count}</span>
            </button>
          );
        })}
      </div>

      {stockControl.loading ? (
        <div className="py-16 flex flex-col items-center justify-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary" />
          <p className="text-[11px] text-zinc-500 font-mono uppercase">Loading production workflow…</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {tab === 'stock' && (
            filteredStockRows.length === 0 ? (
              <EmptyState label="No available stock." />
            ) : <>
              <button type="button" title="Auto-book stock against open orders" onClick={onAutoBook}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-accent text-white text-xs font-black uppercase tracking-wide rounded-xl mobile-tap-target">
                <Zap className="w-3.5 h-3.5" /> Auto-Book Orders
              </button>
              {filteredStockRows.map(row => (
                <div key={row.stockCode} className="bg-white border border-zinc-200 rounded-2xl p-3.5 space-y-2">
                  <span className="font-mono text-[10px] font-black uppercase bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded-lg">{row.stockCode}</span>
                  <p className="text-xs font-bold text-brand-primary truncate">{row.description}</p>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span>Available: <strong className="text-emerald-600">{row.available}</strong></span>
                    <div className="flex gap-1.5">
                      <button type="button" title="Allocate" onClick={() => onAllocate(row)} disabled={row.available <= 0}
                        className="px-2.5 py-1 bg-brand-primary disabled:bg-zinc-200 text-white text-[9px] font-black uppercase rounded-lg">Allocate</button>
                      <button type="button" title="View product" onClick={() => onViewProduct(row.stockCode)}
                        className="px-2.5 py-1 bg-zinc-100 text-zinc-600 text-[9px] font-black uppercase rounded-lg">View</button>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'booked' && (
            bookedOrders.length === 0 ? (
              <EmptyState label="No booked orders." />
            ) : bookedOrders.map(order => (
              <div key={order.invoiceId} className="bg-white border border-zinc-200 rounded-2xl p-3.5 space-y-2">
                <button type="button" title={`Open ${order.schoolName}`} onClick={() => onOpenOrder(order)} className="w-full text-left space-y-2">
                  <p className="text-xs font-black text-brand-primary uppercase truncate">{order.schoolName}</p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>{order.orderNumber}</span>
                    <span className="font-black text-brand-primary">{order.totalAssembled} / {order.totalOrdered} ({order.progressPct}%)</span>
                  </div>
                  <PhaseProgressBar pct={order.progressPct} accent="amber" />
                </button>
                <div className="flex items-center gap-1.5">
                  <button type="button" title={`Start assembly for ${order.schoolName}`} onClick={() => onOpenAssembly(order)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-sky-600 text-white text-[10px] font-black uppercase rounded-lg">
                    <Hammer className="w-3.5 h-3.5" /> Build
                  </button>
                  <button type="button" title={`Revert ${order.schoolName} back to Available Stock`} onClick={() => onRevert(order)}
                    className="px-2.5 py-1.5 bg-zinc-100 text-zinc-500 rounded-lg shrink-0">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}

          {tab === 'assembly' && (
            assemblyOrders.length === 0 ? (
              <EmptyState label="No orders are currently being assembled." />
            ) : assemblyOrders.map(order => (
              <div key={order.invoiceId} className="bg-white border border-zinc-200 rounded-2xl p-3.5 space-y-2">
                <button type="button" title={`Open assembly for ${order.schoolName}`} onClick={() => onOpenAssembly(order)} className="w-full text-left space-y-2">
                  <p className="text-xs font-black text-brand-primary uppercase truncate">{order.schoolName}</p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>{order.totalAssembled} / {order.totalOrdered}</span>
                    <span className="font-black text-sky-600">{order.progressPct}%</span>
                  </div>
                  <PhaseProgressBar pct={order.progressPct} accent="sky" />
                </button>
                <button type="button" title={`Revert ${order.schoolName} back to Available Stock`} onClick={() => onRevert(order)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase rounded-lg">
                  <RotateCcw className="w-3.5 h-3.5" /> Revert to Stock
                </button>
              </div>
            ))
          )}

          {tab === 'ready' && (
            readyOrders.length === 0 ? (
              <EmptyState label="Orders will appear here once fully assembled." />
            ) : readyOrders.map(order => (
              <div key={order.invoiceId} className="bg-emerald-50/40 border border-emerald-150 rounded-2xl p-3.5 space-y-2">
                <button type="button" title={`Open ${order.schoolName}`} onClick={() => onOpenOrder(order)} className="w-full text-left">
                  <p className="text-xs font-black text-brand-primary uppercase truncate">{order.schoolName}</p>
                  <p className="text-[10px] font-mono text-zinc-500">{order.orderNumber} &middot; {order.totalOrdered} units</p>
                </button>
                <div className="flex items-center gap-1.5">
                  <button type="button" title="Add to trip" onClick={() => onAddToTrip(order)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg">
                    <Truck className="w-3.5 h-3.5" /> Add to Trip
                  </button>
                  <button type="button" title={`Revert ${order.schoolName} back to Available Stock`} onClick={() => onRevert(order)}
                    className="px-2.5 py-1.5 bg-white border border-emerald-200 text-emerald-700 rounded-lg shrink-0">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-14 bg-white border border-zinc-200 rounded-2xl text-center text-zinc-400 text-xs px-6">
      {label}
    </div>
  );
}
