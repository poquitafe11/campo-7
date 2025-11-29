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

// This function will initialize firebase on the client
function initializeFirebase() {
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

  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Firestore persistence failed: Multiple tabs open. Offline data will not be saved.");
    } else if (err.code === 'unimplemented') {
      console.warn("Firestore persistence failed: Browser does not support it.");
    }
  });
}

if (typeof window !== 'undefined') {
  initializeFirebase();
} else {
  // For server-side rendering
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
}

export { db, app, auth };
