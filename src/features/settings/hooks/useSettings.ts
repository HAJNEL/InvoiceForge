import { useCallback, useSyncExternalStore } from 'react';
import { onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { Settings } from '../../../types';

interface SettingsState {
  settings: Settings | null;
  loading: boolean;
  error: string | null;
}

// Module-level shared cache - see useTrips.ts for the rationale. useSettings()
// is called from the main Layout as well as several individual pages/modals
// (BulkImport, ExtractionReview, Trip Form, Trip List, Settings page itself),
// each previously opening its own doc listener for the same settings document.
let state: SettingsState = { settings: null, loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: SettingsState) {
  state = next;
  notify();
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ settings: null, loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'settings';
  const docRef = doc(db, 'settings', userId);

  unsubscribeFirestore = onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      setState({
        settings: { id: docSnap.id, ...docSnap.data() } as Settings,
        loading: false,
        error: null
      });
    } else {
      setState({ settings: null, loading: false, error: null });
    }
  }, (err) => {
    console.error("Firestore Subscribe Settings Error:", err);
    setState({ ...state, loading: false, error: err.message });
    if (err.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.GET, path);
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

export function useSettings() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const settingsState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

  const saveSettings = useCallback(async (data: Partial<Settings>) => {
    if (!user) return false;
    const path = `settings/${user.uid}`;
    try {
      if (state.settings) {
        await updateDoc(doc(db, 'settings', user.uid), {
          ...data,
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(doc(db, 'settings', user.uid), {
          ...data,
          userId: user.uid,
          updatedAt: new Date().toISOString()
        });
      }
      return true;
    } catch (err) {
      console.error("Firestore Save Settings Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [user]);

  return { settings: settingsState.settings, loading: settingsState.loading, error: settingsState.error, saveSettings };
}
