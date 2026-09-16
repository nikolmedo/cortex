import { useCallback, useState } from 'react';

const STORAGE_KEY = 'cortex.recent';
const MAX_RECENT = 5;

function load(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** Most recent distinct queries, newest first, kept in this browser only. */
export function useRecentQueries(): { recent: string[]; remember: (query: string) => void } {
  const [recent, setRecent] = useState<string[]>(load);

  const remember = useCallback((query: string) => {
    setRecent(prev => {
      const next = [query, ...prev.filter(q => q !== query)].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable; the list stays in memory for this visit.
      }
      return next;
    });
  }, []);

  return { recent, remember };
}
