import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface InventoryItemItem {
  id: string;
  stockCode: string;
  description: string;
  displayName: string;
  qty: number;
}

/**
 * Validates inventory availability and subtracts quantities for an invoice changed to delivered.
 * Returns { success: true } if successful, otherwise { success: false, error: string }.
 */
export async function validateAndSubtractInventory(invoiceId: string, userId: string, force: boolean = false): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Fetch the invoice
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    if (!invoiceSnap.exists()) {
      return { success: false, error: 'Invoice not found.' };
    }

    const d = invoiceSnap.data();
    // Support both raw Firestore fields and normalized frontend formats safely
    const lineItemsRaw = d.line_items || d.lineItems || [];
    if (lineItemsRaw.length === 0) {
      // No items to deduct, succeeds automatically
      return { success: true };
    }

    // Map and group invoice items by stock code
    const invoiceDeductions: Record<string, { stockCode: string; description: string; qty: number }> = {};
    for (const item of lineItemsRaw) {
      const originalCode = String(item.stock_code || item.stockCode || '').trim();
      const code = originalCode.toUpperCase();
      if (!code) continue;
      const qty = Number(item.quantity || item.qty || 0);

      if (invoiceDeductions[code]) {
        invoiceDeductions[code].qty += qty;
      } else {
        invoiceDeductions[code] = {
          stockCode: originalCode,
          description: String(item.description || ''),
          qty
        };
      }
    }

    // 2. Fetch current inventory for this main owner's userId
    const inventoryQuery = query(
      collection(db, 'inventory'),
      where('userId', '==', userId)
    );
    const inventorySnap = await getDocs(inventoryQuery);
    const inventoryItems: Record<string, { docId: string; stockCode: string; qty: number }> = {};
    
    inventorySnap.forEach(docItem => {
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

    // 3. Dry-run safety validation: check if all items exist and have enough quantity
    const errors: string[] = [];
    for (const [code, deduct] of Object.entries(invoiceDeductions)) {
      const invItem = inventoryItems[code];
      const availableQty = invItem ? invItem.qty : 0;
      if (availableQty < deduct.qty) {
        errors.push(
          `Insufficient stock for code "${deduct.stockCode}" (${deduct.description || 'No description'}). Required: ${deduct.qty}, Available in Inventory: ${availableQty}.`
        );
      }
    }

    if (errors.length > 0 && !force) {
      return {
        success: false,
        error: errors.join('\n')
      };
    }

    // 4. Execution phase: subtract quantities from inventory
    const promises = Object.entries(invoiceDeductions).map(async ([code, deduct]) => {
      const invItem = inventoryItems[code];
      if (!invItem) return; // Skip if no equivalent item exists in main inventory

      const newQty = Math.max(0, invItem.qty - deduct.qty);
      const docRef = doc(db, 'inventory', invItem.docId);
      await updateDoc(docRef, {
        qty: newQty,
        updatedAt: new Date().toISOString()
      });
    });

    await Promise.all(promises);
    return { 
      success: true, 
      error: errors.length > 0 ? errors.join('\n') : undefined 
    };

  } catch (err) {
    console.error('validateAndSubtractInventory Error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
