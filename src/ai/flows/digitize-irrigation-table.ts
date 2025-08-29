
'use server';
/**
 * @fileOverview An AI agent that digitizes up to four separate irrigation tables from a single image.
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

// The output will be a JSON string containing an object with up to four arrays, one for each table.
const DigitizeIrrigationTableOutputSchema = z.object({
  tableContent: z.string().describe('A single JSON string containing an object with four keys: "tabla1", "tabla2", "tabla3", and "tabla4". Each key holds a JSON array of objects for each table found. If a table is not found, its array should be empty. Example: {"tabla1": [...], "tabla2": [...], "tabla3": [...], "tabla4": [...]}.'),
});
export type DigitizeIrrigationTableOutput = z.infer<typeof DigitizeIrrigationTableOutputSchema>;

export async function digitizeIrrigationTable(input: DigitizeIrrigationTableInput): Promise<DigitizeIrrigationTableOutput> {
  return digitizeIrrigationTableFlow(input);
}

const prompt = ai.definePrompt({
  name: 'digitizeIrrigationTablePrompt',
  input: {schema: DigitizeIrrigationTableInputSchema},
  output: {schema: DigitizeIrrigationTableOutputSchema},
  prompt: `You are an expert data entry specialist. Your task is to accurately extract information from an image containing up to four distinct irrigation program tables.

Analyze the image and transcribe the content of EACH table into its own separate JSON array. The final output must be a single JSON string containing an object with four keys: "tabla1", "tabla2", "tabla3", and "tabla4". Each key will correspond to one of the tables in the image.

IMPORTANT RULES:
1.  There are four main tables in the image. The first three tables have the same structure. The fourth table on the far right has additional, different headers.
2.  Extract each table's data into a separate JSON array.
3.  For the HEADERS of each table, use the exact text from the image, but remove any dots '.' and slashes '/'. Do NOT add any other punctuation like underscores '_' or hyphens '-'. For example, "Bomba N°" becomes "Bomba N°", and "m3/Ha /Hora" becomes "m3Ha Hora".
4.  Each object in an array should represent a row from the corresponding table.
5.  If any of the four tables are not present or empty in the image, its corresponding array in the JSON output should be empty (e.g., "tabla2": []).
6.  The final output MUST be a single, valid JSON string representing an object with the four table arrays.

Example output format for an image with two tables:
{
  "tabla1": [
    { "Bomba N°": "002", "Sector": "Autumn Crisp", "Lote": "072" },
    { "Bomba N°": "003", "Sector": "Sweet Globe", "Lote": "078" }
  ],
  "tabla2": [
    { "m3Ha Hora": "8.1", "Lps Ideal": "70", "Lps adicion al 10%": "77" }
  ],
  "tabla3": [],
  "tabla4": [
    { "N": "1.2", "P2O5": "0.5", "K": "2.0" }
  ]
}

Image with the tables:
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
