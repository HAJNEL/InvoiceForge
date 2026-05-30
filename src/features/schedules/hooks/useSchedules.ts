import { useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface Schedule {
  id: string;
  day: string;
  truckId: string;
  invoiceIds: string[];
  userId: string;
  createdAt: unknown;
}

export function useSchedules() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scheduledInvoiceIds = useMemo(() => {
    const ids = new Set<string>();
    schedules.forEach(s => s.invoiceIds.forEach(id => ids.add(id)));
    return ids;
  }, [schedules]);

  const addSchedule = useCallback(async (schedule: Omit<Schedule, 'id' | 'userId' | 'createdAt'>) => {
    if (!user) return null;
    const path = 'schedules';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...schedule,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (err) {
      console.error("Firestore Add Error:", err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return null;
    }
  }, [user]);

  const updateSchedule = useCallback(async (id: string, schedule: Partial<Omit<Schedule, 'id' | 'userId' | 'createdAt'>>) => {
    if (!user) return false;
    const path = `schedules/${id}`;
    try {
      await updateDoc(doc(db, 'schedules', id), schedule);
      return true;
    } catch (err) {
      console.error("Firestore Update Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [user]);

  const deleteSchedule = useCallback(async (id: string) => {
    const path = `schedules/${id}`;
    try {
      await deleteDoc(doc(db, 'schedules', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    const path = 'schedules';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Schedule[];
      
      setSchedules(data);
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
  }, [user]);

  return { schedules, scheduledInvoiceIds, loading, error, addSchedule, updateSchedule, deleteSchedule };
}
