
'use server';
/**
 * @fileOverview An AI agent that digitizes an irrigation table from an image.
 *
 * - digitizeIrrigationTable - A function that handles the table digitization process.
 * - DigitizeIrrigationTableInput - The input type for the digitizeIrrigationTable function.
 * - DigitizeIrrigationTableOutput - The return type for the digitizeIrrigationTable function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DigitizeIrrigationTableInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a table, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type DigitizeIrrigationTableInput = z.infer<typeof DigitizeIrrigationTableInputSchema>;

const DigitizeIrrigationTableOutputSchema = z.object({
  tableContent: z.string().describe('The full content of the table, extracted as a JSON array of objects, where each object represents a row. If the table cannot be extracted, return an empty array string "[]".'),
});
export type DigitizeIrrigationTableOutput = z.infer<typeof DigitizeIrrigationTableOutputSchema>;

export async function digitizeIrrigationTable(input: DigitizeIrrigationTableInput): Promise<DigitizeIrrigationTableOutput> {
  return digitizeIrrigationTableFlow(input);
}

const prompt = ai.definePrompt({
  name: 'digitizeIrrigationTablePrompt',
  input: {schema: DigitizeIrrigationTableInputSchema},
  output: {schema: DigitizeIrrigationTableOutputSchema},
  prompt: `You are an expert data entry specialist. Your task is to accurately extract information from an irrigation and fertigation table in the provided image.

Analyze the image and transcribe the entire content of the table into a structured JSON array format.
Each object in the array should represent a row from the table. Use the table headers as the keys for the JSON objects.
Ensure all values, including numbers and text, are extracted precisely. The final output must be a single string containing a valid JSON array.

Example output format:
[
  { "Fecha": "15/07/2024", "Lote": "1", "Cuartel": "A", "Insumo 1": "10.5", "Insumo 2": "5.2" },
  { "Fecha": "16/07/2024", "Lote": "2", "Cuartel": "B", "Insumo 1": "11.0", "Insumo 2": "5.5" }
]

Image with the table:
{{media url=photoDataUri}}`,
});

const digitizeIrrigationTableFlow = ai.defineFlow(
  {
    name: 'digitizeIrrigationTableFlow',
    inputSchema: DigitizeIrrigationTableInputSchema,
    outputSchema: DigitizeIrrigationTableOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
