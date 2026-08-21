import type { UIInvoice } from '../../invoices/hooks/useInvoices';
import type { StockAllocation } from '../hooks/useAllocations';
import type { AssemblyLog } from '../hooks/useAssemblyLogs';
import type { InventoryRow } from '../hooks/useInventoryItems';
import type { Product } from '../../products/hooks/useProducts';
import type { Order as SchoolOrder } from '../../orders/hooks/useOrders';
import { getProductBuildableQty } from '../../products/utils/availability';

export interface OrderLineRow {
  stockCode: string;
  description: string;
  ordered: number;
  reserved: number;
  assembled: number;
  remaining: number;
  progressPct: number;
  isShort: boolean;
  shortBy: number;
}

export interface OrderRow {
  invoiceId: string;
  // Which collection this row was derived from — 'invoice' rows back onto a real
  // tax invoice directly (invoiceId is that invoice's own id), 'order' rows back
  // onto the standalone Orders-collection import and have no matching invoice
  // document (invoiceId is the orders/{id} doc instead). LinkInvoiceModal uses
  // this to decide whether "Add to Trip" already has the real invoice in hand or
  // still needs to look one up by Customer P/O before a trip can reference it.
  source: 'invoice' | 'order';
  orderNumber: string;
  schoolName: string;
  area: string;
  schoolType: string;
  clientNumber: string;
  status: string;
  priority: 'normal' | 'high' | 'urgent';
  dueDate: string;
  lines: OrderLineRow[];
  totalOrdered: number;
  totalReserved: number;
  totalAssembled: number;
  totalRemaining: number;
  progressPct: number;
  isReady: boolean;
  isShortStock: boolean;
  shortUnits: number;
  // Timestamp of the most recent assembly-log entry for this order, i.e. when it
  // most recently progressed — used as the "Ready" date once isReady is true.
  lastAssemblyAt: string | null;
}

export interface PhaseKpis {
  knockdownAvailable: number;
  reservedToSchools: number;
  reservedSchoolCount: number;
  inAssembly: number;
  assemblyJobCount: number;
  readyForDelivery: number;
  readySchoolCount: number;
  overallProgressPct: number;
  totalAssembled: number;
  totalOrdered: number;
}

export function normalize(code: string): string {
  return String(code || '').trim().toLowerCase();
}

/**
 * Groups an invoice's line items by stock code, skipping blank codes and
 * zero/blank quantities (spec §25 — a blank SKU cell means "no quantity ordered",
 * never an active order line). Mirrors the same rule already applied in
 * StockScreen.tsx's invoiceStockAnalyses and src/utils/inventory.ts's deduction path.
 */
function groupOrderedQty(invoice: UIInvoice): Map<string, { code: string; description: string; qty: number }> {
  const map = new Map<string, { code: string; description: string; qty: number }>();
  for (const item of invoice.lineItems || []) {
    const code = (item.stockCode || '').trim();
    const qty = Number(item.qty) || 0;
    if (!code || qty <= 0) continue;
    const key = normalize(code);
    const existing = map.get(key);
    if (existing) {
      existing.qty += qty;
    } else {
      map.set(key, { code, description: item.description || '', qty });
    }
  }
  return map;
}

/**
 * Groups a school order's line items by stock code the same way groupOrderedQty
 * does for invoices — the Orders collection has already dropped blank/zero-qty
 * rows at import time, but stockCode still needs de-duplicating and normalizing.
 * The Orders collection never carries a description, unlike invoice line items.
 */
function groupOrderedQtyFromOrder(order: SchoolOrder): Map<string, { code: string; description: string; qty: number }> {
  const map = new Map<string, { code: string; description: string; qty: number }>();
  for (const item of order.lineItems || []) {
    const code = (item.stockCode || '').trim();
    const qty = Number(item.qty) || 0;
    if (!code || qty <= 0) continue;
    const key = normalize(code);
    const existing = map.get(key);
    if (existing) {
      existing.qty += qty;
    } else {
      map.set(key, { code, description: '', qty });
    }
  }
  return map;
}

