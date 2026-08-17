import { collection, query, where, getDocs, doc, getDoc, limit, writeBatch, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { explodeStockDeduction } from './bom';
import type { Product } from '../features/products/hooks/useProducts';
import type { KnockdownItem } from '../features/stock/hooks/useStock';

export interface InventoryItemItem {
  id: string;
  stockCode: string;
  description: string;
  displayName: string;
  qty: number;
}

/** Statuses at which an invoice's stock is considered "delivered" — the trigger set for the
 * per-invoice inventory ledger's bulk deduct/restore. */
export function isDeliveredStatus(status: string | undefined | null): boolean {
  const s = String(status || '').trim().toLowerCase();
  return s === 'delivered' || s === 'completed' || s === 'complete' || s === 'invoiced';
}

/** Trip statuses at which stock has already left inventory via the Assembler checklist
 * (assembly, not delivery, is when trip-linked stock is first removed). Generalizes the
 * restore-eligibility check that used to live only in TripList.tsx. */
export function tripHoldsStock(status: string | undefined | null): boolean {
  const s = String(status || '').trim().toLowerCase();
  return s === 'assembled' || s === 'on-route' || s === 'on_route' || s === 'delivered' || s === 'completed';
}

async function resolveOwnerId(userId: string): Promise<string> {
  let finalOwnerId = userId;
  try {
    const memberDocSnap = await getDoc(doc(db, 'team_members', userId));
    if (memberDocSnap.exists()) {
      finalOwnerId = memberDocSnap.data().ownerId || userId;
    } else {
      const teamQuery = query(
        collection(db, 'team_members'),
        where('userId', '==', userId),
        limit(1)
      );
      const teamSnap = await getDocs(teamQuery);
      if (!teamSnap.empty) {
        finalOwnerId = teamSnap.docs[0].data().ownerId || userId;
      }
    }
  } catch (e) {
    console.warn("Could not resolve team member owner:", e);
  }
  return finalOwnerId;
}

async function fetchInventoryMap(ownerId: string): Promise<Record<string, { docId: string; stockCode: string; qty: number }>> {
  let inventorySnap;
  try {
    inventorySnap = await getDocs(query(collection(db, 'inventory'), where('userId', '==', ownerId)));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'inventory');
  }

  const inventoryItems: Record<string, { docId: string; stockCode: string; qty: number }> = {};
  inventorySnap?.forEach(docItem => {
    const data = docItem.data();
    const code = String(data.stockCode || '').trim().toUpperCase();
    if (code) {
      inventoryItems[code] = {
        docId: docItem.id,
        stockCode: String(data.stockCode),
        qty: Number(data.qty || 0)
      };
    }
  });
  return inventoryItems;
}

async function fetchBomMaps(ownerId: string): Promise<{ productsByCode: Map<string, Product>; knockdownByCode: Map<string, KnockdownItem> }> {
  let productsSnap, knockdownSnap;
  try {
    [productsSnap, knockdownSnap] = await Promise.all([
      getDocs(query(collection(db, 'products'), where('userId', '==', ownerId))),
      getDocs(query(collection(db, 'knockdown_items'), where('userId', '==', ownerId)))
    ]);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'products');
  }

  const productsByCode = new Map<string, Product>();
  productsSnap?.forEach(docItem => {
    const v = docItem.data();
    const code = String(v.stockCode || '').trim().toLowerCase();
    if (!code) return;
    productsByCode.set(code, {
      id: docItem.id,
      stockCode: v.stockCode || '',
      description: v.description || '',
      unitPrice: typeof v.unitPrice === 'number' ? v.unitPrice : 0,
      category: (v.category || 'product') as 'product' | 'consumable',
      components: Array.isArray(v.components) ? v.components : undefined,
      userId: v.userId || ''
    });
  });

  const knockdownByCode = new Map<string, KnockdownItem>();
  knockdownSnap?.forEach(docItem => {
    const v = docItem.data();
    const code = String(v.stockCode || '').trim().toLowerCase();
    if (!code) return;
    knockdownByCode.set(code, {
      id: docItem.id,
      userId: v.userId,
      stockCode: v.stockCode || '',
      description: v.description || '',
      qty: typeof v.qty === 'number' ? v.qty : 0,
      displayName: v.displayName || '',
      type: (v.type || 'knockdown') as KnockdownItem['type'],
      parts: Array.isArray(v.parts) ? v.parts : [],
      createdAt: v.createdAt || ''
    });
  });

  return { productsByCode, knockdownByCode };
}

