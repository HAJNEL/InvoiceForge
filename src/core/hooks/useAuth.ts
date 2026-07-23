import { useSyncExternalStore } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, limit, doc, writeBatch, updateDoc } from 'firebase/firestore';

interface AuthState {
  user: User | null;
  isTeamMember: boolean | null;
  loading: boolean;
}

// Module-level shared store: onAuthStateChanged (and the team_members lookup it
// triggers) previously ran once per component that called useAuth() - every data
// hook in the app calls this internally, so a single screen could fire the same
// team_members query 5+ times. Now it runs once per session no matter how many
// components subscribe.
let state: AuthState = { user: null, isTeamMember: null, loading: true };
const listeners = new Set<() => void>();
let started = false;

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: AuthState) {
  state = next;
  notify();
}

function ensureStarted() {
  if (started) return;
  started = true;

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      setState({ ...state, loading: true });
      try {
        const q = query(
          collection(db, 'team_members'),
          where('userId', '==', firebaseUser.uid),
          limit(1)
        );
        const snap = await getDocs(q);
        let isTeam = !snap.empty;

        if (!isTeam && firebaseUser.email) {
          // Find any team member invitation with this email
          const qEmail = query(
            collection(db, 'team_members'),
            where('email', '==', firebaseUser.email),
            limit(1)
          );
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
            const oldDoc = snapEmail.docs[0];
            const oldData = oldDoc.data();

            // If the doc name is not already the firebaseUser.uid, let's reconcile it!
            if (oldDoc.id !== firebaseUser.uid) {
              const batch = writeBatch(db);
              const newRef = doc(db, 'team_members', firebaseUser.uid);
              const oldRef = doc(db, 'team_members', oldDoc.id);

              batch.set(newRef, {
                ...oldData,
                id: firebaseUser.uid,
                userId: firebaseUser.uid,
                status: 'active',
                updatedAt: new Date().toISOString()
              });
              batch.delete(oldRef);
              await batch.commit();
              isTeam = true;
            } else if (oldData.userId !== firebaseUser.uid || oldData.status !== 'active') {
              // If ID matches but fields are unlinked, update them
              const docRef = doc(db, 'team_members', firebaseUser.uid);
              await updateDoc(docRef, {
                userId: firebaseUser.uid,
                status: 'active',
                updatedAt: new Date().toISOString()
              });
              isTeam = true;
            }
          }
        }

        setState({
          user: firebaseUser,
          isTeamMember: isTeam,
          loading: false,
        });
      } catch (e) {
        console.error("useAuth team member check error:", e);
        setState({
          user: firebaseUser,
          isTeamMember: false,
          loading: false,
        });
      }
    } else {
      setState({
        user: null,
        isTeamMember: null,
        loading: false,
      });
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureStarted();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function useAuth() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
