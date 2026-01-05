

// This flow is no longer used for queries and has been effectively replaced by the logic in answer-field-data-query.ts
// It is kept temporarily to avoid breaking any other potential dependencies.

'use server';
/**
 * @fileOverview Summarizes key field data from production, health, irrigation, and quality control logs.
 *
 * - summarizeFieldData - A function that summarizes the field data.
 * - SummarizeFieldDataInput - The input type for the summarizeFieldData function.
 * - SummarizeFieldDataOutput - The return type for the summarizeFieldData function.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'genkit';
import { defineFlow } from 'genkit';

const SummarizeFieldDataInputSchema = z.object({
  productionLogs: z.string().describe('Summary of production logs (from "actividades" collection).'),
  healthLogs: z.string().describe('Summary of plant health logs (from "registros-sanidad" collection).'),
  irrigationLogs: z.string().describe('Summary of irrigation logs (from "registros-riego" collection).'),
  qualityControlLogs: z.string().describe('Summary of quality control logs.'),
  biologicalControlLogs: z.string().describe('Summary of biological control logs.'),
});
export type SummarizeFieldDataInput = z.infer<typeof SummarizeFieldDataInputSchema>;

const SummarizeFieldDataOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the key field data.'),
});
export type SummarizeFieldDataOutput = z.infer<typeof SummarizeFieldDataOutputSchema>;

export const summarizeFieldDataFlow = defineFlow(
  {
    name: 'summarizeFieldDataFlow',
    inputSchema: SummarizeFieldDataInputSchema,
    outputSchema: SummarizeFieldDataOutputSchema,
  },
  async (input) => {
    
    const ai = genkit({
      plugins: [googleAI()],
    });

    const llmResponse = await ai.generate({
      model: googleAI.model('gemini-1.5-flash'),
      prompt: `You are an expert agronomist AI assistant. Your task is to analyze raw, line-by-line data logs from various farm activities and provide a concise, high-level summary.

      The user will provide data from different sections: Production, Health, Irrigation, Quality Control, and Biological Control.
      Review all the provided data and synthesize it into a single, coherent summary paragraph. Highlight key trends, potential issues, and important metrics.
      When comparing data, be specific about dates, lotes (fields), and values.
    
      **Data Logs:**
    
      Production Logs (from "actividades" collection):
      ${input.productionLogs}
    
      Health Logs (from "registros-sanidad" collection):
      ${input.healthLogs}
    
      Irrigation Logs (from "registros-riego" collection):
      ${input.irrigationLogs}
    
      Quality Control Logs:
      ${input.qualityControlLogs}
    
      Biological Control Logs:
      ${input.biologicalControlLogs}
    
      **Instructions:**
      Based on all the data above, generate a single, easy-to-read summary. Do not just list the data. Interpret it. For example, mention things like "recent pest activity," "irrigation consistency," or "quality trends."
    `,
      output: {
        format: 'json',
        schema: SummarizeFieldDataOutputSchema,
      },
    });

    const output = llmResponse.output();
    if (!output) {
      throw new Error("La IA no pudo generar una respuesta.");
    }
    return output;
  }
);
