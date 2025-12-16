
"use server";

import { z } from "zod";
import { getFirebaseAdmin } from "@/lib/firebase-admin";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function login(values: z.infer<typeof loginSchema>) {
  try {
    const validatedData = loginSchema.parse(values);
    
    // For "marcoromau@gmail.com", we skip the DB check as a special admin case
    if (validatedData.email === 'marcoromau@gmail.com') {
      return { success: true };
    }

    const adminDb = getFirebaseAdmin().firestore();
    const userDocRef = adminDb.collection("usuarios").doc(validatedData.email);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
        return { success: false, message: "Usuario no encontrado." };
    }
    
    // The user exists in our database, now Firebase Auth will handle the password check.
    return { success: true };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: "Datos inválidos.", errors: error.errors };
    }
    console.error("Server-side login validation error:", error);
    return { success: false, message: "Error desconocido en el servidor." };
  }
}
