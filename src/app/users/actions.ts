'use server';

// Todas las funciones de gestión de usuarios se han migrado al lado del cliente (Firebase Client SDK)
// para evitar dependencias de servidor (firebase-admin) que causan errores en el despliegue.
// Este archivo se mantiene solo por compatibilidad de rutas.

export async function saveUser() {
    return { success: false, message: "Use client-side logic in UsersPage." };
}

export async function deleteUser(email: string) {
    return { success: false, message: "Use client-side logic in UsersPage." };
}

export async function getUsers() {
    return { success: false, message: "Use client-side logic in UsersPage.", data: [] };
}
