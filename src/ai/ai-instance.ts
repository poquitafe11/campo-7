import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * @fileOverview Instancia centralizada de Genkit para evitar conflictos de nombres con la librería oficial durante el build.
 */
export const ai = genkit({
  plugins: [googleAI()],
});