/** Ordered/reserved/assembled/remaining/progress for one order's SKU lines, shared by both invoice- and Orders-collection-derived rows. */
function buildLines(
  orderedMap: Map<string, { code: string; description: string; qty: number }>,
  reservedMap: Map<string, number>,
  assembledMap: Map<string, number>
): { lines: OrderLineRow[]; totalOrdered: number; totalReserved: number; totalAssembled: number; shortUnits: number } {
  const lines: OrderLineRow[] = [];
  let totalOrdered = 0, totalReserved = 0, totalAssembled = 0, shortUnits = 0;

  for (const [codeKey, { code, description, qty: ordered }] of orderedMap) {
    const reserved = Math.min(reservedMap.get(codeKey) || 0, ordered);
    const assembled = Math.min(assembledMap.get(codeKey) || 0, reserved);
    const remaining = Math.max(0, ordered - assembled);
    const progressPct = ordered > 0 ? Math.round((assembled / ordered) * 100) : 0;
    const shortBy = Math.max(0, ordered - reserved);

    lines.push({
      stockCode: code,
      description,
      ordered,
      reserved,
      assembled,
      remaining,
      progressPct,
      isShort: shortBy > 0,
      shortBy
    });

    totalOrdered += ordered;
    totalReserved += reserved;
    totalAssembled += assembled;
    shortUnits += shortBy;
  }

  lines.sort((a, b) => a.stockCode.localeCompare(b.stockCode));
  return { lines, totalOrdered, totalReserved, totalAssembled, shortUnits };
}

/**
 * Every Customer P/O whose invoice already sits on some trip's `invoiceIds` —
 * the single source of truth for "this order has moved on to delivery,"
 * independent of any stored status flag. `invoiceIdsOnTrips` should be the
 * union of every trip's `invoiceIds` (see useStockControl). Shared by
 * buildOrderRows (to hide the row) and useStockControl's reconciliation effect
 * (to write the matching Orders-collection status back to Complete) so both
 * always agree on which orders count as "on a trip."
 */
export function computeOrderNumbersOnTrip(invoices: UIInvoice[], invoiceIdsOnTrips: Set<string>): Set<string> {
  const set = new Set<string>();
  for (const inv of invoices) {
    if (inv.orderNumber && invoiceIdsOnTrips.has(inv.id)) set.add(normalize(inv.orderNumber));
  }
  return set;
}

/**
 * Builds one row per school/order (spec §12-15: orders are the primary rows, SKUs
 * expand underneath) with ordered/reserved/assembled/remaining/progress computed
 * from the live allocation and assembly ledgers — never stored, always derived
 * (spec §29, avoids drift).
 *
 * Two independent sources feed the same board: invoices (the original workflow,
 * line items ordered directly on a tax invoice) and the standalone Orders
 * collection (school/SKU rows imported from a delivery schedule, spec-driven by
 * the Orders screen). Both are keyed into the same reservation/assembly ledgers
 * by an opaque `invoiceId` — a real invoice id for the former, an orders/{id} for
 * the latter — so allocating stock against either kind books/assembles/readies
 * identically; only `source` tells them apart for features that need a genuine
 * invoice document (see LinkInvoiceModal).
 *
 * `invoiceIdsOnTrips` drives the "graduated to delivery" cutoff for BOTH sources:
 * an invoice-backed row disappears the instant its own id is on a trip, and a
 * standalone order disappears the instant any invoice sharing its Customer P/O
 * is on a trip — computed fresh from live trip data every call, so the card is
 * guaranteed gone regardless of whether (or how promptly) the Orders-collection
 * status write actually lands. That write (see useStockControl) is a best-effort
 * data-consistency step for the Orders screen, not what visibility depends on.
 */
