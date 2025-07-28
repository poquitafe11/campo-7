
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ActivityRecordSchema } from '@/lib/types';
import { revalidatePath } from 'next/cache';

// We only need to allow updating a subset of fields.
// The ID, creation date, and creator should not be changed.
const UpdateActivityRecordSchema = ActivityRecordSchema.partial().omit({ createdBy: true });
type UpdateActivityRecordData = z.infer<typeof UpdateActivityRecordSchema>;


export async function updateActivity(id: string, values: UpdateActivityRecordData) {
  try {
    // We only validate the fields that are expected to be updated.
    const validatedData = UpdateActivityRecordSchema.parse(values);
    
    const docRef = doc(db, 'actividades', id);
    
    await updateDoc(docRef, {
      ...validatedData,
      // Ensure date is a Firestore-compatible format if it's being updated
      ...(validatedData.registerDate ? { registerDate: validatedData.registerDate } : {}),
    });
    
    revalidatePath('/production/activities/database');
    return { success: true, message: 'Actividad actualizada correctamente.' };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: 'Datos de formulario inválidos.', errors: error.errors };
    }
    console.error('Error updating activity:', error);
    return { success: false, message: 'Ocurrió un error en el servidor.' };
  }
}

export async function deleteActivity(id: string) {
    try {
        const docRef = doc(db, 'actividades', id);
        await deleteDoc(docRef);
        revalidatePath('/production/activities/database');
        return { success: true, message: 'Actividad eliminada correctamente.' };
    } catch(error) {
        console.error('Error deleting activity:', error);
        return { success: false, message: 'No se pudo eliminar la actividad.' };
    }
}
