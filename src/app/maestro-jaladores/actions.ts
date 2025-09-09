
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { JaladorSchema } from '@/lib/types';

const CreateJaladorSchema = JaladorSchema.omit({ id: true });

export async function addJalador(values: z.infer<typeof CreateJaladorSchema>) {
    try {
        const validatedData = CreateJaladorSchema.parse(values);
        const docRef = await addDoc(collection(db, "maestro-jaladores"), validatedData);
        return { success: true, message: "Jalador creado.", id: docRef.id };
    } catch(error) {
        if (error instanceof z.ZodError) {
            return { success: false, message: 'Datos de formulario inválidos.', errors: error.errors };
        }
        console.error("Error creating jalador:", error);
        return { success: false, message: "No se pudo crear el jalador." };
    }
}
