
"use server";

import { answerFieldDataQuery } from "@/ai/flows/answer-field-data-query";
import { summarizeFieldData } from "@/ai/flows/summarize-field-data";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format } from "date-fns";

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
                    readableValue = format(value, 'PPP');
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

        const fieldDataSummary = await summarizeFieldData({
            productionLogs: stringifyForLLM(productionData, "Producción"),
            healthLogs: stringifyForLLM(healthData, "Sanidad"),
            irrigationLogs: stringifyForLLM(irrigationData, "Riego"),
            qualityControlLogs: "No hay datos disponibles.",
            biologicalControlLogs: "No hay datos disponibles.",
        });

        if (!fieldDataSummary.summary) {
            return { error: "No se pudo generar un resumen de los datos del campo." };
        }

        const result = await answerFieldDataQuery({
            query: query,
            fieldDataSummary: fieldDataSummary.summary,
        });

        return { answer: result.answer };

    } catch (error) {
        console.error("Error in askQuery action:", error);
        return { error: "Ocurrió un error al procesar tu consulta." };
    }
}
