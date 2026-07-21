import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

// capacities[productId][truckId] = max units that fit on that truck
export type CapacityGrid = Record<string, Record<string, number | null>>;

export interface KpiTruckCapacity {
  id: string;
  userId: string;
  capacities: CapacityGrid;
  updatedAt?: string;
}

export function useKpiTruckCapacity() {
  const { user } = useAuth();
  const [capacityDoc, setCapacityDoc] = useState<KpiTruckCapacity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveCapacities = useCallback(async (capacities: CapacityGrid) => {
    if (!user) return false;
    const path = `kpiTruckCapacity/${user.uid}`;
    try {
      if (capacityDoc) {
        await updateDoc(doc(db, 'kpiTruckCapacity', user.uid), {
          capacities,
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(doc(db, 'kpiTruckCapacity', user.uid), {
          capacities,
          userId: user.uid,
          updatedAt: new Date().toISOString()
        });
      }
      return true;
    } catch (err) {
      console.error("Firestore Save KPI Truck Capacity Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [user, capacityDoc]);

  useEffect(() => {
    if (!user) {
      setCapacityDoc(null);
      setLoading(false);
      return;
    }

    const path = 'kpiTruckCapacity';
    const docRef = doc(db, 'kpiTruckCapacity', user.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const v = docSnap.data();
        setCapacityDoc({
          id: docSnap.id,
          userId: v.userId || '',
          capacities: v.capacities || {},
          updatedAt: v.updatedAt
        });
      } else {
        setCapacityDoc(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe KPI Truck Capacity Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { capacityDoc, loading, error, saveCapacities };
}
