
"use server";

import { answerFieldDataQuery } from "@/ai/flows/answer-field-data-query";
import { summarizeFieldData } from "@/ai/flows/summarize-field-data";
import { AppState } from "@/lib/types";
import { format } from "date-fns";

function stringifyForLLM(data: any[], type: string): string {
    if (data.length === 0) return "No hay datos disponibles.";

    return data.map(item => {
        const readableItem = Object.entries(item)
            .filter(([key]) => key !== 'id')
            .map(([key, value]) => {
                let readableValue: string;
                if (value instanceof Date) {
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


export async function askQuery(query: string, data: AppState) {
    try {
        const fieldDataSummary = await summarizeFieldData({
            productionLogs: stringifyForLLM(data.production, "Producción"),
            healthLogs: stringifyForLLM(data.health, "Sanidad"),
            irrigationLogs: stringifyForLLM(data.irrigation, "Riego"),
            qualityControlLogs: stringifyForLLM(data.qualityControl, "Control de Calidad"),
            biologicalControlLogs: stringifyForLLM(data.biologicalControl, "Control Biológico"),
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
