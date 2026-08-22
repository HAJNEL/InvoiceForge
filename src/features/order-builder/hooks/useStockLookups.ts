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
    // Only ever write a POSITIVE weight into the map - weightKg defaults to 0 on
    // any Product/KnockdownItem that's never had one set (see the weight-field
    // feature), so a plain last-write-wins merge would let an unset knockdown
    // entry silently zero out a real weight from a product sharing the same
    // stock code (or vice versa) whenever both catalogs happen to use the same
    // code. A 0/unset source is simply skipped rather than overwriting whatever
    // positive value, if any, was already found for that code.
    products.forEach(p => {
      const key = stockCodeKey(p.stockCode);
      if (key && typeof p.weightKg === 'number' && p.weightKg > 0) map[key] = p.weightKg;
    });
    stockItems.forEach(k => {
      const key = stockCodeKey(k.stockCode);
      if (key && typeof k.weightKg === 'number' && k.weightKg > 0) map[key] = k.weightKg;
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
