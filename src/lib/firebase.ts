import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Persistent local cache (IndexedDB) so onSnapshot listeners can serve their
// initial value instantly from disk on reload/reconnect instead of waiting on
// a network round-trip, then sync with the server in the background.
// persistentMultipleTabManager is the safe default since the app may be open
// in more than one browser tab at once.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
}, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
