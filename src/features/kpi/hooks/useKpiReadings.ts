import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

// One entry per product: units/hour rates indexed by team size (index 0 = 1 person … index 4 = 5 people)
export interface KpiReadingEntry {
  rates: (number | null)[];
}

export interface KpiReading {
  id: string;
  userId: string;
  date: string; // ISO date of the reading
  shiftHours: number;
  workingDaysPerMonth: number;
  entries: Record<string, KpiReadingEntry>; // keyed by product id
  createdAt?: string;
  updatedAt?: string;
}

export const TEAM_SIZES = [1, 2, 3, 4, 5];

export function bestRate(entry: KpiReadingEntry | undefined): number {
  if (!entry) return 0;
  return entry.rates.reduce<number>((max, r) => (typeof r === 'number' && r > max ? r : max), 0);
}

export function dailyOutput(entry: KpiReadingEntry | undefined, shiftHours: number): number {
  return Math.round(bestRate(entry) * shiftHours);
}

export function monthlyOutput(entry: KpiReadingEntry | undefined, shiftHours: number, workingDays: number): number {
  return Math.round(bestRate(entry) * shiftHours * workingDays);
}

export function useKpiReadings() {
  const { user } = useAuth();
  const [readings, setReadings] = useState<KpiReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addReading = useCallback(async (data: Omit<KpiReading, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return null;
    const path = 'kpiReadings';
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, path), {
        ...data,
        userId: user.uid,
        createdAt: now,
        updatedAt: now
      });
      return docRef.id;
    } catch (err) {
      console.error("Firestore Add KPI Reading Error:", err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return null;
    }
  }, [user]);

  const updateReading = useCallback(async (id: string, updates: Partial<Omit<KpiReading, 'id' | 'userId' | 'createdAt'>>) => {
    const path = `kpiReadings/${id}`;
    try {
      await updateDoc(doc(db, 'kpiReadings', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Firestore Update KPI Reading Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteReading = useCallback(async (id: string) => {
    const path = `kpiReadings/${id}`;
    try {
      await deleteDoc(doc(db, 'kpiReadings', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete KPI Reading Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setReadings([]);
      setLoading(false);
      return;
    }

    const path = 'kpiReadings';
    const q = query(collection(db, path), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => {
        const v = d.data();
        return {
          id: d.id,
          userId: v.userId || '',
          date: v.date || '',
          shiftHours: typeof v.shiftHours === 'number' ? v.shiftHours : 8,
          workingDaysPerMonth: typeof v.workingDaysPerMonth === 'number' ? v.workingDaysPerMonth : 22,
          entries: v.entries || {},
          createdAt: v.createdAt,
          updatedAt: v.updatedAt
        } as KpiReading;
      });
      // Newest first
      data.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      setReadings(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe KPI Readings Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { readings, loading, error, addReading, updateReading, deleteReading };
}
