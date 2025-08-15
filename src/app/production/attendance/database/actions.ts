
'use server';

import { db } from '@/lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
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
