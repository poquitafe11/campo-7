
"use server";

import { z } from "zod";
import { db } from "@/lib/firebase"; // Assuming you might need this for other checks eventually.

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function login(values: z.infer<typeof loginSchema>) {
  try {
    const validatedData = loginSchema.parse(values);
    
    // The primary validation now happens on the client with signInWithEmailAndPassword.
    // This server action can be kept for any future server-side pre-checks if needed,
    // but the direct Firestore check with firebase-admin is removed to fix build issues.
    
    // For "marcoromau@gmail.com", we skip any DB check as a special admin case
    if (validatedData.email === 'marcoromau@gmail.com') {
      return { success: true };
    }

    // You could add other server-side checks here if necessary,
    // for example, checking against a non-Firebase user list or an IP blocklist.
    // For now, we just validate the schema and let the client handle auth.

    // A simple check that the user exists in your 'usuarios' collection can still be done
    // with the regular client SDK if this action is called from a server component
    // context where the admin is already authenticated, but for a public login form,
    // it's best to rely on Firebase Auth's client-side methods.

    return { success: true };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: "Datos inválidos.", errors: error.errors };
    }
    console.error("Server-side login validation error:", error);
    return { success: false, message: "Error desconocido en el servidor." };
  }
}
