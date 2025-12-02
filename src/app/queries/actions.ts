
"use server";

import { answerFieldDataQuery } from "@/ai/flows/answer-field-data-query";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";
import { es } from 'date-fns/locale';

function stringifyForLLM(data: any[], type: string): string {
    if (data.length === 0) return "No hay datos disponibles.";

    return data.map(item => {
        const { id, ...rest } = item;
        const readableItem = Object.entries(rest)
            .map(([key, value]) => {
                let readableValue: string;
                if (value && typeof value === 'object' && value.toDate) { // Firestore Timestamp
                    try {
                        readableValue = format(value.toDate(), 'PPP', { locale: es });
                    } catch {
                        readableValue = new Date().toISOString();
                    }
                } else if (value instanceof Date) {
                    readableValue = format(value, 'PPP', { locale: es });
                } else if (typeof value === 'object' && value !== null) {
                    readableValue = JSON.stringify(value);
                } else {
                    readableValue = String(value);
                }
                return `${key}: ${readableValue}`;
            })
            .join(', ');
        return `- (${type}) ${readableItem}`;
    }).join('\n');
}


export async function askQuery(query: string) {
    try {
        const [
            productionSnapshot,
            healthSnapshot,
            irrigationSnapshot
        ] = await Promise.all([
            getDocs(collection(db, "actividades")),
            getDocs(collection(db, "registros-sanidad")),
            getDocs(collection(db, "registros-riego"))
        ]);
        
        const productionData = productionSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const healthData = healthSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const irrigationData = irrigationSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        const result = await answerFieldDataQuery({
            query: query,
            productionLogs: stringifyForLLM(productionData, "Producción"),
            healthLogs: stringifyForLLM(healthData, "Sanidad"),
            irrigationLogs: stringifyForLLM(irrigationData, "Riego"),
        });

        return { answer: result.answer };

    } catch (error) {
        console.error("Error in askQuery action:", error);
        return { error: "Ocurrió un error al procesar tu consulta." };
    }
}
