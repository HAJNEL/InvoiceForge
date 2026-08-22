import { useCallback, useSyncExternalStore } from 'react';
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
  // Client trucks are used for deliveries and are the only ones Order Builder's
  // Auto-Build considers; personal trucks are reserved for a future, separate
  // invoices-related use. Defaults to 'client' for docs written before this field
  // existed (see the snapshot mapping below) since every truck in this system so
  // far has been a real delivery truck.
  ownership: 'personal' | 'client';
  userId: string;
  createdAt: unknown;
}

interface TrucksState {
  trucks: Truck[];
  loading: boolean;
  error: string | null;
}

// Module-level shared cache - see useTrips.ts for the rationale. useTrucks() is
// called from Dashboard, Truck List, the KPI Trucks tab, Trip Form, and Trip
// List, each previously opening its own listener over the same collection.
let state: TrucksState = { trucks: [], loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: TrucksState) {
  state = next;
  notify();
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ trucks: [], loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'trucks';
  const q = query(collection(db, path), where('userId', '==', userId));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => {
      const v = doc.data();
      return {
        id: doc.id,
        ...v,
        ownership: v.ownership === 'personal' ? 'personal' : 'client'
      };
    }) as Truck[];

    setState({ trucks: data, loading: false, error: null });
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

export function useTrucks() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const trucksState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

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

  return { trucks: trucksState.trucks, loading: trucksState.loading, error: trucksState.error, addTruck, updateTruck, deleteTruck };
}
