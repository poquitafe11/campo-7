import * as admin from 'firebase-admin';

// This is a server-only file.

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountString) {
  throw new Error('La variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY no está configurada.');
}

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e: any) {
    console.error('Error al parsear FIREBASE_SERVICE_ACCOUNT_KEY o al inicializar Firebase Admin:', e);
    throw new Error('No se pudo inicializar Firebase Admin SDK. Revisa las credenciales.');
  }
}

export const authAdmin = admin.auth();
export const dbAdmin = admin.firestore();
