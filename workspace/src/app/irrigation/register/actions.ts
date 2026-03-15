'use server';
/**
 * @fileOverview Acciones neutralizadas para evitar errores de despliegue en Cloud.
 */
export async function digitizeIrrigationTableAction() { return { tableContent: "[]", fundo: "", fecha: "", dia: "", eto: "" }; }
export async function renameAndMergeHeader() { return { success: true, message: "OK" }; }
