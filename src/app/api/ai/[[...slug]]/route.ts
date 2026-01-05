
import { serve } from 'genkit';
import { answerFieldDataQueryFlow } from '@/lib/ai/flows/answer-field-data-query';
import { digitizeHealthTableFlow } from '@/lib/ai/flows/digitize-health-table';
import { digitizeIrrigationTableFlow } from '@/lib/ai/flows/digitize-irrigation-table';
import { summarizeFieldDataFlow } from '@/lib/ai/flows/summarize-field-data';

export const POST = serve({
  flows: [
    answerFieldDataQueryFlow,
    digitizeHealthTableFlow,
    digitizeIrrigationTableFlow,
    summarizeFieldDataFlow,
  ],
});
