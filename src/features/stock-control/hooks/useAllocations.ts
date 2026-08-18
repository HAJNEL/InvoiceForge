import { useCallback, useSyncExternalStore } from 'react';
import {
  collection, query, where, onSnapshot, doc, getDocs, runTransaction
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface StockAllocation {
  id: string;
  userId: string;
  invoiceId: string;
  orderNumber: string;
  schoolName: string;
  stockCode: string;
  qty: number;
  inventoryDocId: string;
  allocatedBy: string;
  allocatedByName: string;
  allocatedAt: string;
  releasedAt?: string | null;
}

interface AllocationsState {
  allocations: StockAllocation[];
  loading: boolean;
  error: string | null;
}

// Module-level shared cache, same rationale/pattern as useStock.ts / useProducts.ts.
let state: AllocationsState = { allocations: [], loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: AllocationsState) {
  state = next;
  notify();
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ allocations: [], loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'stock_allocations';
  const q = query(collection(db, path), where('userId', '==', userId));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => {
      const v = d.data();
      return {
        id: d.id,
        userId: v.userId,
        invoiceId: v.invoiceId || '',
        orderNumber: v.orderNumber || '',
        schoolName: v.schoolName || '',
        stockCode: v.stockCode || '',
        qty: typeof v.qty === 'number' ? v.qty : 0,
        inventoryDocId: v.inventoryDocId || '',
        allocatedBy: v.allocatedBy || '',
        allocatedByName: v.allocatedByName || '',
        allocatedAt: v.allocatedAt || '',
        releasedAt: v.releasedAt || null
      } as StockAllocation;
    });

    data.sort((a, b) => b.allocatedAt.localeCompare(a.allocatedAt));
    setState({ allocations: data, loading: false, error: null });
  }, (err) => {
    console.error('Firestore Subscribe Allocations Error:', err);
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

export function useAllocations() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const allocState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

  /**
   * Reserves `qty` units of `stockCode` against a school/order, atomically checking
   * `inventory.qty - inventory.reservedQty` inside a transaction so two concurrent
   * allocations can never both succeed against the same units (spec §53). Allocation
   * is a soft reservation only — it never touches `inventory.qty` itself, only the
   * `reservedQty` counter; physical deduction still happens where it always has, at
   * delivery time via validateAndSubtractInventory.
   */
  const allocateStock = useCallback(async (params: {
    invoiceId: string;
    orderNumber: string;
    schoolName: string;
    stockCode: string;
    qty: number;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not signed in.' };
    const requestedQty = Number(params.qty) || 0;
    const stockCode = params.stockCode.trim();
    if (requestedQty <= 0 || !stockCode) {
      return { success: false, error: 'Enter a valid quantity.' };
    }

    let invDocId: string;
    try {
      const invSnap = await getDocs(query(
        collection(db, 'inventory'),
        where('userId', '==', user.uid),
        where('stockCode', '==', stockCode)
      ));
      if (invSnap.empty) {
        return { success: false, error: `No inventory record found for stock code "${stockCode}".` };
      }
      invDocId = invSnap.docs[0].id;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'inventory');
      return { success: false, error: 'Could not look up inventory.' };
    }

    try {
      await runTransaction(db, async (tx) => {
        const invRef = doc(db, 'inventory', invDocId);
        const invSnap = await tx.get(invRef);
        if (!invSnap.exists()) {
          throw new Error(`No inventory record found for stock code "${stockCode}".`);
        }
        const invData = invSnap.data();
        const onHandQty = Number(invData.qty) || 0;
        const reservedQty = Number(invData.reservedQty) || 0;
        const available = onHandQty - reservedQty;

        if (requestedQty > available) {
          throw new Error(`Only ${Math.max(0, available)} units are available.`);
        }

        tx.update(invRef, {
          reservedQty: reservedQty + requestedQty,
          updatedAt: new Date().toISOString()
        });

        const allocRef = doc(collection(db, 'stock_allocations'));
        tx.set(allocRef, {
          userId: user.uid,
          invoiceId: params.invoiceId,
          orderNumber: params.orderNumber,
          schoolName: params.schoolName,
          stockCode,
          qty: requestedQty,
          inventoryDocId: invDocId,
          allocatedBy: user.uid,
          allocatedByName: user.email?.split('@')[0] || 'Unknown',
          allocatedAt: new Date().toISOString(),
          releasedAt: null
        });
      });
      return { success: true };
    } catch (err) {
      console.error('allocateStock transaction error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unable to allocate stock. Please try again.' };
    }
  }, [user]);

  /**
   * Releases a previously-made allocation (e.g. an order's quantity was reduced, or
   * the allocation is being consumed at delivery) — decrements inventory.reservedQty
   * back down transactionally and marks the ledger row released rather than deleting it,
   * preserving the audit trail.
   */
  const releaseAllocation = useCallback(async (allocationId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const allocRef = doc(db, 'stock_allocations', allocationId);
      await runTransaction(db, async (tx) => {
        const allocSnap = await tx.get(allocRef);
        if (!allocSnap.exists()) throw new Error('Allocation not found.');
        const allocData = allocSnap.data();
        if (allocData.releasedAt) return; // already released, no-op

        const invRef = doc(db, 'inventory', allocData.inventoryDocId);
        const invSnap = await tx.get(invRef);
        if (invSnap.exists()) {
          const invData = invSnap.data();
          const reservedQty = Number(invData.reservedQty) || 0;
          const qty = Number(allocData.qty) || 0;
          tx.update(invRef, {
            reservedQty: Math.max(0, reservedQty - qty),
            updatedAt: new Date().toISOString()
          });
        }

        tx.update(allocRef, { releasedAt: new Date().toISOString() });
      });
      return { success: true };
    } catch (err) {
      console.error('releaseAllocation transaction error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unable to release allocation.' };
    }
  }, []);

  return {
    allocations: allocState.allocations,
    loading: allocState.loading,
    error: allocState.error,
    allocateStock,
    releaseAllocation
  };
}
