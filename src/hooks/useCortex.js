import { useState, useEffect, useCallback } from 'react';
import { callCortexAPI } from '../api/cortex.js';
import { GEMINI_API_KEY } from '../constants/index.js';

export function useCortex() {
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState('input');
  const [graphData, setGraphData] = useState(null);
  const [history, setHistory] = useState([]);
  const [hoveredCat, setHoveredCat] = useState(null);
  const [error, setError] = useState(null);
  const [viewport, setViewport] = useState({ W: window.innerWidth, H: window.innerHeight });

  useEffect(() => {
    const handler = () => setViewport({ W: window.innerWidth, H: window.innerHeight });
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const handleSubmit = useCallback(async (q) => {
    if (!GEMINI_API_KEY) { setError('Missing VITE_GEMINI_API_KEY in .env'); return; }
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
      setError(err.message);
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
