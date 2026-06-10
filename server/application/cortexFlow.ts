import { z } from 'genkit';
import { ai } from '../infrastructure/geminiClient.js';
import { extractJSON, validateGraphData } from '../infrastructure/parseGraphData.js';
import { SYSTEM_PROMPT } from './prompt.js';
import type { GraphData } from '../domain/GraphData.js';

export const cortexFlow = ai.defineFlow(
  {
    name: 'cortexFlow',
    inputSchema: z.object({ query: z.string().min(1) }),
    // outputSchema omitted: Gemini rejects JSON mode + search grounding simultaneously
  },
  async ({ query }): Promise<GraphData> => {
    const { text } = await ai.generate({
      model: `googleai/${process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'}`,
      system: SYSTEM_PROMPT,
      prompt: query,
      config: {
        maxOutputTokens: 4000,
        temperature: 0.1,
        // genkit passes this value straight to the API; it must be `{}`, not
        // `true` (the API rejects the boolean: "Invalid value at google_search").
        googleSearch: {},
      },
    });
    return validateGraphData(extractJSON(text));
  },
);
