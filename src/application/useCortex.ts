import { useCallback, useEffect, useRef, useState } from 'react';
import { CortexApiError, isAbortError, streamCortex, type CortexErrorKey, type ResearchInfo } from './cortexService';
import type { AppletState, Scene, ScenePreface } from '../domain/Scene';
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
  /**
   * The interactive tool, when the router asked for one. It settles on its own
   * schedule: a turn can be 'done' while its applet is still 'pending'.
   */
  applet?: AppletState;
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

/** A tool still pending when its run ends will never arrive; it is shown as failed. */
function settleApplet(applet: AppletState | undefined): AppletState | undefined {
  return applet?.status === 'pending' ? { status: 'failed', title: applet.title } : applet;
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
    update(run.turnId, t => {
      const applet = settleApplet(t.applet);
      if (markCancelled && (t.status === 'thinking' || t.status === 'streaming')) {
        return { ...t, status: 'error', error: 'error.cancelled', applet };
      }
      return applet === t.applet ? t : { ...t, applet };
    });
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
      // The answer is finished here even when an applet keeps the stream open.
      onScene: scene => {
        if (isCurrent()) update(turnId, t => ({ ...t, status: 'done', scene, error: undefined }));
      },
      onApplet: applet => {
        if (isCurrent()) update(turnId, t => ({ ...t, applet }));
      },
    })
      .then(scene => {
        if (!isCurrent()) return;
        active.current = null;
        update(turnId, t => ({ ...t, status: 'done', scene, error: undefined, applet: settleApplet(t.applet) }));
      })
      .catch((err: unknown) => {
        if (!isCurrent()) return;
        active.current = null;
        if (isAbortError(err)) return;
        const key: CortexErrorKey = err instanceof CortexApiError ? err.key : 'error.unknown';
        update(turnId, t => ({ ...t, status: 'error', error: key, applet: settleApplet(t.applet) }));
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