export function buildOrderRows(
  invoices: UIInvoice[],
  schoolOrders: SchoolOrder[],
  allocations: StockAllocation[],
  assemblyLogs: AssemblyLog[],
  invoiceIdsOnTrips: Set<string>
): OrderRow[] {
  const orderNumbersOnTrip = computeOrderNumbersOnTrip(invoices, invoiceIdsOnTrips);
  // Active (non-released) reservations, summed per invoice+stockCode.
  const reservedByOrder = new Map<string, Map<string, number>>();
  for (const alloc of allocations) {
    if (alloc.releasedAt) continue;
    const orderKey = alloc.invoiceId;
    const codeKey = normalize(alloc.stockCode);
    if (!reservedByOrder.has(orderKey)) reservedByOrder.set(orderKey, new Map());
    const inner = reservedByOrder.get(orderKey)!;
    inner.set(codeKey, (inner.get(codeKey) || 0) + alloc.qty);
  }

  // Most recent assembly-log entry per invoice+stockCode is the current built qty
  // (assemblyLogs is already sorted newest-first by the hook), and the first entry
  // seen per invoice is also that order's most recent progress timestamp.
  const assembledByOrder = new Map<string, Map<string, number>>();
  const lastAssemblyAtByOrder = new Map<string, string>();
  for (const log of assemblyLogs) {
    const orderKey = log.invoiceId;
    const codeKey = normalize(log.stockCode);
    if (!assembledByOrder.has(orderKey)) assembledByOrder.set(orderKey, new Map());
    const inner = assembledByOrder.get(orderKey)!;
    if (!inner.has(codeKey)) inner.set(codeKey, log.newQty);
    if (!lastAssemblyAtByOrder.has(orderKey)) lastAssemblyAtByOrder.set(orderKey, log.updatedAt);
  }

  const rows: OrderRow[] = [];

  for (const invoice of invoices) {
    if (invoiceIdsOnTrips.has(invoice.id)) continue;

    const orderedMap = groupOrderedQty(invoice);
    if (orderedMap.size === 0) continue;

    const { lines, totalOrdered, totalReserved, totalAssembled, shortUnits } = buildLines(
      orderedMap,
      reservedByOrder.get(invoice.id) || new Map(),
      assembledByOrder.get(invoice.id) || new Map()
    );

    rows.push({
      invoiceId: invoice.id,
      source: 'invoice',
      // The school's purchase order number (e.g. "OR-012159"), not this
      // document's own tax invoice number — falls back to the invoice number
      // only when an order has genuinely never had a PO number captured.
      orderNumber: invoice.orderNumber || invoice.number,
      schoolName: invoice.schoolName || invoice.client,
      area: invoice.district || 'Unassigned',
      schoolType: invoice.schoolType || '',
      clientNumber: invoice.clientNumber || '',
      status: invoice.status,
      priority: invoice.priority || 'normal',
      dueDate: invoice.dueDate || '',
      lines,
      totalOrdered,
      totalReserved,
      totalAssembled,
      totalRemaining: Math.max(0, totalOrdered - totalAssembled),
      progressPct: totalOrdered > 0 ? Math.round((totalAssembled / totalOrdered) * 100) : 0,
      isReady: totalOrdered > 0 && totalAssembled >= totalOrdered,
      isShortStock: shortUnits > 0,
      shortUnits,
      lastAssemblyAt: lastAssemblyAtByOrder.get(invoice.id) || null
    });
  }

  for (const order of schoolOrders) {
    // A Complete order, or one whose Customer P/O matches an invoice already on
    // a trip, has graduated to the Trips/delivery side entirely — it should
    // disappear from the Product Phases board, not linger as a "Ready" card the
    // user already dealt with. The trip check doesn't wait for `status` to catch
    // up, so it holds even if the Orders-collection write hasn't landed yet.
    if (order.status !== 'Active') continue;
    if (order.orderNumber && orderNumbersOnTrip.has(normalize(order.orderNumber))) continue;

    const orderedMap = groupOrderedQtyFromOrder(order);
    if (orderedMap.size === 0) continue;

    const { lines, totalOrdered, totalReserved, totalAssembled, shortUnits } = buildLines(
      orderedMap,
      reservedByOrder.get(order.id) || new Map(),
      assembledByOrder.get(order.id) || new Map()
    );

    rows.push({
      invoiceId: order.id,
      source: 'order',
      orderNumber: order.orderNumber,
      schoolName: order.schoolName,
      area: order.area || 'Unassigned',
      schoolType: order.schoolType || '',
      clientNumber: order.clientNumber || '',
      status: order.status,
      priority: 'normal',
      dueDate: '',
      lines,
      totalOrdered,
      totalReserved,
      totalAssembled,
      totalRemaining: Math.max(0, totalOrdered - totalAssembled),
      progressPct: totalOrdered > 0 ? Math.round((totalAssembled / totalOrdered) * 100) : 0,
      isReady: totalOrdered > 0 && totalAssembled >= totalOrdered,
      isShortStock: shortUnits > 0,
      shortUnits,
      lastAssemblyAt: lastAssemblyAtByOrder.get(order.id) || null
    });
  }

  return rows;
}

/**
 * Five KPI totals (spec §6). An order's units simultaneously count toward
 * "Reserved to Schools" (regardless of build progress) and are partitioned
 * between "In Assembly" and "Ready for Delivery" by completion status —
 * intentionally not a simple Kanban where an order lives in exactly one column
 * (spec §48).
 */
export function computeKpis(orderRows: OrderRow[], stockRows: { available: number }[]): PhaseKpis {
  const knockdownAvailable = stockRows.reduce((sum, s) => sum + s.available, 0);

  let reservedToSchools = 0, reservedSchoolCount = 0;
  let inAssembly = 0, assemblyJobCount = 0;
  let readyForDelivery = 0, readySchoolCount = 0;
  let totalAssembled = 0, totalOrdered = 0;

  for (const order of orderRows) {
    if (order.totalReserved > 0) {
      reservedToSchools += order.totalReserved;
      reservedSchoolCount += 1;
    }
    totalAssembled += order.totalAssembled;
    totalOrdered += order.totalOrdered;

    if (order.isReady) {
      readyForDelivery += order.totalAssembled;
      readySchoolCount += 1;
    } else if (order.totalAssembled > 0) {
      inAssembly += order.totalAssembled;
      assemblyJobCount += 1;
    }
  }

  return {
    knockdownAvailable,
    reservedToSchools,
    reservedSchoolCount,
    inAssembly,
    assemblyJobCount,
    readyForDelivery,
    readySchoolCount,
    overallProgressPct: totalOrdered > 0 ? Math.round((totalAssembled / totalOrdered) * 100) : 0,
    totalAssembled,
    totalOrdered
  };
}

