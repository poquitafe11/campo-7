
import * as admin from 'firebase-admin';

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
  : null;

let adminApp: admin.app.App;

if (!admin.apps.length) {
  if (serviceAccount) {
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // This will initialize with default credentials on Firebase environments
    adminApp = admin.initializeApp();
  }
} else {
  adminApp = admin.app();
}

export const getFirebaseAdmin = () => {
    return adminApp;
};
