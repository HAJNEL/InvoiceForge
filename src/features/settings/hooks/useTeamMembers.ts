import { useCallback, useSyncExternalStore } from 'react';
import { onSnapshot, collection, query, where, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { TeamMember } from '../../../types';

interface TeamMembersState {
  members: TeamMember[];
  loading: boolean;
  error: string | null;
}

// Module-level shared cache - see useTrips.ts for the rationale. useTeamMembers()
// is called from TodoBoard and the Settings team members section.
let state: TeamMembersState = { members: [], loading: true, error: null };
let subscribedUserId: string | null | undefined = undefined;
let unsubscribeFirestore: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: TeamMembersState) {
  state = next;
  notify();
}

function ensureSubscription(userId: string | null) {
  if (userId === subscribedUserId) return;
  subscribedUserId = userId;
  unsubscribeFirestore?.();
  unsubscribeFirestore = null;

  if (!userId) {
    setState({ members: [], loading: false, error: null });
    return;
  }

  setState({ ...state, loading: true });

  const path = 'team_members';
  const q = query(collection(db, 'team_members'), where('ownerId', '==', userId));

  unsubscribeFirestore = onSnapshot(q, (snapshot) => {
    const results: TeamMember[] = [];
    snapshot.forEach((d) => {
      const item = {
        id: d.id,
        ...d.data()
      } as TeamMember;
      if (item.status !== 'deleted') {
        results.push(item);
      }
    });
    // Sort by createdAt descending
    results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setState({ members: results, loading: false, error: null });
  }, (err) => {
    console.error("Firestore Subscribe TeamMembers Error:", err);
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

export function useTeamMembers() {
  const { user } = useAuth();
  const userId = user?.uid ?? null;

  const teamMembersState = useSyncExternalStore(
    useCallback((listener) => subscribe(userId)(listener), [userId]),
    getSnapshot
  );

  const addTeamMember = useCallback(async (data: Omit<TeamMember, 'id' | 'ownerId' | 'status' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return null;
    const memberId = crypto.randomUUID();
    const docRef = doc(db, 'team_members', memberId);

    const newMember: TeamMember = {
      ...data,
      id: memberId,
      ownerId: user.uid,
      status: 'pending',
      userId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(docRef, newMember);
      return newMember;
    } catch (err) {
      console.error("Firestore Create Team Member Error:", err);
      handleFirestoreError(err, OperationType.CREATE, `team_members/${memberId}`);
      return null;
    }
  }, [user]);

  const updateTeamMember = useCallback(async (memberId: string, data: Partial<Omit<TeamMember, 'id' | 'ownerId' | 'email' | 'inviteCode' | 'createdAt' | 'updatedAt'>>) => {
    if (!user) return false;
    const docRef = doc(db, 'team_members', memberId);
    try {
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Firestore Update Team Member Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `team_members/${memberId}`);
      return false;
    }
  }, [user]);

  const deleteTeamMember = useCallback(async (member: TeamMember) => {
    if (!user) return false;
    const docRef = doc(db, 'team_members', member.id);
    try {
      if (member.status === 'active') {
        // The backend admin endpoint requires a verified Firebase ID token.
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) {
          console.error("Cannot delete team member: no authenticated session.");
          return false;
        }

        const response = await fetch('/api/team-members/delete-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ userId: member.id })
        });
        const resData = await response.json().catch(() => ({}));

        // If the backend rejected the request (auth/authorization/rate limit),
        // do NOT mark the member deleted — the Auth account still exists.
        if (response.status === 401 || response.status === 403 || response.status === 429) {
          console.error("Backend rejected team member deletion:", response.status, resData.error);
          return false;
        }
        if (!response.ok || !resData.success) {
          console.error("Failed to delete user Auth account on backend:", resData.error);
        } else {
          console.log("Successfully deleted user Auth account on backend during deletion.");
        }

        // Update member status to deleted in Firestore to immediately revoke access
        await updateDoc(docRef, {
          status: 'deleted',
          updatedAt: new Date().toISOString()
        });
        return true;
      } else {
        // Pending invitations can be deleted completely
        await deleteDoc(docRef);
        return true;
      }
    } catch (err) {
      console.error("Firestore Delete Team Member Error:", err);
      handleFirestoreError(err, OperationType.DELETE, `team_members/${member.id}`);
      return false;
    }
  }, [user]);

  return {
    members: teamMembersState.members,
    loading: teamMembersState.loading,
    error: teamMembersState.error,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember
  };
}
