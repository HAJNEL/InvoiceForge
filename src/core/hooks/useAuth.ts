import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { collection, query, where, getDocs, limit, doc, writeBatch, updateDoc } from 'firebase/firestore';

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

    return () => unsubscribe();
  }, []);

  return { user: state.user, loading: state.loading, isTeamMember: state.isTeamMember };
}

