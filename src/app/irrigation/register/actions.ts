
'use server';

import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, FieldValue, deleteField } from 'firebase/firestore';

interface RenameAndMergePayload {
    oldHeader: string;
    newHeader: string;
}

const sanitizeFieldName = (name: string) => name.replace(/[.#$[\]/]/g, '').trim();

export async function renameAndMergeHeader({ oldHeader, newHeader }: RenameAndMergePayload): Promise<{ success: boolean; message: string; count?: number }> {
    if (!oldHeader || !newHeader) {
        return { success: false, message: 'El nombre antiguo y el nuevo no pueden estar vacíos.' };
    }
    
    const sanitizedOldHeader = sanitizeFieldName(oldHeader);
    const sanitizedNewHeader = sanitizeFieldName(newHeader);

    if (!sanitizedOldHeader || !sanitizedNewHeader) {
        return { success: false, message: 'Los nombres de los encabezados no son válidos después de la limpieza.' };
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

            // Use the original (unsanitized) oldHeader to check for property existence
            if (Object.prototype.hasOwnProperty.call(data, oldHeader)) {
                needsUpdate = true;
                const oldValueToMove = data[oldHeader];
                const existingValueInNew = data[sanitizedNewHeader];

                // Merge logic
                if (existingValueInNew !== undefined && existingValueInNew !== null && String(existingValueInNew).trim() !== '') {
                    if (oldValueToMove !== undefined && oldValueToMove !== null && String(oldValueToMove).trim() !== '') {
                        updateData[sanitizedNewHeader] = `${existingValueInNew}. ${oldValueToMove}`;
                    }
                } else {
                    updateData[sanitizedNewHeader] = oldValueToMove;
                }
                
                // Mark the old field for deletion using its original name
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
