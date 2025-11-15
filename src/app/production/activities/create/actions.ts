
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

    let assistantName = validatedData.assistantName;
    
    // If assistantName is not provided but assistantDni is, fetch the name
    if (!assistantName && validatedData.assistantDni) {
        const assistantDocRef = doc(db, 'asistentes', validatedData.assistantDni);
        const assistantDocSnap = await getDoc(assistantDocRef);
        if (assistantDocSnap.exists()) {
            assistantName = assistantDocSnap.data().nombre;
        } else {
            // This case should ideally not happen if UI selects from master data
            return { success: false, message: `No se encontró el asistente con DNI: ${validatedData.assistantDni}` };
        }
    }
    
    if (!assistantName) {
        return { success: false, message: 'No se pudo determinar el nombre del asistente.' };
    }

    const docRef = await addDoc(collection(db, 'actividades'), {
      ...validatedData,
      assistantName, // Ensure the name is saved
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
