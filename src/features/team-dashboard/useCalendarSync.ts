import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../core/hooks/useAuth';
import { Trip } from '../../types';
import { isTripCalendarEligible, requestCalendarToken, upsertTripEvent } from '../../lib/googleCalendar';

// One persisted record per (owner doc, trip) under {collectionName}/{uid}/calendar_events/{tripId}.
interface CalendarSyncRecord {
  tripId: string;
  eventId: string;
  scheduledDate: string; // the trip.date the event currently reflects
  syncedAt: string;
}

export function signedInWithGoogle(): boolean {
  return (auth.currentUser?.providerData || []).some(p => p.providerId === 'google.com');
}

// `collectionName` picks which owner-scoped Firestore doc holds the sync
// bookkeeping: 'team_members' for a team member, 'settings' for the main
// account owner (mirrors calendarSyncEnabled on TeamMember vs Settings).
export function useCalendarSync(trips: Trip[], enabled: boolean, collectionName: 'team_members' | 'settings' = 'team_members') {
  const { user } = useAuth();
  const [syncedMap, setSyncedMap] = useState<Record<string, CalendarSyncRecord>>({});
  const [syncing, setSyncing] = useState(false);

  // Live view of what this account has already synced.
  useEffect(() => {
    if (!user) {
      setSyncedMap({});
      return;
    }
    const ref = collection(db, collectionName, user.uid, 'calendar_events');
    const unsub = onSnapshot(ref, (snap) => {
      const map: Record<string, CalendarSyncRecord> = {};
      snap.forEach(d => { map[d.id] = d.data() as CalendarSyncRecord; });
      setSyncedMap(map);
    }, (err) => {
      console.error('calendar_events snapshot error:', err);
    });
    return () => unsub();
  }, [user, collectionName]);

  // All statuses except Pending (not yet planned) and the completed/delivered/
  // invoiced "history" bucket are eligible, for both team members and the owner.
  const eligibleTrips = useMemo(
    () => trips.filter(isTripCalendarEligible),
    [trips]
  );

  // A trip needs syncing if it has never been synced, or its scheduled date
  // moved since the last sync (so the event must be moved to the new date).
  const unsyncedTrips = useMemo(
    () => eligibleTrips.filter(t => {
      const rec = syncedMap[t.id];
      return !rec || rec.scheduledDate !== t.date;
    }),
    [eligibleTrips, syncedMap]
  );

  // Trips currently reflected on the calendar (synced and not stale) — shown
  // on the modal's "Synced" tab so a trip can be manually re-pushed on demand.
  const syncedTrips = useMemo(
    () => eligibleTrips.filter(t => {
      const rec = syncedMap[t.id];
      return rec && rec.scheduledDate === t.date;
    }),
    [eligibleTrips, syncedMap]
  );

  const unsyncedCount = unsyncedTrips.length;

  // Try a silent token refresh first (no popup); GIS's silent grant can fail
  // across page loads (e.g. third-party cookie restrictions) even when the
  // account previously authorized this app, so fall back to a visible consent
  // prompt rather than syncing silently failing with no created events.
  const getToken = useCallback(async () => {
    try {
      return await requestCalendarToken(false);
    } catch {
      return await requestCalendarToken(true);
    }
  }, []);

  const syncTrips = useCallback(async (tripIds: string[]) => {
    if (!user || tripIds.length === 0) return;
    setSyncing(true);
    try {
      const token = await getToken();
      let ok = 0;
      let failed = 0;
      for (const tripId of tripIds) {
        const trip = trips.find(t => t.id === tripId);
        if (!trip || !isTripCalendarEligible(trip)) continue;
        try {
          const existing = syncedMap[tripId]?.eventId;
          const eventId = await upsertTripEvent(token, trip, existing);
          const record: CalendarSyncRecord = {
            tripId,
            eventId,
            scheduledDate: trip.date,
            syncedAt: new Date().toISOString(),
          };
          await setDoc(doc(db, collectionName, user.uid, 'calendar_events', tripId), record);
          ok += 1;
        } catch (err) {
          console.error(`Failed to sync trip ${tripId}:`, err);
          failed += 1;
        }
      }
      if (ok > 0 && failed === 0) {
        toast.success('Calendar Synced', { description: `${ok} trip${ok === 1 ? '' : 's'} synced to Google Calendar.` });
      } else if (ok > 0 && failed > 0) {
        toast.warning('Partially Synced', { description: `${ok} synced, ${failed} failed. Please try again.` });
      } else if (failed > 0) {
        toast.error('Sync Failed', { description: 'Could not sync trips to Google Calendar.' });
      } else {
        // Every requested trip was skipped as ineligible (e.g. its status/date
        // changed since the picker opened) — say so instead of silently doing nothing.
        toast.warning('Nothing to Sync', { description: 'The selected trip(s) are no longer eligible for calendar sync.' });
      }
    } catch (err) {
      console.error('Calendar sync error:', err);
      toast.error('Sync Failed', {
        description: err instanceof Error ? err.message : 'Could not access Google Calendar.',
      });
    } finally {
      setSyncing(false);
    }
  }, [user, trips, syncedMap, collectionName, getToken]);

  return { enabled, eligibleTrips, unsyncedTrips, unsyncedCount, syncedTrips, syncedMap, syncing, syncTrips };
}
