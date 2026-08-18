import { Boxes, PackagePlus, Eye, Zap } from 'lucide-react';
import { PhaseColumn } from './PhaseColumn';
import type { StockRow } from '../utils/phaseCalculations';

export function AvailableStockColumn({
  stockRows,
  totalAvailable,
  onAllocate,
  onViewProduct,
  onAutoBook
}: {
  stockRows: StockRow[];
  totalAvailable: number;
  onAllocate: (row: StockRow) => void;
  onViewProduct: (stockCode: string) => void;
  onAutoBook: () => void;
}) {
  return (
    <PhaseColumn
      index={1}
      title="Available Stock"
      subtitle="Available to allocate"
      icon={Boxes}
      accent="indigo"
      countLabel={`${totalAvailable.toLocaleString()} Available`}
      isEmpty={stockRows.length === 0}
      emptyTitle="No available stock"
      emptyDescription="No full products with recorded inventory yet — knockdown parts and consumables aren't listed here."
      headerAction={
        <button
          type="button"
          title="Auto-book stock against open orders"
          onClick={onAutoBook}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-black uppercase tracking-wide rounded-xl transition-all cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5" />
          Auto-Book Orders
        </button>
      }
    >
      {stockRows.map((row) => (
        <div key={row.stockCode} className="bg-zinc-50/50 border border-zinc-200 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="font-mono text-xs font-black uppercase bg-brand-accent/10 text-brand-accent px-2 py-0.5 rounded-lg border border-brand-accent/20">
                {row.stockCode}
              </span>
              <p className="text-sm font-bold text-brand-primary leading-snug mt-1.5 truncate" title={row.description}>
                {row.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-zinc-500">
              Available: <strong className={row.available > 0 ? 'text-emerald-600' : 'text-red-600'}>{row.available}</strong>
            </span>
            {row.reservedQty > 0 && (
              <span className="text-zinc-400">Reserved: <strong className="text-amber-600">{row.reservedQty}</strong></span>
            )}
          </div>

          <div className="flex items-center gap-1.5 pt-1 border-t border-zinc-150">
            <button
              type="button"
              title={`Allocate ${row.stockCode} to a school`}
              onClick={() => onAllocate(row)}
              disabled={row.available <= 0}
              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-brand-primary hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed text-white text-xs font-black uppercase rounded-lg transition-all cursor-pointer"
            >
              <PackagePlus className="w-3.5 h-3.5" />
              Allocate
            </button>
            <button
              type="button"
              title={`View product details for ${row.stockCode}`}
              onClick={() => onViewProduct(row.stockCode)}
              className="p-1.5 hover:bg-zinc-200 text-zinc-500 rounded-lg transition-all cursor-pointer border border-transparent hover:border-zinc-250"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </PhaseColumn>
  );
}
