
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ActivityRecordSchema } from '@/lib/types';


// This schema is now simplified as most logic is on the client.
const SaveActivitySchema = ActivityRecordSchema.extend({
    registerDate: z.union([z.date(), z.string()]), // Accept string from server action
});


export async function saveActivity(values: z.infer<typeof SaveActivitySchema>) {
  try {
    // The data is pre-validated and structured on the client.
    // The server's job is just to save it.
    const dataToSave = {
        ...values,
        // Ensure date is a Firestore Timestamp before saving.
        registerDate: Timestamp.fromDate(new Date(values.registerDate)),
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
    // Provide a more specific error message if possible
    const errorMessage = (error instanceof Error) ? error.message : 'Ocurrió un error desconocido en el servidor.';
    return { success: false, message: `Ocurrió un error en el servidor: ${errorMessage}` };
  }
}
