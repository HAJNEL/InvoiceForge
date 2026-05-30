import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface UIInvoice {
  id: string;
  number: string;
  client: string;
  amount: number;
  date: string;
  status: string;
  clientEmail: string;
  district?: string;
  deliveryAddressLine1?: string;
  deliveryAddressLine2?: string;
  lineItems?: {
    stockCode: string;
    description: string;
    qty: number;
    unitPrice: number;
    value: number;
  }[];
}

export function useInvoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<UIInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const deleteInvoice = useCallback(async (id: string) => {
    const path = `invoices/${id}`;
    try {
      await deleteDoc(doc(db, 'invoices', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  const updateInvoice = useCallback(async (id: string, data: Partial<Record<string, unknown>>) => {
    const path = `invoices/${id}`;
    try {
      await updateDoc(doc(db, 'invoices', id), {
        ...data,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Firestore Update Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    const path = 'invoices';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          number: d.taxInvoice || d.invoiceNumber || '#NO-NUM',
          client: d.schoolName || d.customerName || d.clientName || 'Unknown Client',
          amount: d.totalDue || d.amountIncl || d.totalAmount || 0,
          date: d.invoiceDate || d.issueDate || 'N/A',
          status: d.status || 'draft',
          clientEmail: d.email || d.customerContact || 'No Email',
          district: d.district || d.deliveryRegion || 'Unassigned',
          deliveryAddressLine1: d.deliveryAddressLine1 || '',
          deliveryAddressLine2: d.deliveryAddressLine2 || '',
          lineItems: d.lineItems || []
        };
      });
      
      // Basic client-side sort by date descending if we don't have a reliable server order yet
      data.sort((a, b) => b.date.localeCompare(a.date));
      
      setInvoices(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe Error:", err);
      setError(err.message);
      setLoading(false);
      // Only handle error if it's a permission issue or similar that needs reporting as per guidelines
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { invoices, loading, error, deleteInvoice, updateInvoice };
}
