import { useCallback, useSyncExternalStore } from 'react';
import { collection, query, where, onSnapshot, runTransaction, doc, getDoc, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
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
    updatedAt: (v.updatedAt as string) || '',
    truckId: (v.truckId as string) || undefined,
    truckName: (v.truckName as string) || undefined
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

// Best-effort concurrency guard: re-checks each target order's CURRENT buildId
// immediately before the write, so a teammate who just consumed one of these
// orders into a different build is caught instead of silently double-consuming
// it. `allowedBuildId` lets an update re-save orders already in the build being
// edited without tripping its own guard. This is not a hard guarantee (Firestore
// writeBatch can't span reads, and the check-to-write gap is real, if small) -
// consistent with how the rest of this app already handles Firestore write races
// (useOrders.ts's own updates aren't transactional either).
async function checkOrderConflicts(orderIds: string[], allowedBuildId: string | null): Promise<string | null> {
  if (orderIds.length === 0) return null;
  const snaps = await Promise.all(orderIds.map(id => getDoc(doc(db, 'orders', id))));
  for (const snap of snaps) {
    if (!snap.exists()) continue;
    const data = snap.data() as { buildId?: string; orderNumber?: string };
    if (data.buildId && data.buildId !== allowedBuildId) {
      return `Order ${data.orderNumber || snap.id} was just added to another build by someone else - please refresh and try again.`;
    }
  }
  return null;
}

// Creates a new build: atomically claims the next build number, writes the
// orderBuilds doc, and marks every referenced order consumed (buildId/buildNumber)
// - all via one or more writeBatch calls (chunked at 500 writes, same as
// useOrders.ts's deleteOrders). If the batch fails after the number was already
// claimed by getNextBuildNumber's transaction, that number is burned and skipped
// forever - an accepted tradeoff (see the data-model issue): trying to "return" a
// claimed number on failure would reintroduce the exact race the transaction
// exists to prevent. Throws on any failure (conflict or Firestore error) - the
// caller (the build screen's Save handler) is responsible for catching and
// surfacing err.message.
export async function createBuild(userId: string, deliveryDate: string, schoolGroups: OrderBuildSchoolGroup[]): Promise<{ id: string; buildNumber: string }> {
  const orderIds = schoolGroups.flatMap(g => g.orderIds);

  const conflict = await checkOrderConflicts(orderIds, null);
  if (conflict) throw new Error(conflict);

  const { buildNumber, year } = await getNextBuildNumber(userId);
  const now = new Date().toISOString();
  const buildRef = doc(collection(db, 'orderBuilds'));
  const buildData: Omit<OrderBuild, 'id'> = { userId, buildNumber, year, deliveryDate, schoolGroups, createdAt: now, updatedAt: now };

  try {
    let i = 0;
    do {
      const batch = writeBatch(db);
      if (i === 0) batch.set(buildRef, buildData);
      orderIds.slice(i, i + 500).forEach(oid => {
        batch.update(doc(db, 'orders', oid), { buildId: buildRef.id, buildNumber, updatedAt: now });
      });
      await batch.commit();
      i += 500;
    } while (i < orderIds.length);
    return { id: buildRef.id, buildNumber };
  } catch (err) {
    console.error('Firestore Create OrderBuild Error:', err);
    handleFirestoreError(err, OperationType.CREATE, 'orderBuilds');
    throw err;
  }
}

// Edits an existing build: diffs the new schoolGroups against the build's current
// ones to find newly-added vs. removed orders, releases removed orders
// (deleteField, not null - keeps the Order.buildId?/buildNumber? optionality
// contract intact) and consumes newly-added ones, then updates the orderBuilds doc
// itself. The build number/year never change here - only createBuild claims a new
// one. Throws on failure, same contract as createBuild.
export async function updateBuild(existingBuild: OrderBuild, deliveryDate: string, schoolGroups: OrderBuildSchoolGroup[]): Promise<void> {
  const newOrderIds = new Set(schoolGroups.flatMap(g => g.orderIds));
  const oldOrderIds = new Set(existingBuild.schoolGroups.flatMap(g => g.orderIds));
  const added = [...newOrderIds].filter(id => !oldOrderIds.has(id));
  const removed = [...oldOrderIds].filter(id => !newOrderIds.has(id));

  const conflict = await checkOrderConflicts(added, existingBuild.id);
  if (conflict) throw new Error(conflict);

  const now = new Date().toISOString();
  const buildRef = doc(db, 'orderBuilds', existingBuild.id);
  const orderOps = [
    ...added.map(id => ({ id, data: { buildId: existingBuild.id, buildNumber: existingBuild.buildNumber, updatedAt: now } })),
    ...removed.map(id => ({ id, data: { buildId: deleteField(), buildNumber: deleteField(), updatedAt: now } }))
  ];

  try {
    let i = 0;
    do {
      const batch = writeBatch(db);
      if (i === 0) batch.update(buildRef, { deliveryDate, schoolGroups, updatedAt: now });
      orderOps.slice(i, i + 500).forEach(op => batch.update(doc(db, 'orders', op.id), op.data));
      await batch.commit();
      i += 500;
    } while (i < orderOps.length);
  } catch (err) {
    console.error('Firestore Update OrderBuild Error:', err);
    handleFirestoreError(err, OperationType.UPDATE, `orderBuilds/${existingBuild.id}`);
  }
}

// Deletes a build and releases every order it consumed back to the "available to
// bundle" pool (deleteField on buildId/buildNumber). Throws on failure.
export async function deleteBuild(build: OrderBuild): Promise<void> {
  const orderIds = build.schoolGroups.flatMap(g => g.orderIds);
  const now = new Date().toISOString();
  const buildRef = doc(db, 'orderBuilds', build.id);

  try {
    let i = 0;
    do {
      const batch = writeBatch(db);
      if (i === 0) batch.delete(buildRef);
      orderIds.slice(i, i + 500).forEach(oid => {
        batch.update(doc(db, 'orders', oid), { buildId: deleteField(), buildNumber: deleteField(), updatedAt: now });
      });
      await batch.commit();
      i += 500;
    } while (i < orderIds.length);
  } catch (err) {
    console.error('Firestore Delete OrderBuild Error:', err);
    handleFirestoreError(err, OperationType.DELETE, `orderBuilds/${build.id}`);
  }
}
