
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ActivityRecordSchema } from '@/lib/types';

export async function saveActivity(values: z.infer<typeof ActivityRecordSchema>) {
  try {
    const validatedData = ActivityRecordSchema.parse(values);
    
    // This new logic is simpler and more robust.
    // It trusts the validated data coming from the client and has fallbacks.
    const dataToSave = {
        ...validatedData,
        assistantDni: validatedData.assistantDni || 'N/A',
        assistantName: validatedData.assistantName || validatedData.createdBy,
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
