import { useState, useEffect, useCallback } from 'react';
import { callCortexAPI } from './cortexService';
import type { GraphData } from '../domain/GraphData';

type Phase = 'input' | 'loading' | 'graph';

interface Viewport {
  W: number;
  H: number;
}

interface CortexState {
  query: string;
  phase: Phase;
  graphData: GraphData | null;
  history: string[];
  hoveredCat: number | null;
  setHoveredCat: (cat: number | null) => void;
  error: string | null;
  viewport: Viewport;
  handleSubmit: (q: string) => Promise<void>;
  handleNewQuery: () => void;
}

export function useCortex(): CortexState {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState<Phase>('input');
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [hoveredCat, setHoveredCat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({
    W: window.innerWidth,
    H: window.innerHeight,
  });

  useEffect(() => {
    const handler = () => setViewport({ W: window.innerWidth, H: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleSubmit = useCallback(async (q: string) => {
    setQuery(q);
    setPhase('loading');
    setGraphData(null);
    setError(null);
    setHistory(prev => [q, ...prev.filter(h => h !== q)].slice(0, 4));
    try {
      const data = await callCortexAPI(q);
      setGraphData(data);
      setPhase('graph');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('input');
    }
  }, []);

  const handleNewQuery = useCallback(() => {
    setPhase('input');
    setQuery('');
    setGraphData(null);
  }, []);

  return {
    query, phase, graphData, history,
    hoveredCat, setHoveredCat,
    error, viewport,
    handleSubmit, handleNewQuery,
  };
}
