import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const TABLET_QUERY = '(min-width: 768px)';
const DESKTOP_QUERY = '(min-width: 1280px)';

function current(): Breakpoint {
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'mobile';
}

/** mobile < 768px ≤ tablet < 1280px ≤ desktop; mirrors the CSS media queries. */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(current);

  useEffect(() => {
    const queries = [window.matchMedia(TABLET_QUERY), window.matchMedia(DESKTOP_QUERY)];
    const handler = () => setBp(current());
    for (const q of queries) q.addEventListener('change', handler);
    return () => {
      for (const q of queries) q.removeEventListener('change', handler);
    };
  }, []);

  return bp;
}
