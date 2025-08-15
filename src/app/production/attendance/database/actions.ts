
'use server';

import { db } from '@/lib/firebase';
import { doc, deleteDoc, getDoc, updateDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

export async function deleteAttendanceRecord(id: string) {
    try {
        const docRef = doc(db, 'asistencia', id);
        await deleteDoc(docRef);
        revalidatePath('/production/attendance/database');
        return { success: true, message: 'Registro de asistencia eliminado correctamente.' };
    } catch(error) {
        console.error('Error deleting attendance record:', error);
        return { success: false, message: 'No se pudo eliminar el registro de asistencia.' };
    }
}

export async function deleteAssistantFromRecord(recordId: string, assistantId: string) {
    try {
        const recordRef = doc(db, 'asistencia', recordId);
        const recordSnap = await getDoc(recordRef);

        if (!recordSnap.exists()) {
            return { success: false, message: 'No se encontró el registro.' };
        }

        const recordData = recordSnap.data();
        const initialAssistants = recordData.assistants || [];
        const updatedAssistants = initialAssistants.filter((a: any) => a.id !== assistantId);

        // If all assistants are removed, delete the entire record
        if (updatedAssistants.length === 0) {
            await deleteDoc(recordRef);
            revalidatePath('/production/attendance/database');
            return { success: true, message: 'Último asistente eliminado, registro completo borrado.' };
        }

        // Recalculate totals
        const newTotals = updatedAssistants.reduce((acc: any, a: any) => {
            acc.personnelCount += a.personnelCount || 0;
            acc.absentCount += a.absentCount || 0;
            return acc;
        }, { personnelCount: 0, absentCount: 0 });

        await updateDoc(recordRef, {
            assistants: updatedAssistants,
            totals: newTotals
        });

        revalidatePath('/production/attendance/database');
        return { success: true, message: 'Asistente eliminado del registro.' };

    } catch (error) {
        console.error('Error deleting assistant from record:', error);
        return { success: false, message: 'No se pudo eliminar el asistente del registro.' };
    }
}
