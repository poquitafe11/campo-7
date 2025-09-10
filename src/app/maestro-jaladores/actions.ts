
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { JaladorSchema } from '@/lib/types';

const CreateJaladorSchema = JaladorSchema.pick({ alias: true }).extend({
    dni: z.string().optional(),
    nombre: z.string().optional(),
    celular: z.string().optional(),
});

export async function addJalador(values: z.infer<typeof CreateJaladorSchema>) {
    try {
        const validatedData = CreateJaladorSchema.parse(values);
        const docData = {
            alias: validatedData.alias,
            dni: validatedData.dni || "",
            nombre: validatedData.nombre || "",
            celular: validatedData.celular || "",
        };
        const docRef = await addDoc(collection(db, "maestro-jaladores"), docData);
        return { success: true, message: "Jalador creado.", id: docRef.id };
    } catch(error) {
        if (error instanceof z.ZodError) {
            return { success: false, message: 'Datos de formulario inválidos.', errors: error.errors };
        }
        console.error("Error creating jalador:", error);
        return { success: false, message: "No se pudo crear el jalador." };
    }
}
