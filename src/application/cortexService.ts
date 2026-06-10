import type { GraphData } from '../domain/GraphData';
import type { Locale } from '../i18n/translations';

export async function callCortexAPI(query: string, lang: Locale = 'en'): Promise<GraphData> {
  const res = await fetch('/api/cortex', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, lang }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<GraphData>;
}
