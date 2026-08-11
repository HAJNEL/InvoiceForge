import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { TimeLog } from '../../../types';
import { computeHours } from '../utils';

export { computeHours };

export interface TimeLogEntry {
  staffId: string;
  date: string;
  clockIn: string;
  clockOut: string;
  teaBreak?: boolean;
  teaBreakStart?: string;
  teaBreakEnd?: string;
  lunchBreak?: boolean;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  breakMinutes?: number;
  note?: string;
}

// Firestore's addDoc/updateDoc/batch.set reject `undefined` field values (e.g. an omitted note).
function nullifyUndefined<T extends object>(value: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    result[key] = v === undefined ? null : v;
  }
  return result as T;
}

// Owner id is passed explicitly (rather than always using the caller's own uid) so this
// hook works both for the main account and for a team member logging on the owner's behalf
// from the Team Dashboard (see useTeamDashboard.ts / TeamAttendancePanel).
export function useTimeLogs(ownerId?: string | null, loggedByTeamMemberId?: string) {
  const { user } = useAuth();
  const effectiveOwnerId = ownerId ?? user?.uid ?? null;
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addTimeLog = useCallback(async (entry: TimeLogEntry) => {
    if (!effectiveOwnerId) return null;
    const path = 'time_logs';
    try {
      const now = new Date().toISOString();
      const docRef = await addDoc(collection(db, path), nullifyUndefined({
        ...entry,
        hours: computeHours(entry.clockIn, entry.clockOut, entry.breakMinutes || 0),
        userId: effectiveOwnerId,
        ...(loggedByTeamMemberId ? { loggedByTeamMemberId } : {}),
        createdAt: now,
        updatedAt: now
      }));
      return docRef.id;
    } catch (err) {
      console.error("Firestore Add Time Log Error:", err);
      handleFirestoreError(err, OperationType.CREATE, path);
      return null;
    }
  }, [effectiveOwnerId, loggedByTeamMemberId]);

  const addTimeLogsBulk = useCallback(async (entries: TimeLogEntry[]) => {
    if (!effectiveOwnerId || entries.length === 0) return false;
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      entries.forEach(entry => {
        const docRef = doc(collection(db, 'time_logs'));
        batch.set(docRef, nullifyUndefined({
          ...entry,
          hours: computeHours(entry.clockIn, entry.clockOut, entry.breakMinutes || 0),
          userId: effectiveOwnerId,
          ...(loggedByTeamMemberId ? { loggedByTeamMemberId } : {}),
          createdAt: now,
          updatedAt: now
        }));
      });
      await batch.commit();
      return true;
    } catch (err) {
      console.error("Firestore Bulk Add Time Logs Error:", err);
      handleFirestoreError(err, OperationType.CREATE, 'time_logs');
      return false;
    }
  }, [effectiveOwnerId, loggedByTeamMemberId]);

  const updateTimeLog = useCallback(async (id: string, entry: Partial<TimeLogEntry>) => {
    const path = `time_logs/${id}`;
    try {
      const updates: Partial<TimeLog> = { ...entry, updatedAt: new Date().toISOString() };
      if (entry.clockIn && entry.clockOut) {
        updates.hours = computeHours(entry.clockIn, entry.clockOut, entry.breakMinutes || 0);
      }
      await updateDoc(doc(db, 'time_logs', id), nullifyUndefined(updates));
      return true;
    } catch (err) {
      console.error("Firestore Update Time Log Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, []);

  const deleteTimeLog = useCallback(async (id: string) => {
    const path = `time_logs/${id}`;
    try {
      await deleteDoc(doc(db, 'time_logs', id));
      return true;
    } catch (err) {
      console.error("Firestore Delete Time Log Error:", err);
      handleFirestoreError(err, OperationType.DELETE, path);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!effectiveOwnerId) {
      setTimeLogs([]);
      setLoading(false);
      return;
    }

    const path = 'time_logs';
    const q = query(collection(db, path), where('userId', '==', effectiveOwnerId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as TimeLog[];
      data.sort((a, b) => b.date.localeCompare(a.date));
      setTimeLogs(data);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe Time Logs Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [effectiveOwnerId]);

  return { timeLogs, loading, error, addTimeLog, addTimeLogsBulk, updateTimeLog, deleteTimeLog };
}
