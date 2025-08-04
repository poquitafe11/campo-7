// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence, terminate, clearIndexedDbPersistence, initializeFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBPoccPeNLmj1psrxCw5vMDJ5yrwPoITbk",
  authDomain: "brujos.firebaseapp.com",
  projectId: "brujos",
  storageBucket: "brujos.firebasestorage.app",
  messagingSenderId: "171849909417",
  appId: "1:171849909417:web:0d594994387c214e5695b8"
};

// Initialize Firebase
// This pattern prevents re-initialization in Next.js environments
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let db;

try {
  db = getFirestore(app);
  enableIndexedDbPersistence(db, { forceOwnership: true })
    .catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Firestore persistence failed: Multiple tabs open. Persistence can only be enabled in one tab at a a time.");
        } else if (err.code === 'unimplemented') {
            console.warn("Firestore persistence failed: The current browser does not support all of the features required to enable persistence.");
        }
    });
} catch(e) {
  console.error("Firebase Firestore initialization error", e);
}


export { db, app };
export const auth = getAuth(app);
