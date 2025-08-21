
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
            const updateData: { [key: string]: any } = {};
            let needsUpdate = false;

            if (Object.prototype.hasOwnProperty.call(data, oldHeader)) {
                needsUpdate = true;
                const oldValue = data[oldHeader];
                const newValue = data[newHeader];

                if (newValue !== undefined && newValue !== null && String(newValue).trim() !== '') {
                    // Merge logic: concatenate if both are non-empty strings
                    if (oldValue !== undefined && oldValue !== null && String(oldValue).trim() !== '') {
                        updateData[newHeader] = `${newValue}. ${oldValue}`;
                    }
                } else {
                    // Target is empty, just move the value
                    updateData[newHeader] = oldValue;
                }
                
                // Mark the old field for deletion
                updateData[oldHeader] = deleteField();
            }

            if (needsUpdate) {
                batch.update(doc.ref, updateData);
                updatedCount++;
            }
        });

        await batch.commit();

        return { success: true, message: 'Encabezados actualizados y fusionados correctamente.', count: updatedCount };

    } catch (error: any) {
        console.error("Error al renombrar y fusionar encabezado:", error);
        return { success: false, message: `Ocurrió un error en el servidor: ${error.message}` };
    }
}
