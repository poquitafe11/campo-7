
'use server';
/**
 * @fileOverview An AI agent that digitizes a table from an image.
 *
 * - digitizeHealthTable - A function that handles the table digitization process.
 * - DigitizeHealthTableInput - The input type for the digitizeHealthTable function.
 * - DigitizeHealthTableOutput - The return type for the digitizeHealthTable function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DigitizeHealthTableInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a table, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DigitizeHealthTableInput = z.infer<typeof DigitizeHealthTableInputSchema>;

const DigitizeHealthTableOutputSchema = z.object({
  tableContent: z.string().describe('The full content of the table, extracted as plain text.'),
  structuredData: z.array(z.record(z.any())).describe('The table data extracted into a structured JSON array of objects, where each object represents a row.'),
});
export type DigitizeHealthTableOutput = z.infer<typeof DigitizeHealthTableOutputSchema>;

export async function digitizeHealthTable(input: DigitizeHealthTableInput): Promise<DigitizeHealthTableOutput> {
  return digitizeHealthTableFlow(input);
}

const prompt = ai.definePrompt({
  name: 'digitizeHealthTablePrompt',
  input: {schema: DigitizeHealthTableInputSchema},
  output: {schema: DigitizeHealthTableOutputSchema},
  prompt: `You are an expert data entry specialist. Your task is to accurately extract information from a table in the provided image.

Analyze the image and transcribe the entire content of the table into a structured format.
1. Extract the full table content as plain text. Preserve the rows and columns as best as you can.
2. Extract the table data into a structured JSON array, where each object in the array represents a row from the table. Use the table headers as the keys for the JSON objects.

Image with the table:
{{media url=photoDataUri}}`,
});

const digitizeHealthTableFlow = ai.defineFlow(
  {
    name: 'digitizeHealthTableFlow',
    inputSchema: DigitizeHealthTableInputSchema,
    outputSchema: DigitizeHealthTableOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
