"use server";

import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const settingsDocRef = doc(db, 'app-settings', 'irrigation01');

export async function getVisibleLotesSetting(): Promise<string[]> {
    try {
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return data.visibleLotes || [];
        }
        return [];
    } catch (error) {
        console.error("Error fetching visible lotes setting: ", error);
        return [];
    }
}

export async function saveVisibleLotesSetting(lotes: string[]): Promise<{ success: boolean; message?: string }> {
    try {
        await setDoc(settingsDocRef, { visibleLotes: lotes });
        return { success: true };
    } catch (error) {
        console.error("Error saving visible lotes setting: ", error);
        return { success: false, message: 'No se pudo guardar la configuración.' };
    }
}
