import { ai } from './src/ai/instance.js';
import { z } from 'zod';
import { gemini15Flash } from '@genkit-ai/google-genai';

console.log("Model is:", gemini15Flash);

const prompt = ai.definePrompt({
    name: 'test',
    model: gemini15Flash,
    input: { schema: z.object({ msg: z.string() }) },
    output: { schema: z.string() },
    prompt: '{{msg}}'
});

async function run() {
    try {
        const { text } = await prompt({ msg: 'hello' });
        console.log(text);
    } catch (e) {
        console.error(e);
    }
}
run();
