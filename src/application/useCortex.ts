import { useCallback, useEffect, useRef, useState } from 'react';
import { CortexApiError, isAbortError, streamCortex, type CortexErrorKey, type ResearchInfo } from './cortexService';
import type { Scene, ScenePreface } from '../domain/Scene';
import type { Locale } from '../i18n/translations';

/**
 * thinking: request sent, nothing received yet.
 * streaming: preface (or later partial scenes) received, final scene pending.
 * done: final scene received.
 * error: failed or cancelled; `error` holds the translation key.
 */
export type TurnStatus = 'thinking' | 'streaming' | 'done' | 'error';

export interface Turn {
  id: string;
  query: string;
  /** Response language requested for this turn. */
  lang: Locale;
  status: TurnStatus;
  preface?: ScenePreface;
  /** Set once the grounded research stage reported back. */
  research?: ResearchInfo;
  /**
   * The latest scene: a partial while `status` is 'streaming', the final one
   * when 'done'. An interrupted turn keeps its last partial, so anything that
   * treats a scene as a finished answer has to check `isInterrupted` first.
   */
  scene?: Scene;
  error?: CortexErrorKey;
  /** Date.now() when the current attempt started. */
  startedAt: number;
}

/**
 * A turn that failed, lost its connection or was cancelled after part of the
 * answer had already arrived. Its scene is a partial that may stop mid-sentence,
 * never a finished answer, so it keeps the streaming treatment.
 */
export function isInterrupted(turn: Turn): boolean {
  return turn.status === 'error' && turn.scene != null;
}

export interface CortexSession {
  /** Oldest first. */
  turns: Turn[];
  /** Appends a new turn; aborts the turn in flight, if any. Blank queries are ignored. */
  submit: (query: string) => void;
  /** Re-runs a finished or failed turn in place; aborts the turn in flight, if any. */
  retry: (turnId: string) => void;
  /** Aborts the turn in flight and marks it `error.cancelled`. */
  cancel: () => void;
  /** Aborts the turn in flight and removes every turn. */
  clearSession: () => void;
}

interface ActiveRun {
  turnId: string;
  controller: AbortController;
}

let seq = 0;
const nextId = () => `turn-${Date.now().toString(36)}-${(seq += 1)}`;

/** Multi-turn session: at most one turn is in flight at a time. */
export function useCortex(locale: Locale): CortexSession {
  const [turns, setTurns] = useState<Turn[]>([]);
  const turnsRef = useRef<Turn[]>(turns);
  turnsRef.current = turns;
  const active = useRef<ActiveRun | null>(null);

  const update = useCallback((id: string, fn: (turn: Turn) => Turn) => {
    setTurns(prev => prev.map(t => (t.id === id ? fn(t) : t)));
  }, []);

  /** Stops the run in flight; optionally marks its turn as cancelled. */
  const abortActive = useCallback((markCancelled: boolean) => {
    const run = active.current;
    if (!run) return;
    active.current = null;
    run.controller.abort();
    if (markCancelled) {
      update(run.turnId, t => (t.status === 'thinking' || t.status === 'streaming'
        ? { ...t, status: 'error', error: 'error.cancelled' }
        : t));
    }
  }, [update]);

  const start = useCallback((turnId: string, query: string, lang: Locale) => {
    const controller = new AbortController();
    const run: ActiveRun = { turnId, controller };
    active.current = run;
    const isCurrent = () => active.current === run;

    streamCortex(query, lang, {
      signal: controller.signal,
      onPreface: preface => {
        if (isCurrent()) update(turnId, t => ({ ...t, status: 'streaming', preface }));
      },
      onResearch: research => {
        if (isCurrent()) update(turnId, t => ({ ...t, status: 'streaming', research }));
      },
      onPartial: scene => {
        if (isCurrent()) update(turnId, t => ({ ...t, status: 'streaming', scene }));
      },
    })
      .then(scene => {
        if (!isCurrent()) return;
        active.current = null;
        update(turnId, t => ({ ...t, status: 'done', scene, error: undefined }));
      })
      .catch((err: unknown) => {
        if (!isCurrent()) return;
        active.current = null;
        if (isAbortError(err)) return;
        const key: CortexErrorKey = err instanceof CortexApiError ? err.key : 'error.unknown';
        update(turnId, t => ({ ...t, status: 'error', error: key }));
      });
  }, [update]);

  const submit = useCallback((raw: string) => {
    const query = raw.trim();
    if (query === '') return;
    abortActive(true);
    const turn: Turn = { id: nextId(), query, lang: locale, status: 'thinking', startedAt: Date.now() };
    setTurns(prev => [...prev, turn]);
    start(turn.id, query, locale);
  }, [abortActive, locale, start]);

  const retry = useCallback((turnId: string) => {
    const turn = turnsRef.current.find(t => t.id === turnId);
    if (!turn) return;
    abortActive(active.current?.turnId !== turnId);
    update(turnId, t => ({
      id: t.id,
      query: t.query,
      lang: locale,
      status: 'thinking',
      startedAt: Date.now(),
    }));
    start(turnId, turn.query, locale);
  }, [abortActive, locale, start, update]);

  const cancel = useCallback(() => abortActive(true), [abortActive]);

  const clearSession = useCallback(() => {
    abortActive(false);
    setTurns([]);
  }, [abortActive]);

  useEffect(() => () => {
    active.current?.controller.abort();
    active.current = null;
  }, []);

  return { turns, submit, retry, cancel, clearSession };
}
