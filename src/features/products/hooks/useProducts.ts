/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface ProductComponent {
  id: string;
  stockCode: string;
  description: string;
  type: 'knockdown' | 'consumable';
  qtyPerUnit: number;
}

export interface Product {
  id: string;
  stockCode: string;
  description: string;
  unitPrice: number;
  category?: 'product' | 'consumable';
  components?: ProductComponent[];
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryMap, setInventoryMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getProductDocId = useCallback((userId: string, stockCode: string) => {
    const cleanStockCode = stockCode.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `${userId}_${cleanStockCode}`;
  }, []);

  const saveProduct = useCallback(async (productData: Omit<Product, 'id' | 'userId'>) => {
    if (!user) return null;

    const stockCode = productData.stockCode.trim();
    if (!stockCode) return null;

    const id = getProductDocId(user.uid, stockCode);
    const path = `products/${id}`;

    const saveData = {
      stockCode,
      description: productData.description || '',
      unitPrice: typeof productData.unitPrice === 'number' ? productData.unitPrice : 0,
      category: productData.category || 'product',
      userId: user.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'products', id), saveData);
      return { id, ...saveData };
    } catch (err) {
      console.error("Firestore Save Product Error:", err);
      handleFirestoreError(err, OperationType.WRITE, path);
      return null;
    }
  }, [user, getProductDocId]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Pick<Product, 'description' | 'unitPrice' | 'category' | 'components'>>) => {
    const path = `products/${id}`;
    try {
      await updateDoc(doc(db, 'products', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Firestore Update Product Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    const path = `products/${id}`;
    try {
      await deleteDoc(doc(db, 'products', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Product Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  const syncLineItemsAsProducts = useCallback(async (lineItems: any[]) => {
    if (!user || !lineItems || lineItems.length === 0) return;

    try {
      const batch = writeBatch(db);

      for (const item of lineItems) {
        const stockCode = item.stockCode || item.stock_code;
        const description = item.description || item.desc || '';
        const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : (typeof item.unit_price === 'number' ? item.unit_price : 0);

        if (!stockCode || !stockCode.trim()) continue;

        const cleanStock = stockCode.trim();
        const id = getProductDocId(user.uid, cleanStock);
        const ref = doc(db, 'products', id);

        batch.set(ref, {
          stockCode: cleanStock,
          description: description || '',
          unitPrice: unitPrice,
          category: 'product',
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      await batch.commit();
    } catch (err) {
      console.error("Bulk Product Sync Error:", err);
    }
  }, [user, getProductDocId]);

  const syncExistingInvoicesToProducts = useCallback(async () => {
    if (!user) return;
    try {
      const invoicesQuery = query(
        collection(db, 'invoices'),
        where('userId', '==', user.uid)
      );
      const snap = await getDocs(invoicesQuery);
      if (snap.empty) return;

      const allLineItems: any[] = [];
      snap.docs.forEach(invoiceDoc => {
        const invData = invoiceDoc.data();
        const items = invData.lineItems || invData.line_items || (invData.lineItemsDetails) || [];
        if (Array.isArray(items)) {
          allLineItems.push(...items);
        }
      });

      if (allLineItems.length > 0) {
        await syncLineItemsAsProducts(allLineItems);
      }
    } catch (err) {
      console.error("Sync Existing Invoices To Products Error:", err);
    }
  }, [user, syncLineItemsAsProducts]);

  // Products snapshot
  useEffect(() => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const path = 'products';
    const q = query(collection(db, path), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => {
        const v = d.data();
        return {
          id: d.id,
          stockCode: v.stockCode || '',
          description: v.description || '',
          unitPrice: typeof v.unitPrice === 'number' ? v.unitPrice : 0,
          category: (v.category || 'product') as 'product' | 'consumable',
          components: Array.isArray(v.components) ? v.components : undefined,
          userId: v.userId || '',
          createdAt: v.createdAt,
          updatedAt: v.updatedAt
        };
      });

      data.sort((a, b) => a.stockCode.localeCompare(b.stockCode));
      setProducts(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe Products Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Inventory snapshot — provides units-on-floor per stockCode
  useEffect(() => {
    if (!user) { setInventoryMap({}); return; }

    const q = query(collection(db, 'inventory'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const map: Record<string, number> = {};
      snap.forEach(d => {
        const v = d.data();
        const code = (v.stockCode || '').toLowerCase().trim();
        if (code) map[code] = Number(v.qty) || 0;
      });
      setInventoryMap(map);
    }, (err) => {
      console.error("Firestore Subscribe Inventory Error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  return {
    products,
    inventoryMap,
    loading,
    error,
    saveProduct,
    updateProduct,
    deleteProduct,
    syncLineItemsAsProducts,
    syncExistingInvoicesToProducts
  };
}
