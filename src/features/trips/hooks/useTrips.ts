import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { Trip } from '../../../types';

export function useTrips() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addTrip = useCallback(async (tripData: Omit<Trip, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return null;
    const path = 'trips';
    try {
      const docRef = await addDoc(collection(db, path), {
        ...tripData,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (err) {
      console.error("Firestore Add Error:", err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return null;
    }
  }, [user]);

  const updateTrip = useCallback(async (id: string, tripData: Partial<Trip>) => {
    const path = `trips/${id}`;
    try {
      await updateDoc(doc(db, 'trips', id), {
        ...tripData,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Firestore Update Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteTrip = useCallback(async (id: string) => {
    const path = `trips/${id}`;
    try {
      // Find the trip dynamically from our state to get the associated invoices
      const trip = trips.find(t => t.id === id);
      if (trip && trip.invoiceIds && trip.invoiceIds.length > 0) {
        await Promise.all(
          trip.invoiceIds.map(async (invoiceId) => {
            try {
              await updateDoc(doc(db, 'invoices', invoiceId), {
                status: 'draft',
                updatedAt: new Date().toISOString()
              });
            } catch (invErr) {
              console.error(`Failed to update invoice ${invoiceId} to draft layout upon trip deletion:`, invErr);
            }
          })
        );
      }
      await deleteDoc(doc(db, 'trips', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, [trips]);

  useEffect(() => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    const path = 'trips';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Trip[];
      
      data.sort((a, b) => b.date.localeCompare(a.date));
      
      setTrips(data);
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

  return { trips, loading, error, addTrip, updateTrip, deleteTrip };
}
