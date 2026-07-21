import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface KpiTemplates {
  id: string;
  userId: string;
  employeeProductIds: string[];
  truckProductIds: string[];
  updatedAt?: string;
}

export type KpiTemplateKind = 'employee' | 'truck';

export function useKpiTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<KpiTemplates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveTemplate = useCallback(async (kind: KpiTemplateKind, productIds: string[]) => {
    if (!user) return false;
    const path = `kpiTemplates/${user.uid}`;
    const field = kind === 'employee' ? 'employeeProductIds' : 'truckProductIds';
    try {
      if (templates) {
        await updateDoc(doc(db, 'kpiTemplates', user.uid), {
          [field]: productIds,
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(doc(db, 'kpiTemplates', user.uid), {
          employeeProductIds: kind === 'employee' ? productIds : [],
          truckProductIds: kind === 'truck' ? productIds : [],
          userId: user.uid,
          updatedAt: new Date().toISOString()
        });
      }
      return true;
    } catch (err) {
      console.error("Firestore Save KPI Templates Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [user, templates]);

  useEffect(() => {
    if (!user) {
      setTemplates(null);
      setLoading(false);
      return;
    }

    const path = 'kpiTemplates';
    const docRef = doc(db, 'kpiTemplates', user.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const v = docSnap.data();
        setTemplates({
          id: docSnap.id,
          userId: v.userId || '',
          employeeProductIds: Array.isArray(v.employeeProductIds) ? v.employeeProductIds : [],
          truckProductIds: Array.isArray(v.truckProductIds) ? v.truckProductIds : [],
          updatedAt: v.updatedAt
        });
      } else {
        setTemplates(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe KPI Templates Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { templates, loading, error, saveTemplate };
}
