import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { Task } from '../../../types';

// Team-member-side hook: lists tasks assigned to the signed-in user (live) and lets
// them mark a task done/undone. Queries by assigneeEmail because it is stable across
// the pending -> active team_members uid reconciliation in useAuth.
export function useMyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const path = 'tasks';
    const q = query(collection(db, 'tasks'), where('assigneeEmail', '==', user.email));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: Task[] = [];
      snapshot.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as Task);
      });
      // Open tasks first, then by newest.
      results.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return b.createdAt.localeCompare(a.createdAt);
      });
      setTasks(results);
      setLoading(false);
    }, (err) => {
      console.error('Firestore Subscribe MyTasks Error:', err);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, path);
      }
    });

    return () => unsubscribe();
  }, [user?.email]);

  const toggleDone = useCallback(async (taskId: string, done: boolean) => {
    if (!user) return false;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        done,
        completedAt: done ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (err) {
      console.error('Firestore Toggle MyTask Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
      return false;
    }
  }, [user]);

  const openCount = tasks.filter((t) => !t.done).length;

  return { tasks, loading, openCount, toggleDone };
}
