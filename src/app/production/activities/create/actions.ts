'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, getDoc, doc } from 'firebase/firestore';
import { ActivityRecordSchema } from '@/lib/types';

export async function saveActivity(values: z.infer<typeof ActivityRecordSchema>) {
  try {
    const validatedData = ActivityRecordSchema.parse(values);
    
    // Fallback to get assistantDni from the user record if it's not provided.
    // This happens in individual mode when a non-assistant user (like an Admin) registers an activity.
    if (!validatedData.assistantDni) {
        const userEmail = validatedData.createdBy;
        if (userEmail) {
            const userDoc = await getDoc(doc(db, "usuarios", userEmail));
            if (userDoc.exists()) {
                validatedData.assistantDni = userDoc.data().dni;
                validatedData.assistantName = userDoc.data().nombre;
            } else {
                 // As a last resort, if user is not in 'usuarios' but is authenticated, use a placeholder.
                 // This case should be rare.
                 validatedData.assistantDni = 'N/A';
                 validatedData.assistantName = validatedData.createdBy;
            }
        } else {
            return { success: false, message: 'No se pudo identificar al creador del registro.' };
        }
    }
    
    const dataToSave = {
        ...validatedData,
        registerDate: Timestamp.fromDate(validatedData.registerDate),
        createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, 'actividades'), dataToSave);

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
