
'use server';
/**
 * @fileOverview An AI agent that evaluates grape caliber from an image.
 *
 * - evaluateGrapeCaliber - A function that handles the grape caliber evaluation.
 * - EvaluateGrapeCaliberInput - The input type for the function.
 * - EvaluateGrapeCaliberOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EvaluateGrapeCaliberInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of grapes, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type EvaluateGrapeCaliberInput = z.infer<typeof EvaluateGrapeCaliberInputSchema>;

const EvaluateGrapeCaliberOutputSchema = z.object({
  measurements: z.array(z.number()).describe('An array containing the diameter in millimeters for each detected grape berry.'),
});
export type EvaluateGrapeCaliberOutput = z.infer<typeof EvaluateGrapeCaliberOutputSchema>;

export async function evaluateGrapeCaliber(input: EvaluateGrapeCaliberInput): Promise<EvaluateGrapeCaliberOutput> {
  return evaluateGrapeCaliberFlow(input);
}

const prompt = ai.definePrompt({
  name: 'evaluateGrapeCaliberPrompt',
  input: { schema: EvaluateGrapeCaliberInputSchema },
  output: { schema: EvaluateGrapeCaliberOutputSchema },
  prompt: `You are an expert in agricultural computer vision. Your task is to analyze the provided image of grape berries and measure the diameter of each berry in millimeters.

Analyze the image and identify every grape berry visible.
For each berry, calculate its diameter as accurately as possible in millimeters.
Return an array of numbers, where each number is the diameter of one berry.

Example output for an image with three berries:
[21.5, 22.1, 21.8]

Image with grapes:
{{media url=photoDataUri}}`,
});

const evaluateGrapeCaliberFlow = ai.defineFlow(
  {
    name: 'evaluateGrapeCaliberFlow',
    inputSchema: EvaluateGrapeCaliberInputSchema,
    outputSchema: EvaluateGrapeCaliberOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
