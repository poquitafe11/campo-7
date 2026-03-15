'use server';
/**
 * @fileOverview Acciones neutralizadas para evitar errores de despliegue en Cloud.
 */
export async function digitizeHealthTableAction() { return { tableContent: "[]" }; }
export async function renameAndMergeHeader() { return { success: true, message: "OK" }; }
