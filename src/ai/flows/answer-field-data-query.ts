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
  fieldDataSummary: z.string().describe('A summary of the field data.'),
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
  prompt: `You are an AI assistant that answers questions about field data.

  Use the following field data summary to answer the question.

  Field Data Summary:
  {{fieldDataSummary}}

  Question:
  {{query}}

  Answer:
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
