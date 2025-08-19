
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
  prompt: `You are an expert data entry specialist. Your task is to accurately extract information from a potentially complex irrigation program provided in an image and normalize the keys to be Firestore-compatible.

First, extract the general information from the title:
- The farm name (e.g., "Los Brujos"). Store it as 'Fundo'.
- The day of the week (e.g., "martes"). Store it as 'Dia'.
- The full date (e.g., "15 de Julio de 2025"). Store it as 'Fecha'.
- Extract the 'eT' value if present.

Next, analyze all the tables in the image. The rows are related horizontally across all tables, even if they are visually separated. For each main row (identified by 'Bomba N°' or similar), combine the data from all tables into a single JSON object.

IMPORTANT: Use the following exact, Firestore-compatible keys for the JSON objects, unifying any variations from the image. Do NOT use slashes '/' in the keys. Use underscores '_' instead.
- 'BombaNo' (from "Bomba N°")
- 'Total_m3_Dia' (from "Total m3/Dia")
- 'm3_Ha_Hora' (from "m3/Ha /Hora")
- 'Ha' (from "Ha.")
- For columns under 'Unidades/Ha', use the specific header (e.g., 'N', 'P2O5', 'K', 'Mn').
- Pay close attention to chemical symbols. The symbol "Mπ", "Mpi", or similar-looking text MUST be interpreted and keyed as "Mn" (Manganeso).
- Include the extracted 'Fundo', 'Dia', 'Fecha', and 'eT' in every single row object of the final JSON array.
- Ensure all values, including numbers, text, and empty cells (represented as empty strings), are extracted precisely.
- The final output must be a single, valid JSON array string.

Example of a single object in the output array:
{
  "Fundo": "Los Brujos",
  "Dia": "martes",
  "Fecha": "15 de Julio de 2025",
  "eT": "2.6",
  "BombaNo": "002",
  "Sector": "Autumn Crisp",
  "Lote": "072",
  "De": "11:00 a. m.",
  "Hasta": "3:00 p. m.",
  "Total Horas": "04:00",
  "Observaciones": "",
  "Kc": "1.2",
  "Total_m3_Dia": "1,003.8",
  "Ha": "31.00",
  "m3_Ha_Hora": "8.1",
  "Lps Ideal": "70",
  "Lps adicion al 10%": "77",
  "Tiosulfato de Calcio (Lts)": "",
  "Tiosulfato de Magnesio (Lts)": "",
  "N": "",
  "P2O5": "",
  "K": "",
  "Ca": "",
  "Mg": "",
  "Zn": "",
  "Mn": ""
}

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

