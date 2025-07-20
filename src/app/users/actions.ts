
"use server";

import { z } from "zod";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { UserSchema } from "@/lib/types";

export async function saveUser(values: z.infer<typeof UserSchema>) {
  try {
    const validatedData = UserSchema.parse(values);
    
    // Use email as the document ID for uniqueness
    const docRef = doc(db, "usuarios", validatedData.email);

    await setDoc(docRef, validatedData, { merge: true });

    return { success: true, message: "Usuario guardado correctamente." };
  } catch (error) {
    console.error("Error guardando usuario: ", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Datos inválidos.", errors: error.errors };
    }
    return { success: false, message: "No se pudo guardar el usuario." };
  }
}
