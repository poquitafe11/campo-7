
"use server";

import { answerFieldDataQuery } from "@/ai/flows/answer-field-data-query";
import { summarizeFieldData } from "@/ai/flows/summarize-field-data";
import { AppState } from "@/lib/types";

function stringifyForLLM(data: any[]): string {
    if (data.length === 0) return "No hay datos disponibles.";
    return data.map(item => JSON.stringify(item)).join('\n');
}

export async function askQuery(query: string, data: AppState) {
    try {
        const fieldDataSummary = await summarizeFieldData({
            productionLogs: stringifyForLLM(data.production),
            healthLogs: stringifyForLLM(data.health),
            irrigationLogs: stringifyForLLM(data.irrigation),
            qualityControlLogs: stringifyForLLM(data.qualityControl),
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
