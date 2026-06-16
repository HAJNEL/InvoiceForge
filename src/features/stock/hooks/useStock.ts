import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface StockPart {
  partCode: string;
  description: string;
  qty: number;
}

export interface KnockdownItem {
  id: string;
  userId: string;
  stockCode: string;
  description: string;
  qty: number;
  displayName: string;
  type: 'knockdown' | 'assembled' | 'pre-assembled' | 'stock-take';
  parts: StockPart[];
  createdAt: string;
  updatedAt?: string;
}

export function useStock() {
  const { user } = useAuth();
  const [stockItems, setStockItems] = useState<KnockdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveStockItem = useCallback(async (item: Omit<KnockdownItem, 'userId' | 'createdAt'> & { id?: string }) => {
    if (!user) return null;
    
    const itemId = item.id || doc(collection(db, 'knockdown_items')).id;
    const path = `knockdown_items/${itemId}`;
    
    const saveData: Omit<KnockdownItem, 'id'> = {
      userId: user.uid,
      stockCode: item.stockCode,
      description: item.description,
      qty: item.qty,
      displayName: item.displayName,
      type: item.type || 'knockdown',
      parts: item.parts || [],
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'knockdown_items', itemId), saveData);
      return { id: itemId, ...saveData };
    } catch (err) {
      console.error("Firestore Save Stock Item Error:", err);
      handleFirestoreError(err, OperationType.WRITE, path);
      return null;
    }
  }, [user]);

  const updateTypeAndQty = useCallback(async (id: string, updates: Partial<Pick<KnockdownItem, 'type' | 'qty' | 'displayName' | 'parts'>>) => {
    const path = `knockdown_items/${id}`;
    try {
      await updateDoc(doc(db, 'knockdown_items', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Firestore Update Stock Item Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteStockItem = useCallback(async (id: string) => {
    const path = `knockdown_items/${id}`;
    try {
      await deleteDoc(doc(db, 'knockdown_items', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Stock Item Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setStockItems([]);
      setLoading(false);
      return;
    }

    const path = 'knockdown_items';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          userId: d.userId,
          stockCode: d.stockCode || '',
          description: d.description || '',
          qty: typeof d.qty === 'number' ? d.qty : 0,
          displayName: d.displayName || '',
          type: (d.type || 'knockdown') as KnockdownItem['type'],
          parts: (d.parts as StockPart[] || []).map((p) => ({
            partCode: p.partCode || '',
            description: p.description || '',
            qty: typeof p.qty === 'number' ? p.qty : 0
          })),
          createdAt: d.createdAt || ''
        };
      });

      // Sort by creation date or stockCode
      data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setStockItems(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe Stock Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { stockItems, loading, error, saveStockItem, updateTypeAndQty, deleteStockItem };
}
