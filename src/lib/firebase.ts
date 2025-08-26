// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, Firestore, initializeFirestore, CACHE_SIZE_UNLIMITED } from "firebase/firestore";
import { getAuth, Auth, initializeAuth, browserLocalPersistence, indexedDBLocalPersistence } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBPoccPeNLmj1psrxCw5vMDJ5yrwPoITbk",
  authDomain: "brujos.firebaseapp.com",
  projectId: "brujos",
  storageBucket: "brujos.firebasestorage.app",
  messagingSenderId: "171849909417",
  appId: "1:171849909417:web:0d594994387c214e5695b8"
};


function createFirebaseApp() {
    const apps = getApps();
    if (apps.length > 0) {
        return apps[0];
    }
    const app = initializeApp(firebaseConfig);
    return app;
}

const app = createFirebaseApp();
const db = getFirestore(app);
const auth = getAuth(app);


// Enable persistence only on the client-side
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Firestore persistence failed: Multiple tabs open or other issue.");
    } else if (err.code == 'unimplemented') {
      console.warn("Firestore persistence failed: Browser does not support required features.");
    }
  });
}


export { db, app, auth };
