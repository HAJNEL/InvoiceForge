import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../core/hooks/useAuth';
import { handleFirestoreError, OperationType } from '../../../lib/firestore-errors';

export interface ClientDistanceRecord {
  clientKey: string;
  clientName: string;
  distanceKm: number;
  // True once this distance has been confirmed via a self-invoice reaching
  // "Completed" - only completed records are trusted to auto-populate OTHER
  // invoices, so a distance saved while still editing an open bundle doesn't
  // silently propagate before it's actually confirmed.
  completed: boolean;
  updatedAt: string;
}

// Per-user, per-client doc id so repeat saves for the same school overwrite
// the same record instead of piling up duplicates.
function slugifyClientKey(clientName: string): string {
  return clientName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

// Caches a distance per client name so a returning school doesn't need a fresh
// Google Maps lookup every time. Written whenever a distance is saved in the
// Edit Client Invoice dialog; only reused to auto-populate other invoices once
// backed by a self-invoice that's actually reached "Completed" (see SelfInvoiceModal.tsx).
export function useClientDistances() {
  const { user } = useAuth();
  const [records, setRecords] = useState<Map<string, ClientDistanceRecord>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRecords(new Map());
      setLoading(false);
      return;
    }

    const path = 'client_distances';
    const q = query(collection(db, path), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const next = new Map<string, ClientDistanceRecord>();
      snapshot.docs.forEach(d => {
        const data = d.data();
        if (typeof data.clientKey === 'string' && typeof data.distanceKm === 'number') {
          next.set(data.clientKey, {
            clientKey: data.clientKey,
            clientName: data.clientName || '',
            distanceKm: data.distanceKm,
            completed: !!data.completed,
            updatedAt: data.updatedAt || ''
          });
        }
      });
      setRecords(next);
      setLoading(false);
    }, (err) => {
      console.error('Firestore Subscribe Client Distances Error:', err);
      setLoading(false);
      if (err.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const getClientDistance = useCallback((clientName: string): ClientDistanceRecord | undefined => {
    if (!clientName?.trim()) return undefined;
    return records.get(slugifyClientKey(clientName));
  }, [records]);

  // Upserts the cached distance for a client. Never downgrades an
  // already-confirmed (completed) record back to unconfirmed.
  const saveClientDistance = useCallback(async (clientName: string, distanceKm: number, completed: boolean) => {
    if (!user || !clientName?.trim() || !Number.isFinite(distanceKm)) return false;
    const clientKey = slugifyClientKey(clientName);
    if (!clientKey) return false;
    const docId = `${user.uid}_${clientKey}`;
    const path = `client_distances/${docId}`;
    const existing = records.get(clientKey);
    try {
      await setDoc(doc(db, 'client_distances', docId), {
        userId: user.uid,
        clientKey,
        clientName: clientName.trim(),
        distanceKm,
        completed: existing?.completed || completed,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      return true;
    } catch (err) {
      console.error('Firestore Save Client Distance Error:', err);
      handleFirestoreError(err, OperationType.UPDATE, path);
      return false;
    }
  }, [user, records]);

  return { getClientDistance, saveClientDistance, loading };
}
