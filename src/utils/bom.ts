import type { Product } from '../features/products/hooks/useProducts';
import type { KnockdownItem } from '../features/stock/hooks/useStock';

const MAX_DEPTH = 8;

function normalize(code: string): string {
  return String(code || '').trim().toLowerCase();
}

/**
 * Recursively walks a stock code's BOM (Product.components, then KnockdownItem.parts)
 * and returns the total qty to deduct per leaf/intermediate stock code, including the
 * root code itself. Write-side twin of computeBuildableQty in
 * features/products/utils/availability.ts, which does the equivalent single-level
 * read-only calculation for display.
 */
export function explodeStockDeduction(
  stockCode: string,
  qty: number,
  productsByCode: Map<string, Product>,
  knockdownByCode: Map<string, KnockdownItem>
): Map<string, number> {
  const result = new Map<string, number>();

  function walk(code: string, qtyForCode: number, visited: Set<string>, depth: number) {
    const normCode = normalize(code);
    if (!normCode || qtyForCode <= 0) return;

    result.set(normCode, (result.get(normCode) ?? 0) + qtyForCode);

    if (visited.has(normCode) || depth >= MAX_DEPTH) return;
    const nextVisited = new Set(visited).add(normCode);

    const product = productsByCode.get(normCode);
    if (product?.components?.length) {
      for (const component of product.components) {
        if (!component.qtyPerUnit || component.qtyPerUnit <= 0) continue;
        walk(component.stockCode, qtyForCode * component.qtyPerUnit, nextVisited, depth + 1);
      }
    }

    const knockdown = knockdownByCode.get(normCode);
    if (knockdown?.parts?.length) {
      for (const part of knockdown.parts) {
        if (!part.qty || part.qty <= 0) continue;
        walk(part.partCode, qtyForCode * part.qty, nextVisited, depth + 1);
      }
    }
  }

  walk(stockCode, qty, new Set(), 0);
  return result;
}
