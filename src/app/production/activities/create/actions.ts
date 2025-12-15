
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp, getDoc, doc } from 'firebase/firestore';
import { ActivityRecordSchema } from '@/lib/types';
import { auth } from 'firebase-admin';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export async function saveActivity(values: z.infer<typeof ActivityRecordSchema>) {
  try {
    const validatedData = ActivityRecordSchema.parse(values);
    
    // Ensure assistantDni has a value. If not provided, it means the user is self-registering.
    // However, the form should already populate this for individual mode. This is a safeguard.
    if (!validatedData.assistantDni) {
        // This is a server-side check. A more robust way might be needed if users can submit without being logged in,
        // but our app structure with useAuth prevents that. For now, we can assume createdBy is reliable.
        // A better approach would be to get the logged-in user on the server.
        // For now we will rely on createdBy which is set on the client.
        const userEmail = validatedData.createdBy;
        const userDoc = await getDoc(doc(db, "usuarios", userEmail));
        if (userDoc.exists()) {
            validatedData.assistantDni = userDoc.data().dni;
            validatedData.assistantName = userDoc.data().nombre;
        } else {
             throw new Error("No se pudo verificar el asistente. El usuario creador no existe en la base de datos.");
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
