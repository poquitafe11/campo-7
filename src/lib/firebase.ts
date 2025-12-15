
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, CACHE_SIZE_UNLIMITED, type Firestore, enableNetwork, disableNetwork } from "firebase/firestore";
import { getAuth, initializeAuth, indexedDBLocalPersistence, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBPoccPeNLmj1psrxCw5vMDJ5yrwPoITbk",
  authDomain: "brujos.firebaseapp.com",
  projectId: "brujos",
  storageBucket: "brujos.firebasestorage.app",
  messagingSenderId: "171849909417",
  appId: "1:171849909417:web:0d594994387c214e5695b8"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let persistenceEnabled = false;

const OFFLINE_PERSISTENCE_KEY = 'firebase-offline-mode';

export const isOffline = () => {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(OFFLINE_PERSISTENCE_KEY) === 'true';
  }
  return false;
};

// This function will be the single point of entry for getting Firebase services.
export async function getFirebase() {
  if (app && db && auth) {
    return { app, db, auth };
  }

  if (getApps().length) {
    app = getApp();
  } else {
    app = initializeApp(firebaseConfig);
  }

  db = getFirestore(app);
  
  if (typeof window !== 'undefined') {
    auth = initializeAuth(app, {
      persistence: indexedDBLocalPersistence
    });

    if (!persistenceEnabled) {
      try {
        await enableIndexedDbPersistence(db);
        persistenceEnabled = true;
        console.log("Firebase persistence enabled.");
        if (isOffline()) {
            console.log("NETWORK CONTROL: Starting in offline mode as per saved preference.");
            await disableNetwork(db);
        }
      } catch (err: any) {
        if (err.code === 'failed-precondition') {
            console.warn("Firestore persistence failed: Multiple tabs open. Offline data will not be saved.");
        } else if (err.code === 'unimplemented') {
            console.warn("Firestore persistence failed: Browser does not support it.");
        }
      }
    }
  } else {
    // Server-side auth
    auth = getAuth(app);
  }

  return { app, db, auth };
}

export const goOffline = async () => {
  if (typeof window !== 'undefined') {
    const { db: firestoreDb } = await getFirebase();
    window.localStorage.setItem(OFFLINE_PERSISTENCE_KEY, 'true');
    await disableNetwork(firestoreDb);
    window.dispatchEvent(new CustomEvent('online-status-changed'));
    console.log("NETWORK CONTROL: Network DISABLED. App is now explicitly offline.");
  }
};

export const goOnline = async () => {
  if (typeof window !== 'undefined') {
    const { db: firestoreDb } = await getFirebase();
    window.localStorage.removeItem(OFFLINE_PERSISTENCE_KEY);
    await enableNetwork(firestoreDb);
    window.dispatchEvent(new CustomEvent('online-status-changed'));
    console.log("NETWORK CONTROL: Network ENABLED. App is now explicitly online.");
  }
};

// Initialize and export immediately for files that import `db` directly.
getFirebase();

export { db, app, auth };
