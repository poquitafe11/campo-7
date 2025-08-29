
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
  tableContent: z.string().describe('The full content of the table, extracted as a JSON array of objects, where each object represents a fully merged row from all table sections. If the table cannot be extracted, return an empty array string "[]".'),
});
export type DigitizeIrrigationTableOutput = z.infer<typeof DigitizeIrrigationTableOutputSchema>;

export async function digitizeIrrigationTable(input: DigitizeIrrigationTableInput): Promise<DigitizeIrrigationTableOutput> {
  return digitizeIrrigationTableFlow(input);
}

const prompt = ai.definePrompt({
  name: 'digitizeIrrigationTablePrompt',
  input: {schema: DigitizeIrrigationTableInputSchema},
  output: {schema: DigitizeIrrigationTableOutputSchema},
  prompt: `You are an expert data entry specialist. Your task is to accurately extract information from an image containing a multi-section irrigation program table and merge it into a single, unified dataset.

Analyze the image provided. It contains one logical table split into four visible sections. Each horizontal row across all sections represents a single record. You must merge the data from each row across all four sections into a single JSON object.

IMPORTANT RULES:
1.  Process the image row by row. For each row, combine all the data points from the leftmost section to the rightmost section into one object.
2.  For the HEADERS (keys of the JSON object), use the exact text from the image, but remove any dots '.' and slashes '/'. Do NOT add any other punctuation like underscores '_' or hyphens '-'. For example, "Bomba N°" remains "Bomba N°", "Total m3/Dia" becomes "Total m3Dia", and "m3/Ha /Hora" becomes "m3Ha Hora".
3.  If a cell in a row is empty or contains a hyphen '-', do not include that key in the JSON object for that row.
4.  The final output must be a single string containing a valid JSON array of these merged objects.

Example output format for a single, complete row:
[
  {
    "Bomba N°": "003",
    "Sector": "Vivero",
    "Lote": "7b",
    "De": "9:00 a. m.",
    "Hasta": "3:00 p. m.",
    "Total Horas": "06:00",
    "Kc": "2.8",
    "Total m3Dia": "824.0",
    "Ha": "4.12",
    "m3Ha Hora": "16.7",
    "Lps Ideal": "38",
    "Lps adicional 10%": "42"
  },
  {
    "Bomba N°": "004",
    "Sector": "Tb-Arra (c14)",
    "Lote": "Tb.c14P",
    "Total Horas": "05:00",
    "Observaciones": "Fertilizar",
    "Kc": "1.6",
    "Total m3Dia": "6.8",
    "Ha": "0.12",
    "m3Ha Hora": "11.3",
    "Nitr Calcio (Kgr)": "12.0",
    "Molizan (Kgr)": "0.10",
    "N": "16",
    "K": "26"
  }
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
