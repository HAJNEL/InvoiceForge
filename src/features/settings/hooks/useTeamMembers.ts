import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, collection, query, where, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { TeamMember } from '../../../types';

export function useTeamMembers() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setMembers([]);
      setLoading(false);
      return;
    }

    const path = 'team_members';
    const q = query(collection(db, 'team_members'), where('ownerId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
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
      setMembers(results);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe TeamMembers Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

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
        const response = await fetch('/api/team-members/delete-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId: member.id })
        });
        const resData = await response.json();
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
    members,
    loading,
    error,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember
  };
}
