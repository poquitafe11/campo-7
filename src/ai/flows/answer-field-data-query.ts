
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
  answer: z.string().describe('The answer to the question about the field data.'),
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
  3.  Puedes hacer comparaciones, cálculos y resúmenes. Sé específico y claro en tus respuestas.
  4.  **Cálculo de Pagos/Costos:** Si el usuario pregunta sobre "pago", "costo" o "cuánto se pagó", utiliza los datos de producción ('actividades'). La lógica es la siguiente:
      *   Si el campo 'cost' es mayor que 0, el costo de la labor es 'cost' * 'performance'.
      *   Si el campo 'cost' es 0, significa que se paga por jornal. Asume un costo de jornal de S/ 60. El costo total es 'workdayCount' * 60.
      *   Suma los costos de todas las actividades relevantes para dar una respuesta total si se te pregunta por un total.

  **DATOS DISPONIBLES:**

  ### Registros de Producción (Actividades)
  {{{productionLogs}}}

  ### Registros de Sanidad
  {{{healthLogs}}}

  ### Registros de Riego
  {{{irrigationLogs}}}


  **PREGUNTA DEL USUARIO:**
  {{query}}

  **RESPUESTA:**
  (Formula tu respuesta aquí, en español, basándote en el análisis de los datos y la pregunta)
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