/**
 * Orders with any line short on reservable stock (spec §35) — surfaced as a
 * warning banner on the Knockdown phase.
 */
export function computeShortStockOrders(orderRows: OrderRow[]): OrderRow[] {
  return orderRows.filter(o => o.isShortStock);
}

// Invoice statuses that mean the order has already been fulfilled — same set
// useInvoices.ts's own transition guard treats as terminal — so a delivered/
// invoiced/complete invoice never counts as still needing stock booked.
const INVOICE_TERMINAL_STATUSES = new Set(['delivered', 'invoiced', 'complete', 'completed']);

/** Whether an order row is still open (i.e. could plausibly still need stock booked against it), regardless of source. */
export function isOrderRowOpen(order: OrderRow): boolean {
  if (order.source === 'order') return order.status === 'Active';
  return !INVOICE_TERMINAL_STATUSES.has((order.status || '').toLowerCase());
}

export interface AutoBookLine {
  stockCode: string;
  description: string;
  shortBy: number;
  coverable: number;
}

export interface AutoBookCandidate {
  order: OrderRow;
  neededUnits: number;
  coverableUnits: number;
  pct: number;
  lines: AutoBookLine[];
}

/**
 * Candidate pool for "Auto-Book" (Available Stock column's one-click reserve):
 * every still-open, standalone Orders-collection row (source === 'order') with
 * at least one SKU that's both short on reservation and has some of that SKU
 * currently available, sorted so the orders Auto-Book can fully close out
 * first. Invoice-sourced rows are excluded — same restriction the manual
 * Allocate picker (AllocateStockModal) already applies — since allocating
 * against them would reserve stock under an id that doesn't correspond to any
 * record on the Orders screen, making it look like Auto-Book invented an
 * order that "doesn't exist". `coverableUnits`/`pct` are an upfront estimate
 * only (computed independently per order) — actual booking still runs each
 * allocation through the same live-inventory transaction a manual Allocate
 * uses, so two candidates competing for the same SKU never double-spend it;
 * whichever is processed second just books less than this estimate shows.
 */
export function computeAutoBookCandidates(orderRows: OrderRow[], stockRows: StockRow[]): AutoBookCandidate[] {
  const availableByCode = new Map<string, number>();
  stockRows.forEach(r => availableByCode.set(normalize(r.stockCode), r.available));

  const candidates: AutoBookCandidate[] = [];
  for (const order of orderRows) {
    if (order.source !== 'order') continue;
    if (!isOrderRowOpen(order)) continue;

    const lines: AutoBookLine[] = order.lines
      .filter(l => l.shortBy > 0)
      .map(l => ({
        stockCode: l.stockCode,
        description: l.description,
        shortBy: l.shortBy,
        coverable: Math.min(l.shortBy, availableByCode.get(normalize(l.stockCode)) || 0)
      }));

    const neededUnits = lines.reduce((s, l) => s + l.shortBy, 0);
    const coverableUnits = lines.reduce((s, l) => s + l.coverable, 0);
    if (neededUnits === 0 || coverableUnits === 0) continue;

    candidates.push({
      order,
      neededUnits,
      coverableUnits,
      pct: Math.round((coverableUnits / neededUnits) * 100),
      lines
    });
  }

  candidates.sort((a, b) => b.pct - a.pct);
  return candidates;
}

export interface StockRow {
  stockCode: string;
  description: string;
  category: 'product' | 'consumable' | 'unknown';
  onHandQty: number;
  // Total reserved units (bookedQty + invoicedQty) — what available is derived from.
  reservedQty: number;
  // Summed qty for this stock code across every still-open invoice (any status
  // other than INVOICE_TERMINAL_STATUSES), computed live from invoice line
  // items — independent of whether that demand has ever been through the
  // manual Allocate/Auto-Book flow. This is what makes an invoice reduce
  // Available the moment it's created, not only once someone books it.
  invoicedQty: number;
  // Units reserved via the allocation ledger against a standalone school order
  // that isn't (yet) backed by a real invoice document — invoice-linked
  // allocations are excluded here since that demand is already counted in
  // invoicedQty above, and double-subtracting it would undercount Available.
  bookedQty: number;
  available: number;
}

