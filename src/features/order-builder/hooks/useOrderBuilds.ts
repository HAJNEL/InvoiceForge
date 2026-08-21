import { runTransaction, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

// Atomically claims the next build number for `userId`'s sequence in the current
// calendar year, e.g. "00001". Scoped per (userId, year) - matches how every other
// collection in this app (orders, trips, ...) scopes data per owning account, and
// resets for free on Jan 1st since that year's counter doc simply doesn't exist yet
// (no explicit "reset" branch needed). Runs inside a Firestore transaction so two
// builds created at the same moment can never receive the same number - the
// transaction retries automatically on write contention.
export async function getNextBuildNumber(userId: string): Promise<{ buildNumber: string; year: number }> {
  const year = new Date().getFullYear();
  const counterRef = doc(db, 'buildCounters', `${userId}_${year}`);
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const last = snap.exists() ? (snap.data().lastNumber as number) : 0;
    const n = last + 1;
    tx.set(counterRef, { lastNumber: n }, { merge: true });
    return n;
  });
  return { buildNumber: String(next).padStart(5, '0'), year };
}
