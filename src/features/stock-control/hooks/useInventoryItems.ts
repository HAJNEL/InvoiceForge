import { useCallback, useSyncExternalStore } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

// Richer view of the `inventory` collection than useProducts.ts's flat qty map —
// Stock Control needs the doc id (to allocate against) and reservedQty (to derive
// Available), neither of which the shared products/inventory cache exposes.
// Firestore supports multiple independent listeners on the same collection; this
// mirrors the pattern StockScreen.tsx already uses for its own 'inventory' subscription.
export interface InventoryRow {
  id: string;
  stockCode: string;
  description: string;
  displayName: string;
  qty: number;
  reservedQty: number;
  available: number;
}

interface InventoryItemsState {
  items: InventoryRow[];
  loading: boolean;
  error: string | null;
}

let state: InventoryItemsState = { items: [], loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: InventoryItemsState) {
  state = next;
  notify();
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ items: [], loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'inventory';
  const q = query(collection(db, path), where('userId', '==', userId));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => {
      const v = d.data();
      const qty = typeof v.qty === 'number' ? v.qty : 0;
      const reservedQty = typeof v.reservedQty === 'number' ? v.reservedQty : 0;
      return {
        id: d.id,
        stockCode: v.stockCode || '',
        description: v.description || '',
        displayName: v.displayName || '',
        qty,
        reservedQty,
        available: Math.max(0, qty - reservedQty)
      } as InventoryRow;
    });

    data.sort((a, b) => a.stockCode.localeCompare(b.stockCode));
    setState({ items: data, loading: false, error: null });
  }, (err) => {
    console.error('Firestore Subscribe Inventory Rows Error:', err);
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

export function useInventoryItems() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const invState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

  return { items: invState.items, loading: invState.loading, error: invState.error };
}
