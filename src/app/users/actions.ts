'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { User, UserRole, userSchema, ROLES } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// Helper function to check role permissions
const hasPermission = (currentUserRole: UserRole, targetUserRole?: UserRole) => {
    if (currentUserRole === 'Administrador') {
        return true;
    }
    if (currentUserRole === 'Jefe de Campo') {
        if (!targetUserRole) return true; // Can create new users
        return ['Supervisor', 'Asistente de Campo', 'Invitado'].includes(targetUserRole);
    }
    if (currentUserRole === 'Supervisor') {
        if (!targetUserRole) return true; // Can create new users
        return ['Asistente de Campo', 'Invitado'].includes(targetUserRole);
    }
    return false;
};

const getVisibleRoles = (currentUserRole: UserRole): UserRole[] => {
    if (currentUserRole === 'Administrador') {
        return [...ROLES];
    }
    if (currentUserRole === 'Jefe de Campo') {
        return ['Supervisor', 'Asistente de Campo', 'Invitado'];
    }
    if (currentUserRole === 'Supervisor') {
        return ['Asistente de Campo', 'Invitado'];
    }
    return [];
};


export async function getUsers(currentUserRole: UserRole): Promise<User[]> {
    if (!currentUserRole || !hasPermission(currentUserRole)) {
        return [];
    }
    
    try {
        const visibleRoles = getVisibleRoles(currentUserRole);
        if (visibleRoles.length === 0) return [];
        
        const usersRef = collection(db, 'usuarios');
        const q = query(usersRef, where('rol', 'in', visibleRoles));
        const querySnapshot = await getDocs(q);

        const users = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as User[];

        return users;
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

export async function toggleUserStatus(userId: string, active: boolean, currentUserRole: UserRole) {
    try {
        const userDocRef = doc(db, 'usuarios', userId);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists() || !hasPermission(currentUserRole, userDoc.data()?.rol)) {
            return { success: false, message: 'No tienes permiso para modificar este usuario.' };
        }
        
        await setDoc(userDocRef, { active }, { merge: true });
        revalidatePath('/users');
        return { success: true };
    } catch (error) {
        console.error("Error toggling user status:", error);
        return { success: false, message: 'Ocurrió un error al actualizar el usuario.' };
    }
}


export async function saveUser(userData: z.infer<typeof userSchema>, currentUserRole: UserRole, isEditing: boolean) {
    if (!hasPermission(currentUserRole, userData.rol)) {
        return { success: false, message: 'No tienes permiso para crear o modificar este rol.' };
    }
    
    try {
        const id = userData.email; // Use email as the document ID
        const docRef = doc(db, "usuarios", id);

        if (!isEditing) {
            const existingDoc = await getDoc(docRef);
            if (existingDoc.exists()) {
                return { success: false, message: 'Ya existe un usuario con este correo electrónico.' };
            }
        }

        await setDoc(docRef, userData, { merge: isEditing });

        revalidatePath('/users');
        return { success: true, message: `Usuario ${isEditing ? 'actualizado' : 'creado'} correctamente.` };
    } catch (error) {
        console.error("Error saving user:", error);
        return { success: false, message: 'Ocurrió un error al guardar el usuario.' };
    }
}