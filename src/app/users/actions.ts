
"use server";

import { z } from "zod";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import { User, UserSchema, UserRole, NewUserSchema } from "@/lib/types";
import { revalidatePath } from 'next/cache';
import { authAdmin } from "@/lib/firebase-admin";

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
        const usersSnapshot = await getDocs(collection(db, "usuarios"));
        const usersData = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as (User & {id: string})[];
        
        return { success: true, data: usersData };

    } catch (error) {
        console.error("Error fetching users: ", error);
        return { success: false, message: "No se pudieron obtener los usuarios.", data: [] };
    }
}

export async function createUserInAuth(password: string, email: string) {
    if (!authAdmin) {
        return { success: false, message: 'El servicio de administración de Firebase no está configurado en el servidor.' };
    }
    try {
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
    if (!authAdmin) {
        return { success: false, message: 'El servicio de administración de Firebase no está configurado. No se puede eliminar el usuario de Auth.' };
    }

    try {
        // Step 1: Delete from Firebase Auth, if it exists
        const userRecord = await authAdmin.getUserByEmail(email).catch(() => null);
        if (userRecord) {
            await authAdmin.deleteUser(userRecord.uid);
        }

        // Step 2: Always attempt to delete from Firestore
        const docRef = doc(db, "usuarios", email);
        await deleteDoc(docRef);
        
        revalidatePath("/users");
        return { success: true, message: "Usuario eliminado correctamente." };

    } catch (error: any) {
        console.error("Error deleting user:", error);
        return { success: false, message: `Ocurrió un error al eliminar el usuario: ${error.message}` };
    }
}
