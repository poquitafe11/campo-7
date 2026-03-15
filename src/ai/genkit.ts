/**
 * @fileOverview Redirección para mantener compatibilidad, importando desde la instancia única 'instance.ts'.
 */
import { ai as genkitInstance } from './instance';
export const ai = genkitInstance;
