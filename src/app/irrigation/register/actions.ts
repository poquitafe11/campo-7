
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, FieldValue, deleteField } from 'firebase/firestore';

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
        const collectionRef = collection(db, 'registros-riego');
        const querySnapshot = await getDocs(collectionRef);
        
        if (querySnapshot.empty) {
            return { success: true, message: 'No hay registros para actualizar.', count: 0 };
        }

        const batch = writeBatch(db);
        let updatedCount = 0;

        querySnapshot.forEach(doc => {
            const data = doc.data();
            
            // Check if the document has the old header property.
            if (Object.prototype.hasOwnProperty.call(data, oldHeader)) {
                const updateData: { [key: string]: any } = {};
                const oldValueToMove = data[oldHeader];

                // Assign the old value to the new key.
                updateData[sanitizedNewHeader] = oldValueToMove;
                
                // IMPORTANT: Mark the old field for deletion.
                // This will be part of the same update operation.
                updateData[oldHeader] = deleteField();

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
