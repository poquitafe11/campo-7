"use server";

import { getFirebaseAdmin } from '@/ai-flows-server/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

interface RenameAndMergePayload {
    oldHeader: string;
    newHeader: string;
}

export async function renameAndMergeHeader({ oldHeader, newHeader }: RenameAndMergePayload): Promise<{ success: boolean; message: string; count?: number }> {
    if (!oldHeader || !newHeader) {
        return { success: false, message: 'El nombre antiguo y el nuevo no pueden estar vacíos.' };
    }
    
    const sanitizedNewHeader = newHeader.trim();

    try {
        const adminApp = getFirebaseAdmin();
        const db = getFirestore(adminApp);
        const collectionRef = db.collection('registros-riego-01');
        const querySnapshot = await collectionRef.get();
        
        if (querySnapshot.empty) {
            return { success: true, message: 'No hay registros para actualizar.', count: 0 };
        }

        const batch = db.batch();
        let updatedCount = 0;

        querySnapshot.forEach(doc => {
            const data = doc.data();
            
            if (Object.prototype.hasOwnProperty.call(data, oldHeader)) {
                const updateData: { [key: string]: any } = {};
                const oldValueToMove = data[oldHeader];

                updateData[sanitizedNewHeader] = oldValueToMove;
                updateData[oldHeader] = (adminApp as any).firestore.FieldValue.delete();

                batch.update(doc.ref, updateData);
                updatedCount++;
            }
        });

        if (updatedCount > 0) {
            await batch.commit();
        }

        return { success: true, message: 'Encabezados actualizados y fusionados correctamente.', count: updatedCount };

    } catch (error: any) {
        console.error("Error al renombrar y fusionar encabezado:", error);
        return { success: false, message: `Ocurrió un error en el servidor: ${error.message}` };
    }
}
