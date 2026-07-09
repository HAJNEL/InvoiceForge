import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface FuelLog {
  id: string;
  truckId: string;
  liters: number;
  cost: number;
  fuelPrice: number;
  odometerReading: number;
  refuelDate: string;
  userId: string;
  createdAt: unknown;
}

export function useFuelLogs() {
  const { user } = useAuth();
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addFuelLog = useCallback(async (fuelLog: Omit<FuelLog, 'id' | 'userId' | 'createdAt'>) => {
    if (!user) return null;
    const path = 'fuel_logs';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...fuelLog,
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

  const updateFuelLog = useCallback(async (id: string, fuelLog: Partial<Omit<FuelLog, 'id' | 'userId' | 'createdAt'>>) => {
    const path = `fuel_logs/${id}`;
    try {
      await updateDoc(doc(db, 'fuel_logs', id), fuelLog);
      return true;
    } catch (err) {
      console.error("Firestore Update Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteFuelLog = useCallback(async (id: string) => {
    const path = `fuel_logs/${id}`;
    try {
      await deleteDoc(doc(db, 'fuel_logs', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setFuelLogs([]);
      setLoading(false);
      return;
    }

    const path = 'fuel_logs';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FuelLog[];

      setFuelLogs(data);
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

  // Total liters consumed across all logged refuels, shown as the FUEL KPI's
  // headline number on the dashboard.
  const totalLitersConsumed = fuelLogs.reduce((sum, log) => sum + (log.liters || 0), 0);

  return { fuelLogs, loading, error, addFuelLog, updateFuelLog, deleteFuelLog, totalLitersConsumed };
}
