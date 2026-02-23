'use server';

// Deprecated in favor of client-side Firestore SDK usage to avoid environment conflicts.
// This file is kept temporarily to avoid import breakages during transition.
export async function saveUser() {
    return { success: false, message: "Use client-side logic in UsersPage." };
}

export async function deleteUser(email: string) {
    return { success: false, message: "Use client-side logic in UsersPage." };
}

export async function getUsers() {
    return { success: false, message: "Use client-side logic in UsersPage.", data: [] };
}
