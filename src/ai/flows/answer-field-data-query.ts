
'use server';
/**
 * @fileOverview An AI agent that answers questions about field data using tools to search the database.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as admin from 'firebase-admin';

async function getFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    : undefined;

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}


const AnswerFieldDataQueryInputSchema = z.object({
  query: z.string().describe('The question about the field data.'),
});
export type AnswerFieldDataQueryInput = z.infer<typeof AnswerFieldDataQueryInputSchema>;

const AnswerFieldDataQueryOutputSchema = z.object({
  answer: z.string().describe('The answer to the question about the field data, formatted as a single HTML string.'),
});
export type AnswerFieldDataQueryOutput = z.infer<typeof AnswerFieldDataQueryOutputSchema>;


// Tool to get production activities
const getProductionActivities = ai.defineTool(
  {
    name: 'getProductionActivities',
    description: 'Retrieves records from the "actividades" collection (production and labor data). Use for questions about costs, yield, personnel, workdays, etc.',
    inputSchema: z.object({
      searchTerm: z.string().optional().describe('An optional search term to filter by the "labor" field. E.g., "poda", "raleo", "desbrote".'),
    }),
    outputSchema: z.string().describe('A JSON string of the found activity records.'),
  },
  async (input) => {
    const adminApp = await getFirebaseAdmin();
    const db = adminApp.firestore();
    const activitiesRef = db.collection('actividades');
    const snapshot = await activitiesRef.get();
    
    const allActivities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!input.searchTerm) {
        return JSON.stringify(allActivities);
    }
    
    const lowerCaseSearchTerm = input.searchTerm.toLowerCase();
    const filtered = allActivities.filter((act: any) => {
        return act.labor && typeof act.labor === 'string' && act.labor.toLowerCase().includes(lowerCaseSearchTerm);
    });
    
    return JSON.stringify(filtered);
  }
);


// Tool to get health records
const getHealthRecords = ai.defineTool(
  {
    name: 'getHealthRecords',
    description: 'Retrieves records from the "registros-sanidad" collection. Use for questions about product applications, diseases, pests, active ingredients.',
    inputSchema: z.object({
      searchTerm: z.string().optional().describe('An optional search term to filter by any field in the record (product, objective, etc.). E.g., "oidio", "insecticida".'),
    }),
    outputSchema: z.string().describe('A JSON string of the found health records.'),
  },
  async (input) => {
    const adminApp = await getFirebaseAdmin();
    const db = adminApp.firestore();
    const healthRef = db.collection('registros-sanidad');
    const snapshot = await healthRef.get();
    
    const allRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!input.searchTerm) {
        return JSON.stringify(allRecords);
    }
    
    const lowerCaseSearchTerm = input.searchTerm.toLowerCase();
    const filtered = allRecords.filter(record => 
        Object.values(record).some(val => 
            val && String(val).toLowerCase().includes(lowerCaseSearchTerm)
        )
    );
    
    return JSON.stringify(filtered);
  }
);

// Tool to get irrigation records
const getIrrigationRecords = ai.defineTool(
  {
    name: 'getIrrigationRecords',
    description: 'Retrieves records from the "registros-riego-01" collection. Use for questions about irrigation, fertilizers, nutrient units (N, P, K, etc.).',
    inputSchema: z.object({
      searchTerm: z.string().optional().describe('An optional search term to filter by any field. E.g., "nitrógeno", "Lote 78".'),
    }),
    outputSchema: z.string().describe('A JSON string of the found irrigation records.'),
  },
  async (input) => {
    const adminApp = await getFirebaseAdmin();
    const db = adminApp.firestore();
    const irrigationRef = db.collection('registros-riego-01');
    const snapshot = await irrigationRef.get();
    
    const allRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (!input.searchTerm) {
        return JSON.stringify(allRecords);
    }

    const lowerCaseSearchTerm = input.searchTerm.toLowerCase();
    const filtered = allRecords.filter(record => 
        Object.values(record).some(val => 
            val && String(val).toLowerCase().includes(lowerCaseSearchTerm)
        )
    );

    return JSON.stringify(filtered);
  }
);


// Main prompt that uses the tools
const answerer = ai.definePrompt({
  name: 'answerFieldDataQueryPrompt',
  input: { schema: AnswerFieldDataQueryInputSchema },
  output: { schema: AnswerFieldDataQueryOutputSchema },
  tools: [getProductionActivities, getHealthRecords, getIrrigationRecords],
  prompt: `You are an expert agronomist and agricultural data analyst. Your main task is to answer user questions accurately and clearly.
  
  **Key Instructions:**
  1.  **Analyze the user's question**: Determine what kind of information they need (costs, yield, applications, irrigation, etc.).
  2.  **Use the tools**: Call one or more of the available tools to get the relevant data from the database. Be specific with the 'searchTerm' if necessary. For example, if the user asks about "poda", use the term "poda" in the \`getProductionActivities\` tool.
  3.  **MANDATORY Response Format**:
      *   **For comparisons or data lists**: If the user asks to compare, list, or summarize data from multiple lots or records, you MUST present your answer in an HTML table. The table must have basic styles to be readable (e.g., <table style="width: 100%; border-collapse: collapse;">, <th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2;">, <td style="border: 1px solid #ddd; padding: 8px;">). Make sure to include the relevant columns.
      *   **For textual answers**: If the answer is text or a simple calculation, you MUST wrap it in a <p> tag.
      *   **IMPORTANT**: YOUR FINAL RESPONSE MUST BE A SINGLE HTML STRING. Do not just respond with plain text.
  4.  **Grouping and Comparison**: If a question requires a comparison between lots (e.g., "compare the costs of desbrote"), you MUST group the data by 'Lote'. Present a table with **a single row for each lot**, showing the key values. DO NOT list every individual record.
  5.  **Provide Additional Value**: After answering the question (either with text or a table), add a section called "<strong>Observaciones Adicionales</strong>". In this section, within a <p> tag, provide a brief analysis or interesting fact that was not explicitly requested but is relevant for decision-making.
  6.  **Cost Calculations**: If the user asks about "pago total", "costo total" o "cuánto se pagó en total" for an activity, use the production data ('actividades'). The cost is calculated as follows: if 'cost' > 0, the cost is 'cost * performance'. If 'cost' == 0 or is not defined, payment is by workday; assume a workday cost of S/ 60 and the cost is 'workdayCount * 60'. Sum all individual costs to get the total.
  7.  **Language**: ALWAYS RESPOND IN SPANISH.
  
  **USER'S QUESTION:**
  {{query}}

  Formulate your response here, in Spanish and strictly following the HTML formatting rules.
`,
});

export const answerFieldDataQueryFlow = ai.defineFlow(
  {
    name: 'answerFieldDataQueryFlow',
    inputSchema: AnswerFieldDataQueryInputSchema,
    outputSchema: AnswerFieldDataQueryOutputSchema,
  },
  async (input) => {
    const { output } = await answerer(input);
    return output!;
  }
);

export async function answerFieldDataQuery(input: AnswerFieldDataQueryInput): Promise<AnswerFieldDataQueryOutput> {
  const result = await answerFieldDataQueryFlow(input);
  if (!result || !result.answer) {
    return { answer: "<p>The AI could not generate a response with the expected format. Try being more specific in your question.</p>" };
  }
  return result;
}
