
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
  tableContent: z.string().describe('The full content of the table, extracted as a JSON array of objects, where each object represents a row. If the table cannot be extracted, return an empty array string "[]".'),
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

Analyze the image and transcribe the entire content of the table into a structured JSON array format.
Each object in the array should represent a row from the table. Use the table headers as the keys for the JSON objects.
The final output must be a single string containing a valid JSON array.

Example output format:
[
  { "Header 1": "Row 1 Col 1", "Header 2": "Row 1 Col 2" },
  { "Header 1": "Row 2 Col 1", "Header 2": "Row 2 Col 2" }
]

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
