'use server';

// Deprecated in favor of client-side Firestore SDK usage to avoid environment conflicts.
// This file is kept temporarily to avoid import breakages during transition.
export async function addAsistente() {
    return { success: false, message: "Use client-side creation logic." };
}
