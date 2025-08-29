
'use server';
/**
 * @fileOverview An AI agent that digitizes a multi-section irrigation program table from a single image.
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
  tableContent: z.string().describe('A JSON string containing four arrays: "table1", "table2", "table3", and "table4". Each array should contain objects representing the rows for that specific table section. Return empty arrays for non-existent tables.'),
});
export type DigitizeIrrigationTableOutput = z.infer<typeof DigitizeIrrigationTableOutputSchema>;

export async function digitizeIrrigationTable(input: DigitizeIrrigationTableInput): Promise<DigitizeIrrigationTableOutput> {
  return digitizeIrrigationTableFlow(input);
}

const prompt = ai.definePrompt({
  name: 'digitizeIrrigationTablePrompt',
  input: {schema: DigitizeIrrigationTableInputSchema},
  output: {schema: DigitizeIrrigationTableOutputSchema},
  prompt: `You are an expert data entry specialist. Your task is to accurately extract information from an image containing a multi-section irrigation program, divided into four distinct tables.

Analyze the image provided. It contains four separate tables. You must extract the data from each table into its own separate JSON array.

IMPORTANT RULES:
1.  **Four Separate Tables**: Identify the four tables in the image and process each one independently.
2.  **Table 1 (Bomba N°, Sector, etc.)**: Extract all rows from the first table.
3.  **Table 2 (Kc, Total m3/Dia, etc.)**: Extract all rows from the second table. This table is related by row position to the first.
4.  **Table 3 (Nitr. Calcio, etc.)**: Extract all rows from the third table.
5.  **Table 4 (Unidades / Ha)**: Extract all rows from the fourth table.
6.  **Header Cleaning**: For the HEADERS (keys of the JSON object), use the exact text from the image, but remove any dots '.' and slashes '/'. Do NOT add any other punctuation like underscores '_' or hyphens '-'. For example, "Bomba N°" remains "Bomba N°", "Total m3/Dia" becomes "Total m3Dia", and "m3/Ha /Hora" becomes "m3Ha Hora".
7.  **Empty Cells**: If a cell in a row is empty or contains only a hyphen '-', do not include that key in the JSON object for that row.
8.  **Final Output**: The final output must be a single JSON string containing an object with four keys: "table1", "table2", "table3", and "table4". Each key must correspond to the JSON array of a table. If a table has no data, return an empty array for that key.

Example Output Format:
{
  "table1": [
    { "Bomba N°": "003", "Sector": "Vivero", "Lote": "7a", "De": "9:00 a. m.", "Hasta": "3:00 p. m.", "Total Horas": "06:00" },
    { "Bomba N°": "003", "Sector": "Vivero", "Lote": "7b", "De": "9:00 a. m.", "Hasta": "3:00 p. m.", "Total Horas": "06:00" }
  ],
  "table2": [
    { "Kc": "2.8", "Total m3Dia": "297.0", "Ha": "2.97", "m3Ha Hora": "16.7", "Lps Ideal": "14", "Lps adicional 10%": "15" },
    { "Kc": "2.8", "Total m3Dia": "824.0", "Ha": "4.12", "m3Ha Hora": "16.7", "Lps Ideal": "38", "Lps adicional 10%": "42" }
  ],
  "table3": [
    { "Nitr Calcio (Kgr)": "12.0", "Molizan (Kgr)": "0.10" }
  ],
  "table4": [
    { "N": "16", "K": "26" }
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