/**
 * Explodes an invoice's line items through the Product/Knockdown BOM into a flat map of
 * every affected stock code (uppercased) to the total qty that a *full* delivery of this
 * invoice requires.
 */
function explodeInvoiceLineItems(
  lineItemsRaw: Array<Record<string, unknown>>,
  productsByCode: Map<string, Product>,
  knockdownByCode: Map<string, KnockdownItem>
): Map<string, number> {
  const target = new Map<string, number>();
  for (const item of lineItemsRaw) {
    const stockCode = String(item.stock_code || item.stockCode || '').trim();
    if (!stockCode) continue;
    const qty = Number(item.quantity || item.qty || 0);
    if (qty <= 0) continue;

    const exploded = explodeStockDeduction(stockCode, qty, productsByCode, knockdownByCode);
    exploded.forEach((expQty, lowerCode) => {
      const upperCode = lowerCode.toUpperCase();
      target.set(upperCode, (target.get(upperCode) ?? 0) + expQty);
    });
  }
  return target;
}

/**
 * Diffs an invoice's full BOM-exploded target deduction against what's already recorded in
 * its `inventoryDeduction` ledger, deducts only the delta from real inventory (in one atomic
 * batch), and overwrites the ledger to the new target. Safe to call unconditionally whenever
 * an invoice enters a delivered-equivalent status (see isDeliveredStatus): a standalone
 * invoice with nothing deducted yet gets the full amount removed; a trip invoice already
 * fully deducted via per-item assembly (see deductLineItemForAssembly) sees a zero delta.
 */
