import { useState, useEffect, useCallback } from 'react';
import { onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';
import { ZohoCredentials } from '../../../types';

// Zoho Books OAuth credentials, one document per user at zoho_credentials/{uid}.
// Kept out of the (publicly-readable) `settings` collection - see firestore.rules.
export function useZohoCredentials() {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState<ZohoCredentials | null>(null);
  const [loading, setLoading] = useState(true);

  const saveCredentials = useCallback(async (data: Partial<ZohoCredentials>) => {
    if (!user) return false;
    const path = `zoho_credentials/${user.uid}`;
    try {
      if (credentials) {
        await updateDoc(doc(db, 'zoho_credentials', user.uid), {
          ...data,
          userId: user.uid,
          updatedAt: new Date().toISOString()
        });
      } else {
        await setDoc(doc(db, 'zoho_credentials', user.uid), {
          ...data,
          userId: user.uid,
          updatedAt: new Date().toISOString()
        });
      }
      return true;
    } catch (err) {
      console.error('Firestore Save Zoho Credentials Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [user, credentials]);

  useEffect(() => {
    if (!user) {
      setCredentials(null);
      setLoading(false);
      return;
    }

    const path = 'zoho_credentials';
    const docRef = doc(db, path, user.uid);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      setCredentials(docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as ZohoCredentials) : null);
      setLoading(false);
    }, (err) => {
      console.error('Firestore Subscribe Zoho Credentials Error:', err);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.GET, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { credentials, loading, saveCredentials };
}
