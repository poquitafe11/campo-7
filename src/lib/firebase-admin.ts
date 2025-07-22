
import * as admin from 'firebase-admin';
import { config } from 'dotenv';

// This is a server-only file.

// Load environment variables from .env file
config();

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let authAdminInstance: admin.auth.Auth | null = null;
let dbAdminInstance: admin.firestore.Firestore | null = null;

if (serviceAccountString) {
    if (admin.apps.length === 0) {
        try {
            const serviceAccount = JSON.parse(serviceAccountString);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            authAdminInstance = admin.auth();
            dbAdminInstance = admin.firestore();
        } catch (e) {
            console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY. Firebase Admin initialization failed.', e);
        }
    } else {
        authAdminInstance = admin.auth();
        dbAdminInstance = admin.firestore();
    }
} else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY is not set. Firebase Admin features will be disabled.');
}

export const authAdmin = authAdminInstance;
export const dbAdmin = dbAdminInstance;
