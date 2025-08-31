
'use server';
/**
 * @fileOverview An AI agent that digitizes a multi-section irrigation program table from a single image into a single, unified table structure.
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
  tableContent: z.string().describe('A JSON string representing a single array of objects. Each object is a complete row containing data from all four sections of the irrigation program, merged together. If the table cannot be extracted, return an empty array string "[]".'),
});
export type DigitizeIrrigationTableOutput = z.infer<typeof DigitizeIrrigationTableOutputSchema>;

export async function digitizeIrrigationTable(input: DigitizeIrrigationTableInput): Promise<DigitizeIrrigationTableOutput> {
  return digitizeIrrigationTableFlow(input);
}

const prompt = ai.definePrompt({
  name: 'digitizeIrrigationTablePrompt',
  input: {schema: DigitizeIrrigationTableInputSchema},
  output: {schema: DigitizeIrrigationTableOutputSchema},
  prompt: `You are an expert data entry specialist. Your task is to accurately extract information from an image containing a multi-section irrigation program and consolidate it into a SINGLE JSON array.

The image shows one large logical table divided visually into four sections. You must analyze each horizontal row across all four sections and combine them into a single JSON object.

IMPORTANT RULES:
1.  **Unified Rows**: Treat each horizontal line of data across the image as a single record. Combine the corresponding cells from all four sections into one JSON object for that row.
2.  **Row Correspondence**: The rows in the second, third, and fourth sections correspond to the rows in the first section based on their vertical position. If a row in a section is empty, there will be no data for those fields in the final JSON object.
3.  **Header Cleaning**: For the HEADERS (which will become the keys of the JSON object), use the exact text from the image, but remove any dots '.' and slashes '/'. Do NOT add any other punctuation like underscores '_' or hyphens '-'. For example, "Bomba N°" remains "Bomba N°", "Total m3/Dia" becomes "Total m3Dia", and "m3/Ha /Hora" becomes "m3Ha Hora".
4.  **Empty Cells**: If a cell in a row is empty or contains only a hyphen '-', do not include that key-value pair in the JSON object for that row.
5.  **Final Output**: The final output must be a single JSON string containing ONE valid JSON array. Each object in the array represents a complete, unified row from the image.

Example Output Format:
[
  { "Bomba N°": "001", "Sector": "Cotton candy", "Lote": "82a", "Ha": "14.80", "m3Ha Hora": "10.3" },
  { "Bomba N°": "002", "Sector": "Autumn Crisp", "Lote": "072", "De": "10:00 a. m.", "Hasta": "6:00 p. m.", "Total Horas": "08:00", "Observaciones": "Fertilizar", "Kc": "1.8", "Total m3Dia": "2,007.6", "Ha": "31.00", "m3Ha Hora": "8.1", "Lps Ideal": "70", "Lps adicional 10%": "77", "Nitr Calcio (Kgr)": "2,025.0", "Tiosulfato de Calcio (Lts)": "600.0", "N": "10", "K": "19" }
]

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
