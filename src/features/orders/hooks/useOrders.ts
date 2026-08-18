import { useCallback, useSyncExternalStore } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface OrderLineItem {
  stockCode: string;
  qty: number;
}

export type OrderStatus = 'Active' | 'Complete';

export interface Order {
  id: string;
  userId: string;
  schoolId: string;
  clientNumber: string;
  schoolName: string;
  area: string;
  schoolType: string;
  orderNumber: string;
  status: OrderStatus;
  lineItems: OrderLineItem[];
  createdAt: string;
  updatedAt: string;
}

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: string | null;
}

// Module-level shared cache, same rationale/pattern as useStock.ts / useInvoices.ts —
// avoids every screen that reads orders (list, and later any Stock Control style
// consumer) opening its own listener over the same collection.
let state: OrdersState = { orders: [], loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: OrdersState) {
  state = next;
  notify();
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ orders: [], loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'orders';
  const q = query(collection(db, path), where('userId', '==', userId));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => {
      const v = d.data();
      return {
        id: d.id,
        userId: v.userId,
        schoolId: v.schoolId || '',
        clientNumber: v.clientNumber || '',
        schoolName: v.schoolName || '',
        area: v.area || '',
        schoolType: v.schoolType || '',
        orderNumber: v.orderNumber || '',
        status: v.status === 'Complete' ? 'Complete' : 'Active',
        lineItems: (Array.isArray(v.lineItems) ? v.lineItems : []).map((l: { stockCode?: string; qty?: number }) => ({
          stockCode: l.stockCode || '',
          qty: typeof l.qty === 'number' ? l.qty : 0
        })),
        createdAt: v.createdAt || '',
        updatedAt: v.updatedAt || ''
      } as Order;
    });

    data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setState({ orders: data, loading: false, error: null });
  }, (err) => {
    console.error('Firestore Subscribe Orders Error:', err);
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

export function useOrders() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const ordersState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

  const addOrder = useCallback(async (data: Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return null;
    const path = 'orders';
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
      console.error('Firestore Add Order Error:', err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return null;
    }
  }, [user]);

  const updateOrder = useCallback(async (id: string, data: Partial<Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>) => {
    const path = `orders/${id}`;
    try {
      await updateDoc(doc(db, 'orders', id), {
        ...data,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error('Firestore Update Order Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteOrder = useCallback(async (id: string) => {
    const path = `orders/${id}`;
    try {
      await deleteDoc(doc(db, 'orders', id));
      return true;
    } catch (err) {
      console.error('Firestore Delete Order Error:', err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  const deleteOrders = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return true;
    try {
      // Firestore batches cap at 500 writes, so chunk large selections.
      for (let i = 0; i < ids.length; i += 500) {
        const batch = writeBatch(db);
        ids.slice(i, i + 500).forEach(id => batch.delete(doc(db, 'orders', id)));
        await batch.commit();
      }
      return true;
    } catch (err) {
      console.error('Firestore Bulk Delete Orders Error:', err);
      handleFirestoreError(err, OperationType.DELETE, 'orders');
      return false;
    }
  }, []);

  return {
    orders: ordersState.orders,
    loading: ordersState.loading,
    error: ordersState.error,
    addOrder,
    updateOrder,
    deleteOrder,
    deleteOrders
  };
}
