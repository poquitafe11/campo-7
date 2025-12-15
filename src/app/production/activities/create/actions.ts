'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { ActivityRecordSchema } from '@/lib/types';

export async function saveActivity(values: z.infer<typeof ActivityRecordSchema>) {
  try {
    const validatedData = ActivityRecordSchema.parse(values);
    
    if (!validatedData.createdBy) {
      return { success: false, message: 'Usuario no autenticado.' };
    }
    
    if (!validatedData.assistantName && !validatedData.assistantDni) {
        return { success: false, message: 'No se ha proporcionado un asistente.' };
    }

    const docRef = await addDoc(collection(db, 'actividades'), {
      ...validatedData,
      createdAt: serverTimestamp(),
    });

    return { success: true, message: 'Actividad guardada correctamente.', id: docRef.id };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, message: `Datos de formulario inválidos: ${errorMessages}` };
    }
    console.error('Error saving activity:', error);
    return { success: false, message: 'Ocurrió un error en el servidor.' };
  }
}
