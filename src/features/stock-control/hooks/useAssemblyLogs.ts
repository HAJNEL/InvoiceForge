import { useCallback, useSyncExternalStore } from 'react';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface AssemblyLog {
  id: string;
  userId: string;
  invoiceId: string;
  orderNumber: string;
  schoolName: string;
  stockCode: string;
  previousQty: number;
  newQty: number;
  change: number;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
}

interface AssemblyLogsState {
  logs: AssemblyLog[];
  loading: boolean;
  error: string | null;
}

// Module-level shared cache, same rationale/pattern as useStock.ts / useAllocations.ts.
let state: AssemblyLogsState = { logs: [], loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: AssemblyLogsState) {
  state = next;
  notify();
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ logs: [], loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'assembly_logs';
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
        previousQty: typeof v.previousQty === 'number' ? v.previousQty : 0,
        newQty: typeof v.newQty === 'number' ? v.newQty : 0,
        change: typeof v.change === 'number' ? v.change : 0,
        updatedBy: v.updatedBy || '',
        updatedByName: v.updatedByName || '',
        updatedAt: v.updatedAt || ''
      } as AssemblyLog;
    });

    data.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    setState({ logs: data, loading: false, error: null });
  }, (err) => {
    console.error('Firestore Subscribe Assembly Logs Error:', err);
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

export function useAssemblyLogs() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const logsState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

  /**
   * Records a build-quantity change for one SKU on one order. This is a pure
   * workflow-progress counter — it never touches `inventory.qty` (physical stock is
   * only deducted at delivery, see src/utils/inventory.ts). Callers are responsible
   * for capping `newQty` at the order line's reserved quantity before calling this;
   * see phaseCalculations.ts.
   */
  const recordAssemblyChange = useCallback(async (params: {
    invoiceId: string;
    orderNumber: string;
    schoolName: string;
    stockCode: string;
    previousQty: number;
    newQty: number;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not signed in.' };
    const path = 'assembly_logs';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        invoiceId: params.invoiceId,
        orderNumber: params.orderNumber,
        schoolName: params.schoolName,
        stockCode: params.stockCode.trim(),
        previousQty: params.previousQty,
        newQty: params.newQty,
        change: params.newQty - params.previousQty,
        updatedBy: user.uid,
        updatedByName: user.email?.split('@')[0] || 'Unknown',
        updatedAt: new Date().toISOString()
      });
      return { success: true };
    } catch (err) {
      console.error('recordAssemblyChange error:', err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return { success: false, error: 'Assembly quantity could not be updated.' };
    }
  }, [user]);

  return {
    logs: logsState.logs,
    loading: logsState.loading,
    error: logsState.error,
    recordAssemblyChange
  };
}
