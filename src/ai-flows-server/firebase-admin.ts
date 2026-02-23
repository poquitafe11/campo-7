import * as admin from 'firebase-admin';

export function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

  if (serviceAccount) {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  // Fallback for environments where service account is handled automatically (like Google Cloud)
  return admin.initializeApp();
}
