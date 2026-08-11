import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { RateGroup, RateTier } from '../../../types';

export function useRateGroups() {
  const { user } = useAuth();
  const [rateGroups, setRateGroups] = useState<RateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addRateGroup = useCallback(async (name: string, tiers: RateTier[]) => {
    if (!user) return null;
    const path = 'rate_groups';
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, path), {
        name,
        tiers,
        userId: user.uid,
        createdAt: now,
        updatedAt: now
      });
      return docRef.id;
    } catch (err) {
      console.error("Firestore Add Rate Group Error:", err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return null;
    }
  }, [user]);

  const updateRateGroup = useCallback(async (id: string, data: Partial<Pick<RateGroup, 'name' | 'tiers'>>) => {
    const path = `rate_groups/${id}`;
    try {
      await updateDoc(doc(db, 'rate_groups', id), {
        ...data,
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error("Firestore Update Rate Group Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteRateGroup = useCallback(async (id: string) => {
    const path = `rate_groups/${id}`;
    try {
      await deleteDoc(doc(db, 'rate_groups', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Rate Group Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setRateGroups([]);
      setLoading(false);
      return;
    }

    const path = 'rate_groups';
    const q = query(collection(db, path), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as RateGroup[];
      data.sort((a, b) => a.name.localeCompare(b.name));
      setRateGroups(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe Rate Groups Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { rateGroups, loading, error, addRateGroup, updateRateGroup, deleteRateGroup };
}
