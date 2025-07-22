
import * as admin from 'firebase-admin';

// This is a server-only file.

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : undefined;

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount!),
    });
  } catch (e: any) {
    if (e.code !== 'app/duplicate-app') {
       console.error('Firebase admin initialization error', e.stack);
    }
  }
}

export const authAdmin = admin.auth();
export const dbAdmin = admin.firestore();
