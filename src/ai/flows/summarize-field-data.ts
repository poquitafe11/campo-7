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
  prompt: `You are an AI assistant that summarizes field data from various sources.

  Your goal is to provide a concise and informative summary of the key data provided, highlighting any potential issues or areas of concern.

  Production Logs: {{{productionLogs}}}
  Health Logs: {{{healthLogs}}}
  Irrigation Logs: {{{irrigationLogs}}}
  Quality Control Logs: {{{qualityControlLogs}}}

  Please provide a summary of the key data from these logs:
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
