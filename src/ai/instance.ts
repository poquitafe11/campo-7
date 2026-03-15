import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * @fileOverview Instancia única de Genkit para evitar conflictos de nombres circulares durante el build de Next.js.
 */
export const ai = genkit({
  plugins: [googleAI()],
});
