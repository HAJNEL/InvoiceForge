import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface Truck {
  id: string;
  name: string;
  licensePlate: string;
  model?: string;
  make?: string;
  year?: number;
  vinNumber?: string;
  engineNumber?: string;
  capacityKg?: number;
  volumetricCapacity?: number;
  insuranceCompany?: string;
  insurancePolicyNumber?: string;
  insuranceExpiryDate?: string;
  licenseRenewalDate?: string;
  lastServiceDate?: string;
  nextServiceKm?: number;
  currentKm?: number;
  fuelType?: 'Diesel' | 'Petrol' | 'Gas';
  status?: 'Active' | 'Maintenance' | 'Inactive';
  maxValue?: number;
  userId: string;
  createdAt: unknown;
}

export function useTrucks() {
  const { user } = useAuth();
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addTruck = useCallback(async (truck: Omit<Truck, 'id' | 'userId' | 'createdAt'>) => {
    if (!user) return null;
    const path = 'trucks';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...truck,
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

  const updateTruck = useCallback(async (id: string, truck: Partial<Omit<Truck, 'id' | 'userId' | 'createdAt'>>) => {
    const path = `trucks/${id}`;
    try {
      await updateDoc(doc(db, 'trucks', id), truck);
      return true;
    } catch (err) {
      console.error("Firestore Update Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteTruck = useCallback(async (id: string) => {
    const path = `trucks/${id}`;
    try {
      await deleteDoc(doc(db, 'trucks', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setTrucks([]);
      setLoading(false);
      return;
    }

    const path = 'trucks';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Truck[];
      
      setTrucks(data);
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

  return { trucks, loading, error, addTruck, updateTruck, deleteTruck };
}
