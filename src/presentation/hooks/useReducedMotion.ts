import { useEffect, useState } from 'react';
import { useSettings } from './useSettings';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/** True when either the OS preference or the in-app MOTION setting asks for reduced motion. */
export function useReducedMotion(): boolean {
  const { settings } = useSettings();
  const [osReduced, setOsReduced] = useState(() => window.matchMedia(REDUCED_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(REDUCED_QUERY);
    const handler = (e: MediaQueryListEvent) => setOsReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return osReduced || settings.motion === 'reduced';
}
