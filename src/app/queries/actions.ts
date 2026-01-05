
'use server';

export async function askQuery(query: string) {
    try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/ai/answerFieldDataQuery`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(errorBody.message || 'Error en la respuesta de la API.');
        }

        const result = await response.json();

        return { answer: result.answer };

    } catch (error: any) {
        console.error("Error in askQuery action:", error);
        return { error: error.message || 'Ocurrió un error al procesar tu consulta.' };
    }
}
