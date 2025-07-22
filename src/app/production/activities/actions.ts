
'use server';

import { z } from 'zod';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ActivityRecordSchema } from '@/lib/types';
import { onAuthStateChanged } from 'firebase/auth';

// This function wraps onAuthStateChanged in a promise to get the current user
const getCurrentUser = () => {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, user => {
            unsubscribe();
            resolve(user);
        }, reject);
    });
};


export async function saveActivity(values: z.infer<typeof ActivityRecordSchema>) {
  try {
    const validatedData = ActivityRecordSchema.parse(values);
    
    const currentUser = await getCurrentUser() as { email: string | null } | null;

    if (!currentUser?.email) {
      return { success: false, message: 'Usuario no autenticado.' };
    }

    const docRef = await addDoc(collection(db, 'actividades'), {
      ...validatedData,
      createdBy: currentUser.email,
      createdAt: serverTimestamp(),
    });

    return { success: true, message: 'Actividad guardada correctamente.', id: docRef.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos de formulario inválidos.', errors: error.errors };
    }
    console.error('Error saving activity:', error);
    return { success: false, message: 'Ocurrió un error en el servidor.' };
  }
}
