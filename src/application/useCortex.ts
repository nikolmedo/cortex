import { useState, useEffect, useCallback, useRef } from 'react';
import { callCortexAPI, CortexApiError, type CortexErrorKey } from './cortexService';
import type { Scene } from '../domain/Scene';
import type { Locale } from '../i18n/translations';

type Phase = 'input' | 'loading' | 'graph';

interface Viewport {
  W: number;
  H: number;
}

interface CortexState {
  query: string;
  phase: Phase;
  scene: Scene | null;
  history: string[];
  /** Translation key of the last failure; translated at render so locale switches apply. */
  error: CortexErrorKey | null;
  viewport: Viewport;
  handleSubmit: (q: string) => Promise<void>;
  handleNewQuery: () => void;
}

export function useCortex(locale: Locale): CortexState {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [scene, setScene] = useState<Scene | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [error, setError] = useState<CortexErrorKey | null>(null);
  const [viewport, setViewport] = useState<Viewport>({
    W: window.innerWidth,
    H: window.innerHeight,
  });

  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const handler = () => setViewport({ W: window.innerWidth, H: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
      controller.current?.abort();
      requestId.current += 1;
    };
  }, []);

  const handleSubmit = useCallback(async (q: string) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const id = ++requestId.current;
    setQuery(q);
    setPhase('loading');
    setScene(null);
    setError(null);
    setHistory(prev => [q, ...prev.filter(h => h !== q)].slice(0, 4));
    try {
      const next = await callCortexAPI(q, locale, ctrl.signal);
      if (id !== requestId.current) return;
      setScene(next);
      setPhase('graph');
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof CortexApiError ? err.key : 'error.unknown');
      setPhase('input');
    }
  }, [locale]);

  const handleNewQuery = useCallback(() => {
    controller.current?.abort();
    requestId.current += 1;
    setPhase('input');
    setQuery('');
    setScene(null);
  }, []);

  return {
    query, phase, scene, history,
    error, viewport,
    handleSubmit, handleNewQuery,
  };
}
