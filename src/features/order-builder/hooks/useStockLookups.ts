import { useMemo } from 'react';
import { useProducts } from '../../products/hooks/useProducts';
import { useStock } from '../../stock/hooks/useStock';

function stockCodeKey(code: string): string {
  return code.toLowerCase().trim();
}

// Merged Products+Knockdown lookups by stock code, keyed the same way stock-code
// lookups are keyed elsewhere in this app (lowercased, trimmed). Shared by
// BuildGroupingPanel (weight display/totals) and the Auto-Build flow (weight for
// capacity planning, unit price for the Rand-value stat) so both read from one
// definition rather than two independently-maintained merges.
export function useStockLookups() {
  const { products } = useProducts();
  const { stockItems } = useStock();

  const weightByStockCode = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      const key = stockCodeKey(p.stockCode);
      if (key && typeof p.weightKg === 'number') map[key] = p.weightKg;
    });
    stockItems.forEach(k => {
      const key = stockCodeKey(k.stockCode);
      if (key && typeof k.weightKg === 'number') map[key] = k.weightKg;
    });
    return map;
  }, [products, stockItems]);

  // KnockdownItem has no price field - only Products contribute here. A stock
  // code with no price on file contributes 0 to any value total, not an error.
  const unitPriceByStockCode = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach(p => {
      const key = stockCodeKey(p.stockCode);
      if (key && typeof p.unitPrice === 'number') map[key] = p.unitPrice;
    });
    return map;
  }, [products]);

  return { weightByStockCode, unitPriceByStockCode };
}
