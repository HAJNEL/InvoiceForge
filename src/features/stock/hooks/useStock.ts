import { useCallback, useSyncExternalStore } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface StockPart {
  partCode: string;
  description: string;
  qty: number;
}

export interface KnockdownItem {
  id: string;
  userId: string;
  stockCode: string;
  description: string;
  qty: number;
  displayName: string;
  type: 'knockdown' | 'assembled' | 'pre-assembled' | 'stock-take' | 'consumable';
  parts: StockPart[];
  imageBase64?: string;
  createdAt: string;
  updatedAt?: string;
}

interface StockState {
  stockItems: KnockdownItem[];
  loading: boolean;
  error: string | null;
}

// Module-level shared cache - see useTrips.ts for the rationale. useStock() is
// called from StockScreen, ProductList, and both KnockdownSetupDialog variants
// (the latter unconditionally mounted alongside ProductList's own call), each
// previously opening its own listener over the same collection.
let state: StockState = { stockItems: [], loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: StockState) {
  state = next;
  notify();
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ stockItems: [], loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'knockdown_items';
  const q = query(collection(db, path), where('userId', '==', userId));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        userId: d.userId,
        stockCode: d.stockCode || '',
        description: d.description || '',
        qty: typeof d.qty === 'number' ? d.qty : 0,
        displayName: d.displayName || '',
        type: (d.type || 'knockdown') as KnockdownItem['type'],
        imageBase64: d.imageBase64 || undefined,
        parts: (d.parts as StockPart[] || []).map((p) => ({
          partCode: p.partCode || '',
          description: p.description || '',
          qty: typeof p.qty === 'number' ? p.qty : 0
        })),
        createdAt: d.createdAt || ''
      };
    });

    // Sort by creation date or stockCode
    data.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setState({ stockItems: data, loading: false, error: null });
  }, (err) => {
    console.error("Firestore Subscribe Stock Error:", err);
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

export function useStock() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const stockState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

  const saveStockItem = useCallback(async (item: Omit<KnockdownItem, 'id' | 'userId' | 'createdAt'> & { id?: string }) => {
    if (!user) return null;

    const itemId = item.id || doc(collection(db, 'knockdown_items')).id;
    const path = `knockdown_items/${itemId}`;

    const saveData: Omit<KnockdownItem, 'id'> = {
      userId: user.uid,
      stockCode: item.stockCode,
      description: item.description,
      qty: item.qty,
      displayName: item.displayName,
      type: item.type || 'knockdown',
      parts: item.parts || [],
      ...(item.imageBase64 ? { imageBase64: item.imageBase64 } : {}),
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'knockdown_items', itemId), saveData);
      return { id: itemId, ...saveData };
    } catch (err) {
      console.error("Firestore Save Stock Item Error:", err);
      handleFirestoreError(err, OperationType.WRITE, path);
      return null;
    }
  }, [user]);

  const updateTypeAndQty = useCallback(async (id: string, updates: Partial<Pick<KnockdownItem, 'type' | 'qty' | 'displayName' | 'parts'>>) => {
    const path = `knockdown_items/${id}`;
    try {
      await updateDoc(doc(db, 'knockdown_items', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Firestore Update Stock Item Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteStockItem = useCallback(async (id: string) => {
    const path = `knockdown_items/${id}`;
    try {
      await deleteDoc(doc(db, 'knockdown_items', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Stock Item Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  return { stockItems: stockState.stockItems, loading: stockState.loading, error: stockState.error, saveStockItem, updateTypeAndQty, deleteStockItem };
}
