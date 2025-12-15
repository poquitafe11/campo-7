
import admin from 'firebase-admin';

// Load environment variables
import * as dotenv from 'dotenv';
import path from 'path';

// Explicitly load environment variables from the root .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });


const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

let firebaseAdminApp: admin.app.App | null = null;

function getFirebaseAdmin() {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  if (admin.apps.length > 0) {
    firebaseAdminApp = admin.app();
    return firebaseAdminApp;
  }

  if (!serviceAccountString) {
    throw new Error('La variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY no está configurada.');
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    firebaseAdminApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    return firebaseAdminApp;
  } catch (error) {
    console.error('Error al inicializar Firebase Admin SDK:', error);
    throw new Error('No se pudo inicializar Firebase Admin. Verifique las credenciales.');
  }
}

export { getFirebaseAdmin };
