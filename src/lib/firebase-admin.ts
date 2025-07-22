import * as admin from 'firebase-admin';

// This is a server-only file.

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let authAdminInstance: admin.auth.Auth | null = null;
let dbAdminInstance: admin.firestore.Firestore | null = null;

function initializeFirebaseAdmin() {
  // Only initialize if it hasn't been done.
  if (admin.apps.length === 0) {
    if (!serviceAccountString) {
      // Log an error in the server console, but don't throw, to avoid crashing.
      console.error('La variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY no está configurada. Las funciones de administrador (crear/eliminar usuarios) estarán deshabilitadas.');
      return; // Stop initialization
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      authAdminInstance = admin.auth();
      dbAdminInstance = admin.firestore();
    } catch (e: any) {
      console.error('Fallo al inicializar Firebase Admin SDK. Las funciones de administrador estarán deshabilitadas.', e.message);
      // Keep instances null if initialization fails
      authAdminInstance = null;
      dbAdminInstance = null;
    }
  } else {
    // If already initialized, just get the instances.
    authAdminInstance = admin.auth();
    dbAdminInstance = admin.firestore();
  }
}

// Ensure initialization is attempted once when the module is loaded.
initializeFirebaseAdmin();

// Export the instances. They will be null if initialization failed.
export const authAdmin = authAdminInstance;
export const dbAdmin = dbAdminInstance;
