import { GEMINI_API_KEY, GEMINI_MODEL } from '../constants/index.js';
import { SYSTEM_PROMPT } from './prompt.js';

function extractJSON(text) {
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1] : text;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('no JSON found');
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return {
      type: 'unknown', title: 'Parse Error', subtitle: 'Could not parse response',
      summary: '', image_url: '',
      image_query: 'abstract data visualization', meta: {}, graph: [],
    };
  }
}

export async function callCortexAPI(query) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: query }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 4000, temperature: 0.1 },
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter(p => p.text && !p.thought)
    .map(p => p.text)
    .join('');
  return extractJSON(text);
}
