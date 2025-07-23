
"use server";

import { z } from "zod";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

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

    const userDocRef = doc(db, "usuarios", validatedData.email);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
        return { success: false, message: "Usuario no encontrado." };
    }

    const userData = userDocSnap.data();

    // Do not check for `active` status here.
    // AuthProvider will handle inactive users by logging them out.
    // This simplifies logic and prevents race conditions.
    
    return { success: true };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: "Datos inválidos.", errors: error.errors };
    }
    console.error("Server-side login validation error:", error);
    return { success: false, message: "Error desconocido en el servidor." };
  }
}
