import type { Product } from '../hooks/useProducts';
import type { KnockdownItem } from '../../stock/hooks/useStock';

interface BuildableComponent {
  stockCode: string;
  qtyPerUnit: number;
}

function computeBuildableQty(components: BuildableComponent[], inventoryMap: Record<string, number>): number {
  let min = Infinity;
  for (const c of components) {
    if (!c.qtyPerUnit || c.qtyPerUnit <= 0) continue;
    const stock = inventoryMap[c.stockCode.toLowerCase().trim()] ?? 0;
    const buildable = Math.floor(stock / c.qtyPerUnit);
    if (buildable < min) min = buildable;
  }
  return min === Infinity ? 0 : min;
}

/**
 * Returns the number of units that can be assembled from stock, based on the
 * product's linked BOM components, or null if the product has no components
 * (i.e. it isn't a composite/knockdown product and callers should fall back
 * to the raw on-floor inventory qty instead).
 */
export function getProductBuildableQty(product: Product, inventoryMap: Record<string, number>): number | null {
  const components = product.components ?? [];
  if (components.length === 0) return null;
  return computeBuildableQty(components, inventoryMap);
}

/**
 * Same calculation as getProductBuildableQty, for knockdown items whose BOM
 * is stored as `parts` rather than `components`.
 */
export function getKnockdownBuildableQty(item: KnockdownItem, inventoryMap: Record<string, number>): number | null {
  const parts = item.parts ?? [];
  if (parts.length === 0) return null;
  return computeBuildableQty(parts.map(p => ({ stockCode: p.partCode, qtyPerUnit: p.qty })), inventoryMap);
}
