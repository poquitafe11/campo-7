'use server';
/**
 * @fileOverview Summarizes key field data from production, health, irrigation, and quality control logs.
 *
 * - summarizeFieldData - A function that summarizes the field data.
 * - SummarizeFieldDataInput - The input type for the summarizeFieldData function.
 * - SummarizeFieldDataOutput - The return type for the summarizeFieldData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeFieldDataInputSchema = z.object({
  productionLogs: z.string().describe('Summary of production logs.'),
  healthLogs: z.string().describe('Summary of plant health logs.'),
  irrigationLogs: z.string().describe('Summary of irrigation logs.'),
  qualityControlLogs: z.string().describe('Summary of quality control logs.'),
  biologicalControlLogs: z.string().describe('Summary of biological control logs.'),
});
export type SummarizeFieldDataInput = z.infer<typeof SummarizeFieldDataInputSchema>;

const SummarizeFieldDataOutputSchema = z.object({
  summary: z.string().describe('A concise summary of the key field data.'),
});
export type SummarizeFieldDataOutput = z.infer<typeof SummarizeFieldDataOutputSchema>;

export async function summarizeFieldData(input: SummarizeFieldDataInput): Promise<SummarizeFieldDataOutput> {
  return summarizeFieldDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeFieldDataPrompt',
  input: {schema: SummarizeFieldDataInputSchema},
  output: {schema: SummarizeFieldDataOutputSchema},
  prompt: `You are an expert agronomist AI assistant. Your task is to analyze raw, line-by-line data logs from various farm activities and provide a concise, high-level summary.

  The user will provide data from different sections: Production, Health, Irrigation, Quality Control, and Biological Control.
  Review all the provided data and synthesize it into a single, coherent summary paragraph. Highlight key trends, potential issues, and important metrics.

  **Data Logs:**

  Production Logs:
  {{{productionLogs}}}

  Health Logs:
  {{{healthLogs}}}

  Irrigation Logs:
  {{{irrigationLogs}}}

  Quality Control Logs:
  {{{qualityControlLogs}}}

  Biological Control Logs:
  {{{biologicalControlLogs}}}

  **Instructions:**
  Based on all the data above, generate a single, easy-to-read summary. Do not just list the data. Interpret it. For example, mention things like "recent pest activity," "irrigation consistency," or "quality trends."
`,
});

const summarizeFieldDataFlow = ai.defineFlow(
  {
    name: 'summarizeFieldDataFlow',
    inputSchema: SummarizeFieldDataInputSchema,
    outputSchema: SummarizeFieldDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
