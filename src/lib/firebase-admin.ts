import * as admin from 'firebase-admin';

// This is a server-only file.

const getFirebaseAdmin = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountString) {
    throw new Error('La variable de entorno FIREBASE_SERVICE_ACCOUNT_KEY no está configurada.');
  }
  
  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (e: any) {
    console.error('Error al parsear FIREBASE_SERVICE_ACCOUNT_KEY o al inicializar Firebase Admin:', e);
    throw new Error('No se pudo inicializar Firebase Admin SDK. Revisa las credenciales.');
  }
};

let authAdminInstance: admin.auth.Auth;
let dbAdminInstance: admin.firestore.Firestore;

try {
  const app = getFirebaseAdmin();
  authAdminInstance = app.auth();
  dbAdminInstance = app.firestore();
} catch (error) {
    console.error("Error al inicializar las instancias de Firebase Admin:", error);
    // @ts-ignore
    authAdminInstance = null;
    // @ts-ignore
    dbAdminInstance = null;
}


export const authAdmin = authAdminInstance;
export const dbAdmin = dbAdminInstance;
