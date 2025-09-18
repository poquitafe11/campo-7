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
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);

    try {
      // Use indexedDB for more robust persistence in PWAs
      auth = initializeAuth(app, {
        persistence: indexedDBLocalPersistence
      });
    } catch (e) {
      console.warn("Fallback to getAuth():", e);
      auth = getAuth(app); 
    }

    try {
      db = initializeFirestore(app, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      });
      enableIndexedDbPersistence(db).catch((err) => {
          if (err.code == 'failed-precondition') {
              console.warn("Firestore persistence failed: Multiple tabs open. Offline data will not be saved.");
          } else if (err.code == 'unimplemented') {
              console.warn("Firestore persistence failed: Browser does not support it.");
          }
      });
    } catch (e) {
        console.warn("Fallback to getFirestore():", e);
        db = getFirestore(app);
    }
} else {
    // Server-side initialization
    app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
}

export { db, app, auth };
