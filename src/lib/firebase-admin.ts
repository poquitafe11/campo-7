import * as admin from 'firebase-admin';

// This is a server-only file.

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let authAdminInstance: admin.auth.Auth | null = null;
let dbAdminInstance: admin.firestore.Firestore | null = null;

function initializeFirebaseAdmin() {
  // Only initialize if it hasn't been done and the key exists.
  if (admin.apps.length === 0 && serviceAccountString) {
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      authAdminInstance = admin.auth();
      dbAdminInstance = admin.firestore();
    } catch (e: any) {
      console.error('Failed to initialize Firebase Admin SDK. Admin features will be disabled.', e.message);
      // Keep instances null if initialization fails
      authAdminInstance = null;
      dbAdminInstance = null;
    }
  }
}

// Ensure initialization is attempted once.
initializeFirebaseAdmin();

// Export the instances. They will be null if initialization failed.
export const authAdmin = authAdminInstance;
export const dbAdmin = dbAdminInstance;
