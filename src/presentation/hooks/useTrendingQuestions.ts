import { useEffect, useState } from 'react';
import {
  deriveGeo,
  fetchTrendingQuestions,
  readTrendingCache,
  trendingCacheKey,
  writeTrendingCache,
} from '../../application/trendingService';
import { isAbortError } from '../../application/cortexService';
import type { Locale } from '../../i18n/translations';

function sessionStore(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

interface TrendingState {
  key: string;
  questions: string[] | null;
  /** True when the questions came from the session cache on mount, so there is nothing to crossfade. */
  cached: boolean;
}

function initial(key: string): TrendingState {
  const questions = readTrendingCache(sessionStore(), key, Date.now());
  return { key, questions, cached: questions !== null };
}

/**
 * Trending questions for the landing, or null while they load or when the
 * server has none (the caller shows its static examples). Refetches when the
 * language changes; results are cached in sessionStorage per geo and language.
 */
export function useTrendingQuestions(locale: Locale): { questions: string[] | null; cached: boolean } {
  const geo = deriveGeo(locale, navigator.languages ?? [navigator.language]);
  const key = trendingCacheKey(geo, locale);
  const [state, setState] = useState<TrendingState>(() => initial(key));

  // A language switch resets to that language's cache (or the static examples) before fetching.
  const current = state.key === key ? state : initial(key);
  if (current !== state) setState(current);

  const hasQuestions = current.questions !== null;
  useEffect(() => {
    if (hasQuestions) return;
    const controller = new AbortController();
    fetchTrendingQuestions(locale, geo, controller.signal)
      .then(questions => {
        if (questions.length === 0) return;
        writeTrendingCache(sessionStore(), key, questions, Date.now());
        setState({ key, questions, cached: false });
      })
      .catch(err => {
        if (!isAbortError(err)) console.warn('[cortex] trending questions unavailable', err);
      });
    return () => controller.abort();
  }, [key, locale, geo, hasQuestions]);

  return { questions: current.questions, cached: current.cached };
}
