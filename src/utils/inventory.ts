import { collection, query, where, getDocs, doc, getDoc, updateDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

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

    // 2. Resolve actual owner of the inventory if userId is a team member
    let finalOwnerId = userId;
    try {
      const memberDocSnap = await getDoc(doc(db, 'team_members', userId));
      if (memberDocSnap.exists()) {
        finalOwnerId = memberDocSnap.data().ownerId || userId;
      } else {
        // Fallback to query
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
      console.warn("Could not check team member classification in validateAndSubtractInventory:", e);
    }

    let inventorySnap;
    const inventoryQuery = query(
      collection(db, 'inventory'),
      where('userId', '==', finalOwnerId)
    );
    try {
      inventorySnap = await getDocs(inventoryQuery);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'inventory');
    }

    const inventoryItems: Record<string, { docId: string; stockCode: string; qty: number }> = {};
    
    if (inventorySnap) {
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
    }

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
      try {
        await updateDoc(docRef, {
          qty: newQty,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `inventory/${invItem.docId}`);
      }
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

/**
 * Adds back inventory quantities — called when a trip is reverted from assembled (or later)
 * back to proposed, or when an assembled-or-later trip is deleted.
 */
export async function restoreInventoryForItems(
  items: Array<{ stockCode: string; qty: number }>,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const validItems = items.filter(({ stockCode, qty }) => {
      const code = String(stockCode || '').trim().toUpperCase();
      return code && code !== 'N/A' && qty > 0;
    });
    if (!validItems.length) return { success: true };

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
      console.warn("Could not check team member classification in restoreInventoryForItems:", e);
    }

    let inventorySnap;
    try {
      inventorySnap = await getDocs(
        query(collection(db, 'inventory'), where('userId', '==', finalOwnerId))
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'inventory');
    }

    if (!inventorySnap) return { success: false, error: 'Could not load inventory.' };

    const inventoryItems: Record<string, { docId: string; qty: number }> = {};
    inventorySnap.forEach(docItem => {
      const code = String(docItem.data().stockCode || '').trim().toUpperCase();
      if (code) {
        inventoryItems[code] = { docId: docItem.id, qty: Number(docItem.data().qty || 0) };
      }
    });

    await Promise.all(
      validItems.map(async ({ stockCode, qty }) => {
        const code = String(stockCode).trim().toUpperCase();
        const invItem = inventoryItems[code];
        if (!invItem) return;
        await updateDoc(doc(db, 'inventory', invItem.docId), {
          qty: invItem.qty + qty,
          updatedAt: new Date().toISOString()
        });
      })
    );

    return { success: true };
  } catch (err) {
    console.error('restoreInventoryForItems Error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Subtracts a single line item's quantity from inventory immediately — used when an
 * Assembler counts/processes the item at assembly. Resolves the team member's owner so
 * the correct owner's inventory is decremented. No-op for blank / 'N/A' codes or qty <= 0.
 */
export async function subtractSingleItemFromInventory(
  stockCode: string,
  qty: number,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const code = String(stockCode || '').trim().toUpperCase();
    if (!code || code === 'N/A' || !qty || qty <= 0) {
      return { success: true };
    }

    // Resolve actual owner of the inventory if userId is a team member
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
      console.warn("Could not check team member classification in subtractSingleItemFromInventory:", e);
    }

    // Find the matching inventory item for this owner
    let inventorySnap;
    const inventoryQuery = query(
      collection(db, 'inventory'),
      where('userId', '==', finalOwnerId)
    );
    try {
      inventorySnap = await getDocs(inventoryQuery);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'inventory');
    }

    if (!inventorySnap) return { success: false, error: 'Could not load inventory.' };

    const match = inventorySnap.docs.find(
      d => String(d.data().stockCode || '').trim().toUpperCase() === code
    );
    if (!match) {
      // Nothing to deduct against — not a hard failure for the assembly flow
      return { success: true, error: `No inventory item found for code "${stockCode}".` };
    }

    const currentQty = Number(match.data().qty || 0);
    const newQty = Math.max(0, currentQty - qty);
    try {
      await updateDoc(doc(db, 'inventory', match.id), {
        qty: newQty,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `inventory/${match.id}`);
      return { success: false, error: 'Failed to update inventory.' };
    }

    return { success: true };
  } catch (err) {
    console.error('subtractSingleItemFromInventory Error:', err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
