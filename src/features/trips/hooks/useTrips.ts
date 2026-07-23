import { useCallback, useSyncExternalStore } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { Trip } from '../../../types';

interface TripsState {
  trips: Trip[];
  loading: boolean;
  error: string | null;
}

// Module-level shared cache: previously every useTrips() call (the main Layout,
// Dashboard, Trip List, Trip Form, Daily Planner, Invoice List, ...) opened its
// own onSnapshot listener over the same query and re-mapped the same documents
// independently. Now the listener is opened once per logged-in user and shared.
let state: TripsState = { trips: [], loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: TripsState) {
  state = next;
  notify();
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ trips: [], loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'trips';
  const q = query(collection(db, path), where('userId', '==', userId));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Trip[];

    data.sort((a, b) => b.date.localeCompare(a.date));

    setState({ trips: data, loading: false, error: null });
  }, (err) => {
    console.error("Firestore Subscribe Error:", err);
    setState({ ...state, loading: false, error: err.message });
    if (err.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  });
}

function subscribe(userId: string | null) {
  return (listener: () => void) => {
    listeners.add(listener);
    ensureSubscription(userId);
    return () => {
      listeners.delete(listener);
    };
  };
}

function getSnapshot() {
  return state;
}

export function useTrips() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const tripsState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

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
      // Find the trip from the shared cache to get its associated invoices
      const trip = state.trips.find(t => t.id === id);
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
  }, []);

  return { trips: tripsState.trips, loading: tripsState.loading, error: tripsState.error, addTrip, updateTrip, deleteTrip };
}
