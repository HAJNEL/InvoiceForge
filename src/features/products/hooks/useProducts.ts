/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface Product {
  id: string;
  stockCode: string;
  description: string;
  unitPrice: number;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export function useProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to sanitize ID for firestore Rules
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

  const updateProduct = useCallback(async (id: string, updates: Partial<Pick<Product, 'description' | 'unitPrice'>>) => {
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

  // Save multiple products from an array of raw line items
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
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true }); // Merge true to only update fields and not destroy existing metadata if any
      }

      await batch.commit();
    } catch (err) {
      console.error("Bulk Product Sync Error:", err);
    }
  }, [user, getProductDocId]);

  // Sync products from ALL existing invoices of the current user on the system
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

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const path = 'products';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          stockCode: d.stockCode || '',
          description: d.description || '',
          unitPrice: typeof d.unitPrice === 'number' ? d.unitPrice : 0,
          userId: d.userId || '',
          createdAt: d.createdAt,
          updatedAt: d.updatedAt
        };
      });

      // Sort alphabetically by stockCode
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

  return { 
    products, 
    loading, 
    error, 
    saveProduct, 
    updateProduct, 
    deleteProduct, 
    syncLineItemsAsProducts,
    syncExistingInvoicesToProducts
  };
}
