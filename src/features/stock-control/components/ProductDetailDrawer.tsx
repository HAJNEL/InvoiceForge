import { useMemo } from 'react';
import { Package, Layers, ShoppingBag } from 'lucide-react';
import { PhaseDrawer } from './PhaseDrawer';
import type { OrderRow, StockRow } from '../utils/phaseCalculations';
import { normalize } from '../utils/phaseCalculations';
import type { Product } from '../../products/hooks/useProducts';
import type { KnockdownItem } from '../../stock/hooks/useStock';

const BOM_TYPE_CONFIG = {
  knockdown: {
    label: 'Knockdown Parts',
    icon: Layers,
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    iconClass: 'text-purple-500',
  },
  consumable: {
    label: 'Consumables',
    icon: ShoppingBag,
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    iconClass: 'text-amber-500',
  },
} as const;

export function ProductDetailDrawer({
  stockCode,
  stockRows,
  productsByCode,
  knockdownByCode,
  orderRows,
  onClose
}: {
  stockCode: string | null;
  stockRows: StockRow[];
  productsByCode: Map<string, Product>;
  knockdownByCode: Map<string, KnockdownItem>;
  orderRows: OrderRow[];
  onClose: () => void;
}) {
  const codeKey = stockCode ? normalize(stockCode) : '';

  const stockRow = useMemo(
    () => stockRows.find(r => normalize(r.stockCode) === codeKey) || null,
    [stockRows, codeKey]
  );

  const product = productsByCode.get(codeKey);
  const knockdown = knockdownByCode.get(codeKey);
  const description = stockRow?.description || product?.description || knockdown?.displayName || knockdown?.description || stockCode || '';

  const { inAssembly, ready, allocatedOrders } = useMemo(() => {
    let inAssembly = 0;
    let ready = 0;
    const allocated: { schoolName: string; orderNumber: string; qty: number }[] = [];

    for (const order of orderRows) {
      const line = order.lines.find(l => normalize(l.stockCode) === codeKey);
      if (!line) continue;
      if (order.isReady) ready += line.assembled;
      else inAssembly += line.assembled;
      if (line.reserved > 0) {
        allocated.push({ schoolName: order.schoolName, orderNumber: order.orderNumber, qty: line.reserved });
      }
    }
    allocated.sort((a, b) => b.qty - a.qty);
    return { inAssembly, ready, allocatedOrders: allocated };
  }, [orderRows, codeKey]);

  // Bill of materials: components directly linked to this product's BOM (spec §34's
  // "knockdown and consumables linked" to a product), plus — when this stock code is
  // itself a knockdown item — its own sub-parts breakdown.
  const knockdownComponents = product?.components?.filter(c => c.type === 'knockdown') ?? [];
  const consumableComponents = product?.components?.filter(c => c.type === 'consumable') ?? [];
  const knockdownParts = knockdown?.parts ?? [];

  if (!stockCode) return null;

  return (
    <PhaseDrawer
      open={!!stockCode}
      onClose={onClose}
      title={description}
      subtitle={stockCode}
      icon={Package}
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 text-center">
          <p className="text-sm font-black text-brand-primary">{stockRow?.onHandQty ?? 0}</p>
          <p className="text-[9px] font-black uppercase text-zinc-400">Current Stock</p>
        </div>
        <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 text-center">
          <p className="text-sm font-black text-amber-600">{stockRow?.reservedQty ?? 0}</p>
          <p className="text-[9px] font-black uppercase text-zinc-400">Reserved</p>
        </div>
        <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 text-center">
          <p className="text-sm font-black text-emerald-600">{stockRow?.available ?? 0}</p>
          <p className="text-[9px] font-black uppercase text-zinc-400">Available</p>
        </div>
        <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 text-center">
          <p className="text-sm font-black text-sky-600">{inAssembly}</p>
          <p className="text-[9px] font-black uppercase text-zinc-400">In Assembly</p>
        </div>
        <div className="bg-zinc-50 border border-zinc-150 rounded-xl p-3 text-center col-span-2">
          <p className="text-sm font-black text-emerald-600">{ready}</p>
          <p className="text-[9px] font-black uppercase text-zinc-400">Ready</p>
        </div>
      </div>

      {(knockdownComponents.length > 0 || consumableComponents.length > 0 || knockdownParts.length > 0) && (
        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase text-zinc-500 tracking-wide">Bill of Materials</p>

          {(['knockdown', 'consumable'] as const).map(type => {
            const items = type === 'knockdown' ? knockdownComponents : consumableComponents;
            if (items.length === 0) return null;
            const cfg = BOM_TYPE_CONFIG[type];
            const Icon = cfg.icon;
            return (
              <div key={type} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${cfg.iconClass}`} />
                  <span className="text-[10px] font-black uppercase text-zinc-600 tracking-wide">{cfg.label}</span>
                </div>
                {items.map((c, i) => (
                  <div key={`${c.stockCode}-${i}`} className="flex items-center justify-between bg-white border border-zinc-150 rounded-xl px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-brand-primary truncate">{c.description || c.stockCode}</p>
                      <span className={`inline-block mt-0.5 font-mono text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${cfg.badgeClass}`}>
                        {c.stockCode}
                      </span>
                    </div>
                    <span className="font-mono font-black text-zinc-700 shrink-0">×{c.qtyPerUnit}</span>
                  </div>
                ))}
              </div>
            );
          })}

          {knockdownParts.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-500" />
                <span className="text-[10px] font-black uppercase text-zinc-600 tracking-wide">Component Parts</span>
              </div>
              {knockdownParts.map((p, i) => (
                <div key={`${p.partCode}-${i}`} className="flex items-center justify-between bg-white border border-zinc-150 rounded-xl px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-brand-primary truncate">{p.description || p.partCode}</p>
                    <span className="inline-block mt-0.5 font-mono text-[9px] font-black uppercase px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200">
                      {p.partCode}
                    </span>
                  </div>
                  <span className="font-mono font-black text-zinc-700 shrink-0">×{p.qty}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase text-zinc-500 tracking-wide">Allocated Orders</p>
        {allocatedOrders.length === 0 ? (
          <p className="text-[11px] text-zinc-400 py-3">No school currently has this item reserved.</p>
        ) : (
          <div className="space-y-1.5">
            {allocatedOrders.map((a, i) => (
              <div key={`${a.orderNumber}-${i}`} className="flex items-center justify-between bg-zinc-50 border border-zinc-150 rounded-xl px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-bold text-brand-primary truncate">{a.schoolName}</p>
                  <p className="text-[9px] font-mono text-zinc-400">{a.orderNumber}</p>
                </div>
                <span className="font-mono font-black text-zinc-700 shrink-0">{a.qty}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </PhaseDrawer>
  );
}
