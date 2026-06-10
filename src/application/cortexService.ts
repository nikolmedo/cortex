import type { GraphData } from '../domain/GraphData';

export async function callCortexAPI(query: string): Promise<GraphData> {
  const res = await fetch('/api/cortex', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Server error ${res.status}`);
  }
  return res.json() as Promise<GraphData>;
}