export async function deductForInvoiceDelivery(invoiceId: string, userId: string, force: boolean = false): Promise<{ success: boolean; error?: string }> {
  try {
    const invoiceRef = doc(db, 'invoices', invoiceId);
    let invoiceSnap;
    try {
      invoiceSnap = await getDoc(invoiceRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `invoices/${invoiceId}`);
    }

    if (!invoiceSnap || !invoiceSnap.exists()) {
      return { success: false, error: 'Invoice not found.' };
    }

    const d = invoiceSnap.data();
    const lineItemsRaw = d.line_items || d.lineItems || [];
    if (lineItemsRaw.length === 0) {
      return { success: true };
    }

    const existingLedger: Record<string, number> = (d.inventoryDeduction && typeof d.inventoryDeduction === 'object') ? d.inventoryDeduction : {};

    const finalOwnerId = await resolveOwnerId(userId);
    const inventoryItems = await fetchInventoryMap(finalOwnerId);
    const { productsByCode, knockdownByCode } = await fetchBomMaps(finalOwnerId);

    const target = explodeInvoiceLineItems(lineItemsRaw, productsByCode, knockdownByCode);

    // Only the shortfall beyond what's already recorded (e.g. via assembly-time deduction)
    // needs to actually come off real inventory.
    const deltas = new Map<string, number>();
    target.forEach((qty, code) => {
      const already = existingLedger[code] || 0;
      const delta = qty - already;
      if (delta > 0) deltas.set(code, delta);
    });

    const errors: string[] = [];
    for (const [code, qtyNeeded] of deltas.entries()) {
      const invItem = inventoryItems[code];
      const availableQty = invItem ? invItem.qty : 0;
      if (availableQty < qtyNeeded) {
        const label = productsByCode.get(code.toLowerCase())?.description
          || knockdownByCode.get(code.toLowerCase())?.displayName
          || knockdownByCode.get(code.toLowerCase())?.description
          || 'No description';
        errors.push(
          `Insufficient stock for code "${invItem?.stockCode || code}" (${label}). Required: ${qtyNeeded}, Available in Inventory: ${availableQty}.`
        );
      }
    }

    if (errors.length > 0 && !force) {
      return { success: false, error: errors.join('\n') };
    }

    const batch = writeBatch(db);
    for (const [code, qtyNeeded] of deltas.entries()) {
      const invItem = inventoryItems[code];
      if (!invItem) continue;
      const newQty = Math.max(0, invItem.qty - qtyNeeded);
      batch.update(doc(db, 'inventory', invItem.docId), {
        qty: newQty,
        updatedAt: new Date().toISOString()
      });
    }

    // The ledger must never claim less than what's actually been removed from real
    // inventory so far (e.g. if line items were edited down after a partial assembly-time
    // deduction already happened) — so it's the max of the recomputed target and whatever
    // was already recorded per code, not a blind overwrite.
    const newLedger: Record<string, number> = { ...existingLedger };
    target.forEach((qty, code) => {
      newLedger[code] = Math.max(qty, existingLedger[code] || 0);
    });
    batch.update(invoiceRef, {
      inventoryDeduction: newLedger,
      inventoryDeductedAt: new Date().toISOString()
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'inventory');
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    return {
      success: true,
      error: errors.length > 0 ? errors.join('\n') : undefined
    };
  } catch (err) {
    console.error('deductForInvoiceDelivery Error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Reverses everything currently recorded in an invoice's inventoryDeduction ledger — the
 * exact amount that's actually been removed from stock on this invoice's behalf, whether
 * via assembly-time per-item deduction or a bulk delivery top-up — and clears the ledger.
 * Safe/idempotent to call whenever an invoice leaves a delivered-equivalent (or, for
 * trip-orchestration callers, a stock-held) status: an empty ledger is a no-op.
 */
export async function restoreForInvoiceDelivery(invoiceId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const invoiceRef = doc(db, 'invoices', invoiceId);
    let invoiceSnap;
    try {
      invoiceSnap = await getDoc(invoiceRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `invoices/${invoiceId}`);
    }

    if (!invoiceSnap || !invoiceSnap.exists()) {
      return { success: true };
    }

    const d = invoiceSnap.data();
    const ledger: Record<string, number> = (d.inventoryDeduction && typeof d.inventoryDeduction === 'object') ? d.inventoryDeduction : {};
    const entries = Object.entries(ledger).filter(([, qty]) => Number(qty) > 0);
    if (entries.length === 0) {
      return { success: true };
    }

    const finalOwnerId = await resolveOwnerId(userId);
    const inventoryItems = await fetchInventoryMap(finalOwnerId);

    const batch = writeBatch(db);
    for (const [code, qty] of entries) {
      const invItem = inventoryItems[code];
      if (!invItem) continue;
      batch.update(doc(db, 'inventory', invItem.docId), {
        qty: invItem.qty + Number(qty),
        updatedAt: new Date().toISOString()
      });
    }

    batch.update(invoiceRef, {
      inventoryDeduction: {},
      updatedAt: new Date().toISOString()
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'inventory');
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    return { success: true };
  } catch (err) {
    console.error('restoreForInvoiceDelivery Error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Deducts a single invoice line item's counted quantity from inventory immediately — used
 * when an Assembler counts/processes the item at assembly. Explodes the item's stock code
 * through its BOM (cascading to linked knockdown parts/consumables) and records the exploded
 * amounts onto the invoice's inventoryDeduction ledger, so a later bulk delivery (see
 * deductForInvoiceDelivery) only tops up whatever wasn't already covered here. No-op for
 * blank / 'N/A' codes or qty <= 0.
 */
export async function deductLineItemForAssembly(
  invoiceId: string,
  stockCode: string,
  qty: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const code = String(stockCode || '').trim().toUpperCase();
    if (!code || code === 'N/A' || !qty || qty <= 0) {
      return { success: true };
    }

    const finalOwnerId = await resolveOwnerId(userId);
    const inventoryItems = await fetchInventoryMap(finalOwnerId);
    const { productsByCode, knockdownByCode } = await fetchBomMaps(finalOwnerId);

    const exploded = explodeStockDeduction(stockCode, qty, productsByCode, knockdownByCode);

    const batch = writeBatch(db);
    const ledgerUpdate: Record<string, ReturnType<typeof increment>> = {};
    let hasWrites = false;
    exploded.forEach((expQty, lowerCode) => {
      const upperCode = lowerCode.toUpperCase();
      const invItem = inventoryItems[upperCode];
      if (!invItem) return; // Nothing to deduct against — not a hard failure for the assembly flow
      const newQty = Math.max(0, invItem.qty - expQty);
      batch.update(doc(db, 'inventory', invItem.docId), {
        qty: newQty,
        updatedAt: new Date().toISOString()
      });
      ledgerUpdate[`inventoryDeduction.${upperCode}`] = increment(expQty);
      hasWrites = true;
    });

    if (hasWrites) {
      batch.update(doc(db, 'invoices', invoiceId), ledgerUpdate);
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `invoices/${invoiceId}`);
        return { success: false, error: 'Failed to update inventory.' };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('deductLineItemForAssembly Error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
