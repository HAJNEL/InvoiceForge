import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { PayrollSubmission } from '../../../types';

// Owner id is passed explicitly so this works both for the main account and for a team
// member acting on the owner's behalf, matching usePayrollAdjustments.ts / useTimeLogs.ts.
export function usePayrollSubmissions(ownerId?: string | null) {
  const { user } = useAuth();
  const effectiveOwnerId = ownerId ?? user?.uid ?? null;
  const [submissions, setSubmissions] = useState<PayrollSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deterministic doc id per user+period means this is always a single upsert - a
  // re-push overwrites the prior submission record for that period rather than
  // accumulating history.
  const upsertSubmission = useCallback(async (periodKey: string, data: Omit<PayrollSubmission, 'id' | 'userId' | 'periodKey' | 'createdAt' | 'updatedAt'>) => {
    if (!effectiveOwnerId) return false;
    const id = `${effectiveOwnerId}_${periodKey}`;
    const path = `payroll_submissions/${id}`;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'payroll_submissions', id), {
        ...data,
        periodKey,
        userId: effectiveOwnerId,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('Firestore Set Payroll Submission Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [effectiveOwnerId]);

  useEffect(() => {
    if (!effectiveOwnerId) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    const path = 'payroll_submissions';
    const q = query(collection(db, path), where('userId', '==', effectiveOwnerId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PayrollSubmission[];
      setSubmissions(data);
      setLoading(false);
    }, (err) => {
      console.error('Firestore Subscribe Payroll Submissions Error:', err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [effectiveOwnerId]);

  return { submissions, loading, error, upsertSubmission };
}
