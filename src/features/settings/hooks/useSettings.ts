import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { Settings } from '../../../types';

export function useSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveSettings = useCallback(async (data: Partial<Settings>) => {
    if (!user) return false;
    const path = `settings/${user.uid}`;
    try {
      if (settings) {
        await updateDoc(doc(db, 'settings', user.uid), {
          ...data,
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(doc(db, 'settings', user.uid), {
          ...data,
          userId: user.uid,
          updatedAt: new Date().toISOString()
        });
      }
      return true;
    } catch (err) {
      console.error("Firestore Save Settings Error:", err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [user, settings]);

  useEffect(() => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }

    const path = 'settings';
    // Use user.uid as the document ID for settings
    const docRef = doc(db, 'settings', user.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings({
          id: docSnap.id,
          ...docSnap.data()
        } as Settings);
      } else {
        setSettings(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore Subscribe Settings Error:", err);
      setError(err.message);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { settings, loading, error, saveSettings };
}
