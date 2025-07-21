
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

    if (!userData.active) {
        return { success: false, message: "La cuenta está inactiva. Contacte al administrador." };
    }
    
    return { success: true };

  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: "Datos inválidos.", errors: error.errors };
    }
    return { success: false, message: "Error desconocido en el servidor." };
  }
}
