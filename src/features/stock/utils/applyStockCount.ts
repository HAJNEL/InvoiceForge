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
 * or overwriting its qty if one does. Used at stock-take submission time so
 * counts take effect immediately, with no separate authorization step.
 */
export async function applyStockCount(userId: string, entry: StockCountEntry): Promise<void> {
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
      qty: entry.countedQty,
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
      qty: entry.countedQty,
      userId,
      createdAt: new Date().toISOString()
    });
  }
}
