
'use server';
/**
 * @fileOverview Un agente de IA que responde preguntas sobre datos de campo utilizando herramientas para buscar en la base de datos.
 *
 * - answerFieldDataQuery - Función que maneja el proceso de respuesta a preguntas.
 * - AnswerFieldDataQueryInput - El tipo de entrada para la función answerFieldDataQuery.
 * - AnswerFieldDataQueryOutput - El tipo de retorno para la función answerFieldDataQuery.
 */

import { ai } from '@/ai/genkit';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const AnswerFieldDataQueryInputSchema = z.object({
  query: z.string().describe('La pregunta sobre los datos de campo.'),
});
export type AnswerFieldDataQueryInput = z.infer<typeof AnswerFieldDataQueryInputSchema>;

const AnswerFieldDataQueryOutputSchema = z.object({
  answer: z.string().describe('La respuesta a la pregunta sobre los datos de campo, formateada como un único string HTML.'),
});
export type AnswerFieldDataQueryOutput = z.infer<typeof AnswerFieldDataQueryOutputSchema>;


// Herramienta para obtener registros de producción
const getProductionActivities = ai.defineTool(
  {
    name: 'getProductionActivities',
    description: 'Obtiene registros de la colección "actividades" (datos de producción y labores). Úsalo para preguntas sobre costos, rendimiento, personal, jornadas, etc.',
    inputSchema: z.object({
      searchTerm: z.string().optional().describe('Un término de búsqueda opcional para filtrar por el campo "labor". Ej: "poda", "raleo", "desbrote".'),
    }),
    outputSchema: z.string().describe('Un string JSON de los registros de actividades encontrados.'),
  },
  async (input) => {
    const activitiesRef = collection(db, 'actividades');
    const snapshot = await getDocs(activitiesRef);
    
    const allActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!input.searchTerm) {
        return JSON.stringify(allActivities);
    }
    
    const lowerCaseSearchTerm = input.searchTerm.toLowerCase();
    const filtered = allActivities.filter(act => {
        // Make sure 'labor' exists and is a string before calling toLowerCase
        return act.labor && typeof act.labor === 'string' && act.labor.toLowerCase().includes(lowerCaseSearchTerm);
    });
    
    return JSON.stringify(filtered);
  }
);


// Herramienta para obtener registros de sanidad
const getHealthRecords = ai.defineTool(
  {
    name: 'getHealthRecords',
    description: 'Obtiene registros de la colección "registros-sanidad". Úsalo para preguntas sobre aplicaciones de productos, enfermedades, plagas, ingredientes activos.',
    inputSchema: z.object({
      searchTerm: z.string().optional().describe('Un término de búsqueda opcional para filtrar por cualquier campo del registro (producto, objetivo, etc). Ej: "oidio", "insecticida".'),
    }),
    outputSchema: z.string().describe('Un string JSON de los registros de sanidad encontrados.'),
  },
  async (input) => {
    const healthRef = collection(db, 'registros-sanidad');
    const snapshot = await getDocs(healthRef);
    
    const allRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!input.searchTerm) {
        return JSON.stringify(allRecords);
    }
    
    const lowerCaseSearchTerm = input.searchTerm.toLowerCase();
    const filtered = allRecords.filter(record => 
        Object.values(record).some(val => 
            val && String(val).toLowerCase().includes(lowerCaseSearchTerm)
        )
    );
    
    return JSON.stringify(filtered);
  }
);

// Herramienta para obtener registros de riego
const getIrrigationRecords = ai.defineTool(
  {
    name: 'getIrrigationRecords',
    description: 'Obtiene registros de la colección "registros-riego-01". Úsalo para preguntas sobre riego, fertilizantes, unidades de nutrientes (N, P, K, etc.).',
    inputSchema: z.object({
      searchTerm: z.string().optional().describe('Un término de búsqueda opcional para filtrar por cualquier campo. Ej: "nitrógeno", "Lote 78".'),
    }),
    outputSchema: z.string().describe('Un string JSON de los registros de riego encontrados.'),
  },
  async (input) => {
    const irrigationRef = collection(db, 'registros-riego-01');
    const snapshot = await getDocs(irrigationRef);
    
    const allRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!input.searchTerm) {
        return JSON.stringify(allRecords);
    }

    const lowerCaseSearchTerm = input.searchTerm.toLowerCase();
    const filtered = allRecords.filter(record => 
        Object.values(record).some(val => 
            val && String(val).toLowerCase().includes(lowerCaseSearchTerm)
        )
    );

    return JSON.stringify(filtered);
  }
);

