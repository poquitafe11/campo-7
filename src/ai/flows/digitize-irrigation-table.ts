
'use server';
/**
 * @fileOverview An AI agent that digitizes a multi-section irrigation program table from a single image into a single, unified table structure, also extracting the date and ETo.
 *
 * - digitizeIrrigationTable - A function that handles the table digitization process.
 * - DigitizeIrrigationTableInput - The input type for the digitizeIrrigationTable function.
 * - DigitizeIrrigationTableOutput - The return type for the digitizeIrrigationTable function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';


const DigitizeIrrigationTableInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a table, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
});
export type DigitizeIrrigationTableInput = z.infer<typeof DigitizeIrrigationTableInputSchema>;

const DigitizeIrrigationTableOutputSchema = z.object({
  fundo: z.string().describe("The 'Fundo' value extracted from the image header (e.g., 'Los Brujos' from 'Programa de riego \"Los Brujos\"'). If not found, return an empty string."),
  fecha: z.string().describe("The date extracted from the top of the image, formatted as 'dd de MMMM de yyyy' in Spanish (e.g., '29 de Agosto de 2025'). If no date is found, return an empty string."),
  dia: z.string().describe("The day of the week extracted from the image header (e.g., 'VIERNES'). If not found, return an empty string."),
  eto: z.string().describe("The 'ETo' value extracted from the image header (e.g., '5.8'). If not found, return an empty string."),
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
  prompt: `You are an expert data entry specialist. Your task is to accurately extract information from an image containing a multi-section irrigation program and consolidate it into a SINGLE JSON array, and also extract the Fundo, date, day of the week, and ETo value from the top of the image.

TASK 1: Extract Header Data
- Find the "Fundo" at the top of the document. Extract the name. If the text is like "Programa de riego 'Los Brujos'", extract only the name inside the quotes. Place this string in the "fundo" output field.
- Find the date at the top of the document. Format it as a string: "dd de MMMM de yyyy" in Spanish. Example: "29 de Agosto de 2025". Place this in the "fecha" output field.
- Find the day of the week next to the date. Extract the name (e.g., 'VIERNES'). Place this string in the "dia" output field.
- Find the "ETo" value at the top of the document. Extract only the numeric value (e.g., "5.8"). Place this string in the "eto" output field.

TASK 2: Extract and Unify the Table
The image contains one large table visually split into multiple sections. Your primary task is to merge the data from all sections for each row into a single JSON object.

IMPORTANT RULES FOR TABLE EXTRACTION:
1.  **Column Headers**: First, identify all column headers across all sections. For the JSON keys, use the exact header text from the image but clean it by removing any dots '.' and slashes '/'. For example, "Total m3/Dia" becomes "Total m3Dia", and "m3/Ha /Hora" becomes "m3Ha Hora".
2.  **Row Unification**: For each row of data, combine the values from all corresponding columns across the different visual sections into a single JSON object.
3.  **Mandatory Nutrient Columns and Hyphen Rule**: The final JSON for EACH row MUST contain keys for all the following nutrients: "N", "P2O5", "K", "Ca", "Mg", "Zn", "Mn", "B", "Fe", "S". Carefully match the value under each nutrient column in the image (e.g., "N", "K", "Ca") to its correct key in the JSON. If a nutrient column in the image for a specific row contains a hyphen "-", is blank, or is empty, you MUST include the corresponding nutrient key in the JSON with an empty string "" as its value. The hyphen is a placeholder for an empty cell and is critical for maintaining correct column alignment. DO NOT SKIP IT.

Example Output Format:
{
  "fundo": "LOS BRUJOS DE CACHICHE",
  "fecha": "29 de Agosto de 2025",
  "dia": "VIERNES",
  "eto": "5.8",
  "tableContent": "[ { \\"Bomba N°\\": \\"001\\", \\"Sector\\": \\"Cotton candy\\", \\"Lote\\": \\"78\\", \\"Ha\\": \\"14.80\\", \\"m3Ha Hora\\": \\"10.3\\", \\"N\\": \\"4\\", \\"P2O5\\": \\"\\", \\"K\\": \\"\\", \\"Ca\\": \\"6\\", \\"Mg\\": \\"\\", \\"Zn\\": \\"\\", \\"Mn\\": \\"\\", \\"B\\": \\"\\", \\"Fe\\": \\"\\", \\"S\\": \\"\\" }, { \\"Bomba N°\\": \\"002\\", \\"Sector\\": \\"Autumn Crisp\\", \\"Lote\\": \\"072\\", \\"De\\": \\"10:00 a. m.\\", \\"Hasta\\": \\"6:00 p. m.\\", \\"Total Horas\\": \\"08:00\\", \\"Observaciones\\": \\"Fertilizar\\", \\"Kc\\": \\"1.8\\", \\"Total m3Dia\\": \\"2,007.6\\", \\"Ha\\": \\"31.00\\", \\"m3Ha Hora\\": \\"8.1\\", \\"Lps Ideal\\": \\"70\\", \\"Lps adicional 10%\\": \\"77\\", \\"N\\": \\"\\", \\"P2O5\\": \\"\\", \\"K\\": \\"18\\", \\"Ca\\": \\"\\", \\"Mg\\": \\"\\", \\"Zn\\": \\"\\", \\"Mn\\": \\"\\", \\"B\\": \\"\\", \\"Fe\\": \\"\\", \\"S\\": \\"\\" } ]"
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
    const {output} = await ai.generate({
      prompt: prompt.prompt,
      model: googleAI.model('gemini-1.5-flash'),
      input: input,
      output: {
        schema: DigitizeIrrigationTableOutputSchema
      }
    });
    return output!;
  }
);
