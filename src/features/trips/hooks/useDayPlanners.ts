import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { DayPlanner, DayPlannerEntry } from '../../../types';
import { useTrips } from './useTrips';

// One planner doc per user per date - id = `${userId}_${date}` so there's always
// exactly one live doc for a given day, no query needed to find "the" planner.
function plannerId(userId: string, date: string) {
  return `${userId}_${date}`;
}

export function useDayPlanners() {
  const { user } = useAuth();
  const [planners, setPlanners] = useState<DayPlanner[]>([]);
  const [loading, setLoading] = useState(true);
  // A planner only makes sense while at least one trip exists for that date - pulled
  // in here (rather than left to whichever page happens to be mounted) so the rule
  // holds everywhere this hook is used (trips list, daily planner calendar, etc).
  const { trips, loading: tripsLoading } = useTrips();

  useEffect(() => {
    if (!user) {
      setPlanners([]);
      setLoading(false);
      return;
    }

    const path = 'day_planners';
    const q = query(collection(db, path), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as DayPlanner[];
      setPlanners(data);
      setLoading(false);
    }, (err) => {
      console.error('Firestore Subscribe Day Planners Error:', err);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Upserts the planner doc for `date` with the full entries array. Reordering is
  // just rewriting the array in the new order - array position IS drag order.
  const saveEntries = useCallback(async (date: string, entries: DayPlannerEntry[]) => {
    if (!user) return false;
    const id = plannerId(user.uid, date);
    const path = `day_planners/${id}`;
    try {
      const existing = planners.find(p => p.id === id);
      await setDoc(doc(db, 'day_planners', id), {
        userId: user.uid,
        date,
        entries,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return true;
    } catch (err) {
      console.error('Firestore Save Day Planner Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [user, planners]);

  const deletePlanner = useCallback(async (date: string) => {
    if (!user) return false;
    const id = plannerId(user.uid, date);
    try {
      await deleteDoc(doc(db, 'day_planners', id));
      return true;
    } catch (err) {
      console.error('Firestore Delete Day Planner Error:', err);
      handleFirestoreError(err, OperationType.DELETE, `day_planners/${id}`);
      return false;
    }
  }, [user]);

  // Once the last trip for a date is deleted/moved, its planner no longer has a
  // reason to exist - remove it. Guarded on both loading flags so this never runs
  // against a not-yet-loaded trips or planners list.
  useEffect(() => {
    if (tripsLoading || loading) return;
    planners.forEach((planner) => {
      const hasTripsForDate = trips.some(t => t.date === planner.date);
      if (!hasTripsForDate) {
        deletePlanner(planner.date);
      }
    });
  }, [trips, planners, tripsLoading, loading, deletePlanner]);

  return { planners, loading, tripDates: trips.map(t => t.date), saveEntries, deletePlanner };
}
