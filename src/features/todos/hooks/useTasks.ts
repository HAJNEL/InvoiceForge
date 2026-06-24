import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, collection, query, where, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { sendNotification } from '../../../lib/notifications';
import { Task } from '../../../types';

// Owner-side hook: lists every task this account owns (live) and exposes CRUD.
// When a task is assigned to a team member (not the owner themselves), a best-effort
// Pushover notification is fired via the existing /api/notify flow.
export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    const path = 'tasks';
    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: Task[] = [];
      snapshot.forEach((d) => {
        results.push({ id: d.id, ...d.data() } as Task);
      });
      // Newest first within each group
      results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setTasks(results);
      setLoading(false);
    }, (err) => {
      console.error('Firestore Subscribe Tasks Error:', err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Notify the assignee if it's a team member (the owner doesn't push to themselves).
  const notifyAssignee = useCallback((task: Pick<Task, 'assigneeId' | 'title'>) => {
    if (!user || task.assigneeId === user.uid) return;
    sendNotification({
      to: { type: 'member', id: task.assigneeId },
      title: 'New task assigned',
      message: task.title,
    }).catch(() => { /* best-effort */ });
  }, [user]);

  const addTask = useCallback(async (
    data: { title: string; note?: string; assigneeId: string; assigneeEmail: string; assigneeName: string }
  ) => {
    if (!user) return null;
    const taskId = crypto.randomUUID();
    const now = new Date().toISOString();
    const newTask: Task = {
      id: taskId,
      userId: user.uid,
      assigneeId: data.assigneeId,
      assigneeEmail: data.assigneeEmail,
      assigneeName: data.assigneeName,
      title: data.title,
      note: data.note || '',
      done: false,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'tasks', taskId), newTask);
      notifyAssignee(newTask);
      return newTask;
    } catch (err) {
      console.error('Firestore Create Task Error:', err);
      handleFirestoreError(err, OperationType.CREATE, `tasks/${taskId}`);
      return null;
    }
  }, [user, notifyAssignee]);

  const updateTask = useCallback(async (
    task: Task,
    data: { title: string; note?: string; assigneeId: string; assigneeEmail: string; assigneeName: string }
  ) => {
    if (!user) return false;
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        title: data.title,
        note: data.note || '',
        assigneeId: data.assigneeId,
        assigneeEmail: data.assigneeEmail,
        assigneeName: data.assigneeName,
        updatedAt: new Date().toISOString(),
      });
      // Notify when the task was reassigned to a different team member.
      if (data.assigneeId !== task.assigneeId) {
        notifyAssignee({ assigneeId: data.assigneeId, title: data.title });
      }
      return true;
    } catch (err) {
      console.error('Firestore Update Task Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${task.id}`);
      return false;
    }
  }, [user, notifyAssignee]);

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
      console.error('Firestore Toggle Task Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
      return false;
    }
  }, [user]);

  const deleteTask = useCallback(async (taskId: string) => {
    if (!user) return false;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      return true;
    } catch (err) {
      console.error('Firestore Delete Task Error:', err);
      handleFirestoreError(err, OperationType.DELETE, `tasks/${taskId}`);
      return false;
    }
  }, [user]);

  return { tasks, loading, error, addTask, updateTask, toggleDone, deleteTask };
}
