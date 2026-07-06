import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc, deleteField, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { SelfInvoice } from '../../../types';

// Self-invoices bundle several existing Invoice docs into one billing document sent
// to the client (e.g. a consolidated statement of everything already "Invoiced").
// They live in their own collection rather than being derived, since a self-invoice
// is a distinct, persistent artifact with its own lifecycle (open -> completed -> can
// be reverted), separate from the status of the underlying invoices it references.
export function useSelfInvoices() {
  const { user } = useAuth();
  const [selfInvoices, setSelfInvoices] = useState<SelfInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setSelfInvoices([]);
      setLoading(false);
      return;
    }

    const path = 'self_invoices';
    const q = query(collection(db, path), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SelfInvoice[];
      data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setSelfInvoices(data);
      setLoading(false);
    }, (err) => {
      console.error('Firestore Subscribe Self Invoices Error:', err);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const addSelfInvoice = useCallback(async (invoiceIds: string[], totalAmount: number) => {
    if (!user) return null;
    const path = 'self_invoices';
    try {
      // Keep numbering sequential/gap-free by checking the highest existing suffix,
      // same approach as the stock-take code generator on the Team Dashboard.
      const snap = await getDocs(query(collection(db, path), where('userId', '==', user.uid)));
      let maxNum = 0;
      snap.forEach(docSnap => {
        const match = /SELF-(\d+)/.exec(docSnap.data().invoiceNumber || '');
        if (match) {
          const n = parseInt(match[1], 10);
          if (n > maxNum) maxNum = n;
        }
      });
      const invoiceNumber = `SELF-${String(maxNum + 1).padStart(4, '0')}`;

      const docRef = await addDoc(collection(db, path), {
        userId: user.uid,
        invoiceNumber,
        invoiceIds,
        totalAmount,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (err) {
      console.error('Firestore Add Self Invoice Error:', err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return null;
    }
  }, [user]);

  const completeSelfInvoice = useCallback(async (id: string) => {
    const path = `self_invoices/${id}`;
    try {
      await updateDoc(doc(db, 'self_invoices', id), {
        status: 'completed',
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error('Firestore Complete Self Invoice Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const revertSelfInvoice = useCallback(async (id: string) => {
    const path = `self_invoices/${id}`;
    try {
      await updateDoc(doc(db, 'self_invoices', id), {
        status: 'open',
        completedAt: deleteField(),
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error('Firestore Revert Self Invoice Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  // Replaces the bundled invoice selection on an existing self-invoice (edit flow) -
  // status/invoiceNumber are left untouched, only the bundle contents change.
  const updateSelfInvoiceInvoices = useCallback(async (id: string, invoiceIds: string[], totalAmount: number) => {
    const path = `self_invoices/${id}`;
    try {
      await updateDoc(doc(db, 'self_invoices', id), {
        invoiceIds,
        totalAmount,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error('Firestore Update Self Invoice Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteSelfInvoice = useCallback(async (id: string) => {
    const path = `self_invoices/${id}`;
    try {
      await deleteDoc(doc(db, 'self_invoices', id));
      return true;
    } catch (err) {
      console.error('Firestore Delete Self Invoice Error:', err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  return { selfInvoices, loading, addSelfInvoice, completeSelfInvoice, revertSelfInvoice, updateSelfInvoiceInvoices, deleteSelfInvoice };
}
