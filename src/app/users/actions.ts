
"use server";

import { z } from "zod";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, getDocs, deleteDoc, updateDoc, getDoc } from "firebase/firestore";
import { User, UserSchema, UserRole } from "@/lib/types";
import { revalidatePath } from 'next/cache';

// NOTE: Functions requiring firebase-admin have been removed.
// User creation via server action is not supported with the client-side SDK.
// User status changes (enabling/disabling in Auth) also require admin privileges.
// These actions now only handle Firestore profile data.

export async function saveUser(values: z.infer<typeof UserSchema>) {
  try {
    const validatedData = UserSchema.parse(values);
    const docRef = doc(db, "usuarios", validatedData.email);

    await setDoc(docRef, validatedData, { merge: true });
    revalidatePath("/users");
    return { success: true, message: "Usuario guardado correctamente." };
  } catch (error) {
    console.error("Error guardando usuario: ", error);
    if (error instanceof z.ZodError) {
      return { success: false, message: "Datos inválidos.", errors: error.errors };
    }
    return { success: false, message: "No se pudo guardar el usuario." };
  }
}
