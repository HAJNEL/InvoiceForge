import { collection, doc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export interface StockCountEntry {
  stockCode: string;
  description: string;
  isPart?: boolean;
  parentItem?: string | null;
  countedQty: number;
}

/**
 * Writes a single counted stock item straight to the live `inventory` collection,
 * creating the inventory doc if none exists yet for that stockCode/isPart pair,
 * or overwriting its target field if one does. Used at stock-take submission time
 * so counts take effect immediately, with no separate authorization step.
 *
 * `field` picks which counter this count updates — `'qty'` (available, the
 * default) or `'damagedQty'`. Only that one field is ever touched: updateDoc
 * only sends the single changed key, so logging a damaged count never disturbs
 * the existing qty and vice versa. On a brand-new inventory doc (first count of
 * either kind for this stockCode) the untouched counter is seeded to 0 rather
 * than left undefined.
 */
export async function applyStockCount(userId: string, entry: StockCountEntry, field: 'qty' | 'damagedQty' = 'qty'): Promise<void> {
  const existingRef = query(
    collection(db, 'inventory'),
    where('userId', '==', userId),
    where('stockCode', '==', entry.stockCode),
    where('isPart', '==', !!entry.isPart)
  );
  const snap = await getDocs(existingRef);

  if (!snap.empty) {
    const docId = snap.docs[0].id;
    await updateDoc(doc(db, 'inventory', docId), {
      [field]: entry.countedQty,
      updatedAt: new Date().toISOString()
    });
  } else {
    const newId = doc(collection(db, 'inventory')).id;
    await setDoc(doc(db, 'inventory', newId), {
      stockCode: entry.stockCode,
      description: entry.description || '',
      isPart: !!entry.isPart,
      parentItem: entry.parentItem || null,
      displayName: entry.stockCode + ' - ' + (entry.description || ''),
      qty: field === 'qty' ? entry.countedQty : 0,
      damagedQty: field === 'damagedQty' ? entry.countedQty : 0,
      userId,
      createdAt: new Date().toISOString()
    });
  }
}
