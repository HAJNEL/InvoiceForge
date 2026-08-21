import { useCallback, useSyncExternalStore } from 'react';
import { collection, query, where, onSnapshot, runTransaction, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import type { OrderBuild, OrderBuildSchoolGroup } from '../types';

// Atomically claims the next build number for `userId`'s sequence in the current
// calendar year, e.g. "00001". Scoped per (userId, year) - matches how every other
// collection in this app (orders, trips, ...) scopes data per owning account, and
// resets for free on Jan 1st since that year's counter doc simply doesn't exist yet
// (no explicit "reset" branch needed). Runs inside a Firestore transaction so two
// builds created at the same moment can never receive the same number - the
// transaction retries automatically on write contention.
export async function getNextBuildNumber(userId: string): Promise<{ buildNumber: string; year: number }> {
  const year = new Date().getFullYear();
  const counterRef = doc(db, 'buildCounters', `${userId}_${year}`);
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const last = snap.exists() ? (snap.data().lastNumber as number) : 0;
    const n = last + 1;
    tx.set(counterRef, { lastNumber: n }, { merge: true });
    return n;
  });
  return { buildNumber: String(next).padStart(5, '0'), year };
}

interface OrderBuildsState {
  builds: OrderBuild[];
  loading: boolean;
  error: string | null;
}

// Module-level shared cache, same rationale/pattern as useOrders.ts / useTrips.ts -
// avoids every screen that reads builds opening its own listener over the collection.
let state: OrderBuildsState = { builds: [], loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: OrderBuildsState) {
  state = next;
  notify();
}

function toOrderBuild(id: string, v: Record<string, unknown>): OrderBuild {
  return {
    id,
    userId: (v.userId as string) || '',
    buildNumber: (v.buildNumber as string) || '',
    year: typeof v.year === 'number' ? v.year : new Date().getFullYear(),
    deliveryDate: (v.deliveryDate as string) || '',
    schoolGroups: Array.isArray(v.schoolGroups) ? (v.schoolGroups as OrderBuildSchoolGroup[]) : [],
    createdAt: (v.createdAt as string) || '',
    updatedAt: (v.updatedAt as string) || ''
  };
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ builds: [], loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'orderBuilds';
  const q = query(collection(db, path), where('userId', '==', userId));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(d => toOrderBuild(d.id, d.data()));
    // Soonest upcoming delivery first - what a user opening this screen actually
    // wants to see, unlike the "newest created first" convention used elsewhere
    // (useOrders.ts, useTrips.ts) since this list is about what's coming up next.
    data.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
    setState({ builds: data, loading: false, error: null });
  }, (err) => {
    console.error('Firestore Subscribe OrderBuilds Error:', err);
    setState({ ...state, loading: false, error: err.message });
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

export function useOrderBuilds() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const orderBuildsState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

  return {
    builds: orderBuildsState.builds,
    loading: orderBuildsState.loading,
    error: orderBuildsState.error
  };
}