/**
 * One row per physical inventory code that represents a full, orderable product
 * (spec §8's Available Stock table) — a code counts as a full product only when
 * it matches a `products` catalog entry with category 'product' (the "Products"
 * tab on the Catalog screen). Knockdown-typed catalog entries (the "Knockdown"
 * tab — sub-assemblies/parts consumed internally to build a product's BOM, not
 * something a school orders directly) and consumables are always excluded, as
 * are bare inventory codes with no product catalog record at all. This mirrors
 * which SKUs actually show up as order line items — schools order products, not
 * the knockdown parts or consumables that go into them.
 * The catalog name is preferred over the raw inventory doc's own description
 * field, which is often just a stock-take placeholder ("No Description").
 *
 * For a product with a BOM (`components`), on-hand stock is however many units
 * can actually be built from the *component* inventory right now — the exact
 * same `getProductBuildableQty` calculation the Products catalog screen uses —
 * rather than the finished SKU's own (often stale/unrelated) inventory doc, so
 * the two screens always agree on what "available" means for that product.
 *
 * `invoicedQty` is recomputed live from every open invoice's own line items
 * (same grouping `buildOrderRows` uses), not from the allocation ledger — an
 * invoice reserves its stock the moment it exists in a non-terminal status
 * (see INVOICE_TERMINAL_STATUSES), whether or not anyone ever ran Allocate or
 * Auto-Book against it. `bookedQty` covers the other case the allocation
 * ledger is still the only source of truth for: a standalone school order
 * (Orders collection) reserved via Allocate/Auto-Book before it has a real
 * invoice of its own — allocations already tied to a real invoice id are
 * excluded from `bookedQty` so that demand isn't subtracted twice.
 */
export function buildStockRows(
  inventoryItems: InventoryRow[],
  productsByCode: Map<string, Product>,
  knockdownByCode: Map<string, { description: string; displayName: string }>,
  componentInventoryMap: Record<string, number>,
  allocations: StockAllocation[],
  invoices: UIInvoice[]
): StockRow[] {
  const invoiceIds = new Set(invoices.map(inv => inv.id));

  const bookedByCode = new Map<string, number>();
  for (const alloc of allocations) {
    if (alloc.releasedAt) continue;
    if (invoiceIds.has(alloc.invoiceId)) continue;
    const codeKey = normalize(alloc.stockCode);
    bookedByCode.set(codeKey, (bookedByCode.get(codeKey) || 0) + alloc.qty);
  }

  const invoicedByCode = new Map<string, number>();
  for (const invoice of invoices) {
    if (INVOICE_TERMINAL_STATUSES.has((invoice.status || '').toLowerCase())) continue;
    for (const [codeKey, { qty }] of groupOrderedQty(invoice)) {
      invoicedByCode.set(codeKey, (invoicedByCode.get(codeKey) || 0) + qty);
    }
  }

  return inventoryItems
    .filter(item => productsByCode.get(normalize(item.stockCode))?.category === 'product')
    .map(item => {
      const codeKey = normalize(item.stockCode);
      const product = productsByCode.get(codeKey);
      const knockdown = knockdownByCode.get(codeKey);
      const rawDescription = item.description.trim();
      const isPlaceholder = !rawDescription || rawDescription.toLowerCase() === 'no description';
      const description = product?.description || knockdown?.displayName || knockdown?.description
        || (!isPlaceholder ? rawDescription : '') || item.stockCode;

      const buildableQty = product ? getProductBuildableQty(product, componentInventoryMap) : null;
      const onHandQty = buildableQty ?? item.qty;
      const bookedQty = bookedByCode.get(codeKey) || 0;
      const invoicedQty = invoicedByCode.get(codeKey) || 0;
      const available = Math.max(0, onHandQty - bookedQty - invoicedQty);

      return {
        stockCode: item.stockCode,
        description,
        category: (product?.category === 'product' || product?.category === 'consumable') ? product.category : 'unknown',
        onHandQty,
        reservedQty: bookedQty + invoicedQty,
        invoicedQty,
        bookedQty,
        available
      } as StockRow;
    })
    .sort((a, b) => a.stockCode.localeCompare(b.stockCode));
}

export function dueDateStatus(dueDate: string): 'overdue' | 'due-today' | 'due-tomorrow' | 'upcoming' | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + 'T00:00:00');
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due-today';
  if (diffDays === 1) return 'due-tomorrow';
  return 'upcoming';
}
