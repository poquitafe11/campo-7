
'use server';

// This file is deprecated. The logic has been moved to create/actions.ts
// It is kept to avoid breaking changes but should be removed in a future cleanup.

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ActivityRecordSchema } from '@/lib/types';


export async function saveActivity(values: z.infer<typeof ActivityRecordSchema>) {
  try {
    const validatedData = ActivityRecordSchema.parse(values);
    
    if (!validatedData.createdBy) {
      return { success: false, message: 'Usuario no autenticado.' };
    }

    const docRef = await addDoc(collection(db, 'actividades'), {
      ...validatedData,
      createdAt: serverTimestamp(),
    });

    return { success: true, message: 'Actividad guardada correctamente.', id: docRef.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Return a detailed error message from Zod
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, message: `Datos de formulario inválidos: ${errorMessages}` };
    }
    console.error('Error saving activity:', error);
    return { success: false, message: 'Ocurrió un error en el servidor.' };
  }
}