// Prompt principal que utiliza las herramientas
const answerer = ai.definePrompt({
  name: 'answerFieldDataQueryPrompt',
  input: { schema: AnswerFieldDataQueryInputSchema },
  output: { schema: AnswerFieldDataQueryOutputSchema },
  tools: [getProductionActivities, getHealthRecords, getIrrigationRecords],
  prompt: `Eres un asistente experto en agronomía y análisis de datos agrícolas. Tu principal tarea es responder preguntas del usuario de forma precisa y clara.
  
  **Instrucciones Clave:**
  1.  **Analiza la pregunta del usuario**: Determina qué tipo de información necesita (costos, rendimiento, aplicaciones, riego, etc.).
  2.  **Usa las herramientas**: Llama a una o más de las herramientas disponibles para obtener los datos relevantes de la base de datos. Sé específico con el 'searchTerm' si es necesario. Por ejemplo, si el usuario pregunta por "poda", usa el término "poda" en la herramienta \`getProductionActivities\`.
  3.  **Formato de Respuesta OBLIGATORIO**:
      *   **Para comparaciones o listas de datos**: Si el usuario pide comparar, listar o resumir datos de varios lotes o registros, DEBES presentar tu respuesta en una tabla HTML. La tabla debe tener estilos básicos para ser legible (ej: <table style="width: 100%; border-collapse: collapse;">, <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">, <td style="border: 1px solid #ddd; padding: 8px;">). Asegúrate de incluir las columnas relevantes.
      *   **Para respuestas textuales**: Si la respuesta es un texto o un cálculo simple, DEBES envolverla en un tag <p>.
      *   **IMPORTANTE**: TU RESPUESTA FINAL DEBE SER UN ÚNICO STRING HTML. No respondas solo texto plano.
  4.  **Agrupación y Comparación**: Si una pregunta requiere una comparación entre lotes (ej. "compara los costos de desbrote"), DEBES agrupar los datos por 'Lote'. Presenta una tabla con **una sola fila por cada lote**, mostrando los valores clave. NO listes cada registro individual.
  5.  **Aporta Valor Adicional**: Después de responder la pregunta (ya sea con texto o una tabla), agrega una sección llamada "<strong>Observaciones Adicionales</strong>". En esta sección, dentro de un tag <p>, proporciona un breve análisis o dato interesante que no se pidió explícitamente pero que sea relevante para la toma de decisiones.
  6.  **Cálculos de Costos**: Si el usuario pregunta sobre "pago total", "costo total" o "cuánto se pagó en total" para una actividad, usa los datos de producción ('actividades'). El costo se calcula así: si 'cost' > 0, el costo es 'cost * performance'. Si 'cost' == 0 o no está definido, se paga por jornal; asume un costo de jornal de S/ 60 y el costo es 'workdayCount * 60'. Suma todos los costos individuales para obtener el total.
  7.  **Idioma**: RESPONDE SIEMPRE EN ESPAÑOL.
  
  **PREGUNTA DEL USUARIO:**
  {{query}}

  Formula tu respuesta aquí, en español y siguiendo estrictamente las reglas de formato HTML.
`,
});

const answerFieldDataQueryFlow = ai.defineFlow(
  {
    name: 'answerFieldDataQueryFlow',
    inputSchema: AnswerFieldDataQueryInputSchema,
    outputSchema: AnswerFieldDataQueryOutputSchema,
  },
  async (input) => {
    const llmResponse = await ai.generate({
      prompt: answerer.prompt,
      model: googleAI.model('gemini-1.5-flash'),
      input: input,
      tools: [getProductionActivities, getHealthRecords, getIrrigationRecords],
      output: {
        schema: AnswerFieldDataQueryOutputSchema,
      }
    });

    return llmResponse.output() || { answer: '' };
  }
);

export async function answerFieldDataQuery(input: AnswerFieldDataQueryInput): Promise<AnswerFieldDataQueryOutput> {
  const result = await answerFieldDataQueryFlow(input);
  // Asegurarnos de que siempre devolvemos un objeto válido, incluso si la IA devuelve null.
  if (!result || !result.answer) {
    return { answer: "<p>La IA no pudo generar una respuesta con el formato esperado. Intenta ser más específico en tu pregunta.</p>" };
  }
  return result;
}
