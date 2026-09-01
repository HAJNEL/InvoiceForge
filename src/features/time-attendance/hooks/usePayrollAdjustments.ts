import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { PayrollAdjustment } from '../../../types';

export interface PayrollAdjustmentEntry {
  deductions: number;
  shortPayment: number;
  note?: string;
}

// Owner id is passed explicitly so this works both for the main account and for a team
// member acting on the owner's behalf, matching useTimeLogs.ts / useRateGroups.ts.
export function usePayrollAdjustments(ownerId?: string | null) {
  const { user } = useAuth();
  const effectiveOwnerId = ownerId ?? user?.uid ?? null;
  const [adjustments, setAdjustments] = useState<PayrollAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Deterministic doc id per staff+period means this is always a single upsert, never a
  // query-then-write race between two people editing the same period.
  const setAdjustment = useCallback(async (staffId: string, periodKey: string, entry: PayrollAdjustmentEntry) => {
    if (!effectiveOwnerId) return false;
    const id = `${staffId}_${periodKey}`;
    const path = `payroll_adjustments/${id}`;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'payroll_adjustments', id), {
        staffId,
        periodKey,
        deductions: entry.deductions,
        shortPayment: entry.shortPayment,
        note: entry.note ?? null,
        userId: effectiveOwnerId,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
      return true;
    } catch (err) {
      console.error("Firestore Set Payroll Adjustment Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [effectiveOwnerId]);

  useEffect(() => {
    if (!effectiveOwnerId) {
      setAdjustments([]);
      setLoading(false);
      return;
    }

    const path = 'payroll_adjustments';
    const q = query(collection(db, path), where('userId', '==', effectiveOwnerId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PayrollAdjustment[];
      setAdjustments(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe Payroll Adjustments Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [effectiveOwnerId]);

  return { adjustments, loading, error, setAdjustment };
}
