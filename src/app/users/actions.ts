
"use server";

import { z } from "zod";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, getDoc } from "firebase/firestore";
import { User, UserSchema, UserRole } from "@/lib/types";
import { revalidatePath } from 'next/cache';

async function getFirebaseAdmin() {
  const admin = await import('firebase-admin');
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin;
}


const roleHierarchy: { [key in UserRole]: number } = {
    "Admin": 4,
    "Jefe": 3,
    "Supervisor": 2,
    "Asistente": 1,
    "Apoyo": 1,
    "Invitado": 0,
};

export async function getUsers() {
    try {
        const admin = await getFirebaseAdmin();
        const adminDb = admin.firestore();
        const usersFromDb = await adminDb.collection("usuarios").get();
        const usersData = usersFromDb.docs.map(doc => ({ ...doc.data(), id: doc.id })) as User[];
        return { success: true, data: usersData };
    } catch (error) {
        console.error("Error fetching users from Firestore: ", error);
        return { success: false, message: "No se pudieron obtener los usuarios.", data: [] };
    }
}

export async function createUserInAuth(password: string, email: string) {
    try {
        const admin = await getFirebaseAdmin();
        const authAdmin = admin.auth();
        await authAdmin.createUser({
            email: email,
            password: password,
            emailVerified: true,
        });
        return { success: true };
    } catch (error: any) {
        let message = 'No se pudo crear el usuario en el sistema de autenticación.';
        if (error.code === 'auth/email-already-exists') {
            message = 'Este correo electrónico ya está en uso.';
        } else if (error.code === 'auth/invalid-password') {
            message = 'La contraseña debe tener al menos 6 caracteres.';
        }
        console.error("Error creating user in Firebase Auth:", error);
        return { success: false, message };
    }
}

export async function saveUser(values: z.infer<typeof UserSchema>) {
  try {
    const validatedData = UserSchema.parse(values);
    const docRef = doc(db, "usuarios", validatedData.email);

    await setDoc(docRef, validatedData, { merge: true });
    revalidatePath("/users");
    return { success: true, message: "Usuario guardado correctamente." };
  } catch (error) {
    console.error("Error guardando usuario: ", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Datos inválidos.", errors: error.errors };
    }
    return { success: false, message: "No se pudo guardar el usuario." };
  }
}

export async function updateUserStatus(email: string, active: boolean) {
    try {
        const admin = await getFirebaseAdmin();
        const authAdmin = admin.auth();
        const userRecord = await authAdmin.getUserByEmail(email);
        await authAdmin.updateUser(userRecord.uid, { disabled: !active });

        const docRef = doc(db, "usuarios", email);
        await setDoc(docRef, { active }, { merge: true });

        revalidatePath("/users");
        return { success: true, message: "Estado del usuario actualizado." };
    } catch (error) {
        console.error("Error updating user status:", error);
        return { success: false, message: "No se pudo actualizar el estado." };
    }
}

export async function deleteUser(email: string) {
    try {
        const admin = await getFirebaseAdmin();
        const authAdmin = admin.auth();
        const userRecord = await authAdmin.getUserByEmail(email).catch(() => null);
        if (userRecord) {
            await authAdmin.deleteUser(userRecord.uid);
        }
    } catch (error: any) {
        console.warn(`No se pudo eliminar el usuario de Firebase Auth: ${error.message}. Esto puede suceder si el usuario ya fue eliminado o no existe. Continuando con la eliminación de Firestore.`);
    }

    try {
        const docRef = doc(db, "usuarios", email);
        await deleteDoc(docRef);
        
        revalidatePath("/users");
        return { success: true, message: "Usuario eliminado correctamente." };

    } catch (error: any) {
        console.error("Error deleting user from Firestore:", error);
        return { success: false, message: `Ocurrió un error al eliminar el usuario de la base de datos: ${error.message}` };
    }
}

    