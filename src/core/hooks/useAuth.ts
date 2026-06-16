import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

interface AuthState {
  user: User | null;
  isTeamMember: boolean | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isTeamMember: null,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setState((prev) => (prev.loading ? prev : { ...prev, loading: true }));
        try {
          const q = query(
            collection(db, 'team_members'),
            where('userId', '==', firebaseUser.uid),
            limit(1)
          );
          const snap = await getDocs(q);
          const isTeam = !snap.empty;
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

    return () => unsubscribe();
  }, []);

  return { user: state.user, loading: state.loading, isTeamMember: state.isTeamMember };
}

