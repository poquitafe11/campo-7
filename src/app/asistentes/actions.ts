
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const CreateAsistenteSchema = z.object({
    nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    dni: z.string().length(8, "El DNI debe tener 8 dígitos."),
    cargo: z.string().min(3, "El cargo es requerido."),
});

export async function addAsistente(values: z.infer<typeof CreateAsistenteSchema>) {
    try {
        const validatedData = CreateAsistenteSchema.parse(values);
        
        const docRef = doc(db, "asistentes", validatedData.dni);

        await setDoc(docRef, { 
            nombre: validatedData.nombre,
            cargo: validatedData.cargo,
        });

        return { success: true, message: "Asistente creado.", id: validatedData.dni };

    } catch(error) {
        if (error instanceof z.ZodError) {
            return { success: false, message: 'Datos de formulario inválidos.', errors: error.errors };
        }
        console.error("Error creating asistente:", error);
        return { success: false, message: "No se pudo crear el asistente." };
    }
}
