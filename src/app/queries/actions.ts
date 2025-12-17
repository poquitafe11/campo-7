
"use server";

import { answerFieldDataQuery } from "@/ai/flows/answer-field-data-query";

export async function askQuery(query: string) {
    try {
        const result = await answerFieldDataQuery({ query });

        return { answer: result.answer };

    } catch (error: any) {
        console.error("Error in askQuery action:", error);
        // It's better to provide a specific error message if available
        let errorMessage = "Ocurrió un error al procesar tu consulta en el servidor.";
        if (error.message && error.message.includes('Schema validation failed')) {
            errorMessage = "La IA no pudo generar una respuesta con el formato esperado. Intenta ser más específico en tu pregunta.";
        } else if (error.message) {
            errorMessage = error.message;
        }
        return { error: errorMessage };
    }
}
