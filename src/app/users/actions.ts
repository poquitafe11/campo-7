
"use server";

import { z } from "zod";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc } from "firebase/firestore";
import { User, UserSchema, UserRole } from "@/lib/types";
import { revalidatePath } from 'next/cache';

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
    try {
        const docRef = doc(db, "usuarios", email);
        await deleteDoc(docRef);
        revalidatePath("/users");
        return { success: true, message: "Usuario eliminado." };
    } catch (error) {
        console.error("Error deleting user:", error);
        return { success: false, message: "No se pudo eliminar el usuario." };
    }
}
