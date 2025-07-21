
"use server";

import { z } from "zod";
import { db, auth } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, getDoc, deleteDoc } from "firebase/firestore";
import { User, UserSchema, UserRole } from "@/lib/types";
import { revalidatePath } from 'next/cache';

export async function getCurrentUserRole(): Promise<UserRole | null> {
    const currentUser = auth.currentUser;
    if (!currentUser?.email) return null;

    try {
        if (currentUser.email === 'marcoromau@gmail.com') {
            return 'Admin';
        }
        
        const userDocRef = doc(db, "usuarios", currentUser.email);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            return userDocSnap.data().rol as UserRole;
        }

        const asistenteDocRef = doc(db, "asistentes", currentUser.email);
        const asistenteDocSnap = await getDoc(asistenteDocRef);

        if(asistenteDocSnap.exists()){
            return asistenteDocSnap.data().cargo as UserRole;
        }

        return null;
    } catch (error) {
        console.error("Error fetching user role:", error);
        return null;
    }
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
        const currentUserRole = await getCurrentUserRole();
        if (!currentUserRole) {
            return { success: false, message: "No se pudo verificar el rol del usuario.", data: [] };
        }
        
        const currentUserLevel = roleHierarchy[currentUserRole];
        if (currentUserLevel < roleHierarchy.Supervisor) {
             return { success: false, message: "No tienes permiso para ver usuarios.", data: [] };
        }
        
        const usersSnapshot = await getDocs(collection(db, "usuarios"));
        const users = usersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as (User & {id: string})[];

        const visibleUsers = users.filter(user => currentUserLevel > roleHierarchy[user.rol]);

        return { success: true, data: visibleUsers };

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
