import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, CACHE_SIZE_UNLIMITED, type Firestore } from "firebase/firestore";
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

if (typeof window !== 'undefined') {
    // This code only runs on the client
    const apps = getApps();
    app = apps.length ? apps[0]! : initializeApp(firebaseConfig);

    try {
      auth = initializeAuth(app, {
        persistence: indexedDBLocalPersistence
      });
    } catch (e) {
      auth = getAuth(app); // Fallback for existing auth instance
    }

    try {
        db = initializeFirestore(app, {
            cacheSizeBytes: CACHE_SIZE_UNLIMITED
        });
        enableIndexedDbPersistence(db).catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn("Firestore persistence failed: Multiple tabs open.");
            } else if (err.code == 'unimplemented') {
                console.warn("Firestore persistence failed: Browser does not support it.");
            }
        });
    } catch (e) {
        db = getFirestore(app); // Fallback for existing firestore instance
    }
} else {
    // On the server, we need to handle the case where these might be undefined.
    // However, the logic in AuthWrapper should prevent server-side execution
    // that relies on Firebase client SDKs. We initialize with placeholders
    // to satisfy TypeScript, but they won't be used.
    const apps = getApps();
    if (apps.length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = apps[0]!;
    }
    db = getFirestore(app);
    auth = getAuth(app);
}

export { db, app, auth };
