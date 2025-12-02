
'use server';
/**
 * @fileOverview An AI agent that answers questions about field data.
 *
 * - answerFieldDataQuery - A function that handles answering questions about field data.
 * - AnswerFieldDataQueryInput - The input type for the answerFieldDataQuery function.
 * - AnswerFieldDataQueryOutput - The return type for the answerFieldDataQuery function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnswerFieldDataQueryInputSchema = z.object({
  query: z.string().describe('The question about the field data.'),
  productionLogs: z.string().describe('Summary of production logs (from "actividades" collection).'),
  healthLogs: z.string().describe('Summary of plant health logs (from "registros-sanidad" collection).'),
  irrigationLogs: z.string().describe('Summary of irrigation logs (from "registros-riego" collection).'),
});
export type AnswerFieldDataQueryInput = z.infer<typeof AnswerFieldDataQueryInputSchema>;

const AnswerFieldDataQueryOutputSchema = z.object({
  answer: z.string().describe('The answer to the question about the field data, formatted as a single HTML string.'),
});
export type AnswerFieldDataQueryOutput = z.infer<typeof AnswerFieldDataQueryOutputSchema>;

export async function answerFieldDataQuery(input: AnswerFieldDataQueryInput): Promise<AnswerFieldDataQueryOutput> {
  return answerFieldDataQueryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'answerFieldDataQueryPrompt',
  input: {schema: AnswerFieldDataQueryInputSchema},
  output: {schema: AnswerFieldDataQueryOutputSchema},
  prompt: `Eres un asistente experto en agronomía y análisis de datos agrícolas. Tu principal tarea es responder preguntas basadas en los datos de campo que se te proporcionan.

  **Instrucciones Clave:**
  1.  **RESPONDE SIEMPRE EN ESPAÑOL.**
  2.  Analiza la pregunta del usuario y utiliza los datos de los registros de producción, sanidad y riego para formular una respuesta precisa.
  3.  **Agrupación de Datos:** Si una pregunta requiere una comparación entre lotes (ej. "compara los costos de desbrote"), DEBES agrupar los datos por 'Lote'. Presenta una tabla con **una sola fila por cada lote**, mostrando los valores clave (costos, promedios, etc.) para ese lote. NO listes cada registro individual. Para obtener los valores de la fila de un lote, debes promediar o sumar los valores de todos los registros de ese lote.
  4.  **Formato de Respuesta:** TU RESPUESTA DEBE SER UN ÚNICO STRING HTML. Si el usuario pide comparar datos entre diferentes lotes (como costos, rendimientos, etc.), DEBES presentar tu respuesta en una tabla HTML. La tabla debe tener estilos básicos para ser legible (ej: <table style="width: 100%; border-collapse: collapse;">, <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">, <td style="border: 1px solid #ddd; padding: 8px;">). Asegúrate de incluir las columnas relevantes.
  5.  **Aporta Valor Adicional:** Después de responder la pregunta (ya sea con texto o una tabla), agrega una sección llamada "<strong>Observaciones Adicionales</strong>". En esta sección, dentro de un tag <p>, proporciona un breve análisis o dato interesante que no se pidió explícitamente pero que sea relevante para la toma de decisiones. Por ejemplo: "El Lote 74 tuvo el costo por planta más alto" o "El rendimiento promedio general fue de X".
  6.  **Definiciones de Columnas en Tabla Comparativa:**
      *   **Lote:** El número del lote.
      *   **Promedio:** Es el **promedio** del campo \`performance\` para todos los registros de la misma labor en un lote. No es la suma.
      *   **Costo Neto por Planta (S/):** Es el **promedio** del campo \`cost\` para todos los registros de la misma labor en un lote. Este es el costo unitario.
      *   **Rango de Costos (S/):** **SOLO si** para una misma labor en un mismo lote existen **diferentes valores** en el campo \`cost\`, agrega esta columna. Muestra el valor mínimo y máximo encontrados, ej: "0.90 - 1.10". Si todos los costos son iguales para ese lote, NO incluyas esta columna.
      *   **Jrn/Ha:** Jornadas por Hectárea. Se calcula dividiendo el total de jornadas ('workdayCount') de un lote entre el área ('Ha') de ese lote. Necesitarás cruzar la información de producción con los datos de los lotes para obtener el área 'Ha'. Si el área no está disponible, muestra 'N/A'.
  7.  **Cálculos de Costos Totales (para análisis, no para la tabla principal):**
      *   Si el usuario pregunta sobre "pago total", "costo total" o "cuánto se pagó en total", utiliza los datos de producción ('actividades').
      *   **Costo Total por Actividad:** Si 'cost' > 0, el costo es \`cost * performance\`. Si 'cost' == 0, se paga por jornal, asume un costo de jornal de S/ 60 y el costo es \`workdayCount * 60\`.
  
  **DATOS DISPONIBLES:**

  ### Registros de Producción (Actividades)
  {{{productionLogs}}}

  ### Registros de Sanidad
  {{{healthLogs}}}

  ### Registros de Riego
  {{{irrigationLogs}}}

  **PREGUNTA DEL USUARIO:**
  {{query}}

  **RESPUESTA (en un solo string HTML):**
  (Formula tu respuesta aquí, en español, usando una tabla HTML si es una comparación, y siempre agregando observaciones adicionales al final.)
`,
});

const answerFieldDataQueryFlow = ai.defineFlow(
  {
    name: 'answerFieldDataQueryFlow',
    inputSchema: AnswerFieldDataQueryInputSchema,
    outputSchema: AnswerFieldDataQueryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
