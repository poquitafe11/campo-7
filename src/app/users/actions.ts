'use server';

// Deprecated in favor of client-side Firestore SDK usage.
// Firebase Admin SDK is not available in the client environment.
export async function saveUser() {
    return { success: false, message: "Use client-side logic in UsersPage." };
}
