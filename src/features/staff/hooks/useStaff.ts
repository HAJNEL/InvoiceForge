import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { StaffMember } from '../../../types';

// Firestore's addDoc/updateDoc reject `undefined` field values (including nested), but the
// staff form deliberately produces them for empty optional fields (e.g. bankAccount.bankId).
// Converting to `null` (rather than omitting the key) also makes clearing a previously-set
// field on edit actually clear it in Firestore, instead of leaving the old value untouched.
function nullifyUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(nullifyUndefinedDeep) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      result[key] = v === undefined ? null : nullifyUndefinedDeep(v);
    }
    return result as T;
  }
  return value;
}

export function useStaff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addStaff = useCallback(async (data: Omit<StaffMember, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return null;
    const path = 'staff';
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, path), nullifyUndefinedDeep({
        ...data,
        userId: user.uid,
        createdAt: now,
        updatedAt: now
      }));
      return docRef.id;
    } catch (err) {
      console.error("Firestore Add Staff Error:", err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return null;
    }
  }, [user]);

  const updateStaff = useCallback(async (id: string, data: Partial<Omit<StaffMember, 'id' | 'userId' | 'createdAt'>>) => {
    const path = `staff/${id}`;
    try {
      await updateDoc(doc(db, 'staff', id), nullifyUndefinedDeep({
        ...data,
        updatedAt: new Date().toISOString()
      }));
      return true;
    } catch (err) {
      console.error("Firestore Update Staff Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteStaff = useCallback(async (id: string) => {
    const path = `staff/${id}`;
    try {
      await deleteDoc(doc(db, 'staff', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Staff Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setStaff([]);
      setLoading(false);
      return;
    }

    const path = 'staff';
    const q = query(collection(db, path), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as StaffMember[];
      data.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
      setStaff(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe Staff Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { staff, loading, error, addStaff, updateStaff, deleteStaff };
}
