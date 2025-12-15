
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, CACHE_SIZE_UNLIMITED, type Firestore, enableNetwork, disableNetwork, query } from "firebase/firestore";
import { getAuth, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, type Auth } from "firebase/auth";

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

const OFFLINE_PERSISTENCE_KEY = 'firebase-offline-mode';

export const goOffline = async () => {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(OFFLINE_PERSISTENCE_KEY, 'true');
    await disableNetwork(db);
    window.dispatchEvent(new CustomEvent('online-status-changed'));
    console.log("NETWORK CONTROL: Network DISABLED. App is now explicitly offline.");
  }
};

export const goOnline = async () => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(OFFLINE_PERSISTENCE_KEY);
    await enableNetwork(db);
    window.dispatchEvent(new CustomEvent('online-status-changed'));
    console.log("NETWORK CONTROL: Network ENABLED. App is now explicitly online.");
  }
};

export const isOffline = () => {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(OFFLINE_PERSISTENCE_KEY) === 'true';
  }
  return false; 
};

function initializeFirebaseClient() {
    if (getApps().length) {
        app = getApp();
        try {
          db = getFirestore(app);
        } catch(e) {
          console.warn("getFirestore failed, initializing...")
          db = initializeFirestore(app, {
            cacheSizeBytes: CACHE_SIZE_UNLIMITED
          });
        }
    } else {
        app = initializeApp(firebaseConfig);
        db = initializeFirestore(app, {
            cacheSizeBytes: CACHE_SIZE_UNLIMITED
        });
    }

    try {
        auth = initializeAuth(app, {
        persistence: indexedDBLocalPersistence
        });
    } catch (e) {
        console.warn("indexedDBLocalPersistence failed, falling back to getAuth:", e);
        auth = getAuth(app);
    }
    
    enableIndexedDbPersistence(db)
        .then(() => {
        console.log("Firebase persistence enabled.");
        if (isOffline()) {
            console.log("NETWORK CONTROL: Starting in offline mode as per saved preference.");
            return disableNetwork(db);
        }
        })
        .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Firestore persistence failed: Multiple tabs open. Offline data will not be saved.");
        } else if (err.code === 'unimplemented') {
            console.warn("Firestore persistence failed: Browser does not support it.");
        }
        });
}

function initializeFirebaseServer() {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}


if (typeof window !== 'undefined') {
  initializeFirebaseClient();
} else {
  initializeFirebaseServer();
}

export { db, app, auth };
