import { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface ServiceRecord {
  id: string;
  date: string;
  odometer: number;
  type: string;
  description: string;
  cost: number;
  provider: string;
  nextServiceKm?: number;
  nextServiceDate?: string;
  createdAt: unknown;
}

export function useServiceHistory(truckId: string | null) {
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRecord = useCallback(async (record: Omit<ServiceRecord, 'id' | 'createdAt'>) => {
    if (!truckId) return null;
    const path = `trucks/${truckId}/serviceHistory`;
    try {
      const docRef = await addDoc(collection(db, path), {
        ...record,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (err) {
      console.error("Firestore Add Error:", err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return null;
    }
  }, [truckId]);

  const updateRecord = useCallback(async (recordId: string, record: Partial<Omit<ServiceRecord, 'id' | 'createdAt'>>) => {
    if (!truckId) return false;
    const path = `trucks/${truckId}/serviceHistory/${recordId}`;
    try {
      await updateDoc(doc(db, `trucks/${truckId}/serviceHistory`, recordId), record);
      return true;
    } catch (err) {
      console.error("Firestore Update Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [truckId]);

  const deleteRecord = useCallback(async (recordId: string) => {
    if (!truckId) return false;
    const path = `trucks/${truckId}/serviceHistory/${recordId}`;
    try {
      await deleteDoc(doc(db, `trucks/${truckId}/serviceHistory`, recordId));
      return true;
    } catch (err) {
      console.error("Firestore Delete Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, [truckId]);

  useEffect(() => {
    if (!truckId) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const path = `trucks/${truckId}/serviceHistory`;
    const q = query(
      collection(db, path),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ServiceRecord[];
      
      setRecords(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [truckId]);

  return { records, loading, error, addRecord, updateRecord, deleteRecord };
}
