import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { DetailedInvoice } from '../../../services/geminiService';

export interface FirestoreInvoice extends DetailedInvoice {
  id: string;
  userId: string;
  status: string;
  invoiceNumber?: string;
  issueDate?: string;
  clientName?: string;
  clientAddress?: string;
  totalAmount?: number;
  deliveredDate?: string;
  // Delivery distance in km, entered on the detail page; drives the
  // Local/Regional revenue split in Reports.
  distanceKm?: number;
  vatPercentage?: number;
  createdAt?: string;
  updatedAt?: string;
}

export function useInvoice(id: string | undefined) {
  const [invoice, setInvoice] = useState<FirestoreInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setInvoice(null);
      setLoading(false);
      return;
    }

    const path = `invoices/${id}`;
    const unsubscribe = onSnapshot(doc(db, 'invoices', id), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setInvoice({ id: snapshot.id, ...data } as FirestoreInvoice);
      } else {
        setInvoice(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Get Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, path);
      }
    });

    return () => unsubscribe();
  }, [id]);

  return { invoice, loading, error };
}
