
'use server';

import { answerFieldDataQuery } from "@/lib/ai/flows/answer-field-data-query";
import type { AnswerFieldDataQueryInput } from "@/lib/ai/flows/answer-field-data-query";

export async function askQuery(query: string) {
    try {
        const result = await answerFieldDataQuery({ query });

        if (!result || !result.answer) {
             return { error: "La IA no pudo generar una respuesta." };
        }
        
        return { answer: result.answer };

    } catch (error: any) {
        console.error("Error in askQuery action:", error);
        return { error: error.message || 'Ocurrió un error al procesar tu consulta.' };
    }
}
