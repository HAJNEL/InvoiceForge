import { useCallback, useSyncExternalStore } from 'react';
import { onSnapshot, collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { Task } from '../../../types';

interface MyTasksState {
  tasks: Task[];
  loading: boolean;
}

// Module-level shared cache - see useTrips.ts for the rationale. useMyTasks() is
// called from the desktop and mobile task drawers plus TeamDashboard (which only
// needs openCount), each previously opening its own listener. Keyed by email
// (not uid) since that's what the underlying query filters on.
let state: MyTasksState = { tasks: [], loading: true };
let subscribedEmail: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: MyTasksState) {
  state = next;
  notify();
}

function ensureSubscription(email: string | null) {
  if (email === subscribedEmail) return;
  subscribedEmail = email;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!email) {
    setState({ tasks: [], loading: false });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'tasks';
  const q = query(collection(db, 'tasks'), where('assigneeEmail', '==', email));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    const results: Task[] = [];
    snapshot.forEach((d) => {
      results.push({ id: d.id, ...d.data() } as Task);
    });
    // Open tasks first, then by newest.
    results.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });
    setState({ tasks: results, loading: false });
  }, (err) => {
    console.error('Firestore Subscribe MyTasks Error:', err);
    setState({ ...state, loading: false });
    if (err.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.GET, path);
    }
  });
}

function subscribe(email: string | null) {
  return (listener: () => void) => {
    listeners.add(listener);
    ensureSubscription(email);
    return () => {
      listeners.delete(listener);
    };
  };
}

function getSnapshot() {
  return state;
}

// Team-member-side hook: lists tasks assigned to the signed-in user (live) and lets
// them mark a task done/undone. Queries by assigneeEmail because it is stable across
// the pending -> active team_members uid reconciliation in useAuth.
export function useMyTasks() {
  const { user } = useAuth();
  const email = user?.email ?? null;

  const myTasksState = useSyncExternalStore(
    useCallback((listener) => subscribe(email)(listener), [email]),
    getSnapshot
  );

  const toggleDone = useCallback(async (taskId: string, done: boolean) => {
    if (!user) return false;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        done,
        completedAt: done ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (err) {
      console.error('Firestore Toggle MyTask Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
      return false;
    }
  }, [user]);

  const openCount = myTasksState.tasks.filter((t) => !t.done).length;

  return { tasks: myTasksState.tasks, loading: myTasksState.loading, openCount, toggleDone };
}
