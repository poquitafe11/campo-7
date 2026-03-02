
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  type Firestore, 
  enableNetwork, 
  disableNetwork,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth, initializeAuth, indexedDBLocalPersistence, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBPoccPeNLmj1psrxCw5vMDJ5yrwPoITbk",
  authDomain: "brujos.firebaseapp.com",
  projectId: "brujos",
  storageBucket: "brujos.appspot.com",
  messagingSenderId: "171849909417",
  appId: "1:171849909417:web:0d594994387c214e5695b8"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

const OFFLINE_PERSISTENCE_KEY = 'firebase-offline-mode';

export const isOffline = () => {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(OFFLINE_PERSISTENCE_KEY) === 'true';
  }
  return false;
};

export function getFirebase() {
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
        if (typeof window !== 'undefined') {
            auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
            // Using modern persistent cache configuration to avoid deprecation warnings
            db = initializeFirestore(app, { 
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager()
                })
            });
        } else {
            auth = getAuth(app);
            db = getFirestore(app);
        }
    } else {
        app = getApp();
        if (typeof window !== 'undefined') {
             try {
                auth = getAuth(app);
            } catch (e) {
                auth = initializeAuth(app, { persistence: indexedDBLocalPersistence });
            }
        } else {
            auth = getAuth(app);
        }
        db = getFirestore(app);
    }
    return { app, db, auth };
}

export const goOffline = async () => {
  if (typeof window !== 'undefined') {
    const { db: firestoreDb } = getFirebase();
    window.localStorage.setItem(OFFLINE_PERSISTENCE_KEY, 'true');
    await disableNetwork(firestoreDb);
    window.dispatchEvent(new CustomEvent('online-status-changed'));
  }
};

export const goOnline = async () => {
  if (typeof window !== 'undefined') {
    const { db: firestoreDb } = getFirebase();
    window.localStorage.removeItem(OFFLINE_PERSISTENCE_KEY);
    await enableNetwork(firestoreDb);
    window.dispatchEvent(new CustomEvent('online-status-changed'));
  }
};

const instances = getFirebase();
db = instances.db;
app = instances.app;
auth = instances.auth;

export { db, app, auth };
