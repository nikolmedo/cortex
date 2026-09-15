import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { CYAN } from '../../infrastructure/constants';
import { useI18n } from '../../i18n/I18nContext';
import type { TranslationKey } from '../../i18n/translations';
import { useReducedMotion } from '../hooks/useReducedMotion';
import styles from './QueryInput.module.css';

/** Server-side cap on query length (server/presentation/cortexRouter.ts). */
const MAX_CHARS = 200;
const COUNTER_FROM = 140;
const HINT_PERIOD_MS = 3500;
const HINT_FADE_MS = 320;
/** Lets the Enter ripple play before the input unmounts. */
const SUBMIT_BEAT_MS = 220;

const EXAMPLE_KEYS: TranslationKey[] = [
  'input.examples.1',
  'input.examples.2',
  'input.examples.3',
  'input.examples.4',
  'input.examples.5',
  'input.examples.6',
];

interface QueryInputProps {
  onSubmit: (query: string) => void;
  /** Optional history chips rendered under the input. */
  historySlot?: React.ReactNode;
}

export function QueryInput({ onSubmit, historySlot }: QueryInputProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const [val, setVal] = useState('');
  const [exampleIdx, setExampleIdx] = useState(0);
  const [exampleFading, setExampleFading] = useState(false);
  const [rippleKey, setRippleKey] = useState(0);
  const submitTimer = useRef<number | null>(null);

  const length = val.trim().length;
  const tooLong = length > MAX_CHARS;
  const idle = val === '';

  useEffect(() => {
    if (!idle) return;
    const id = window.setInterval(() => {
      if (reducedMotion) {
        setExampleIdx(i => (i + 1) % EXAMPLE_KEYS.length);
        return;
      }
      setExampleFading(true);
      window.setTimeout(() => {
        setExampleIdx(i => (i + 1) % EXAMPLE_KEYS.length);
        setExampleFading(false);
      }, HINT_FADE_MS);
    }, HINT_PERIOD_MS);
    return () => window.clearInterval(id);
  }, [idle, reducedMotion]);

  useEffect(() => () => {
    if (submitTimer.current) window.clearTimeout(submitTimer.current);
  }, []);

  const submit = () => {
    const q = val.trim();
    if (!q || tooLong || submitTimer.current) return;
    if (reducedMotion) {
      onSubmit(q);
      return;
    }
    setRippleKey(k => k + 1);
    submitTimer.current = window.setTimeout(() => {
      submitTimer.current = null;
      onSubmit(q);
    }, SUBMIT_BEAT_MS);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') submit();
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.logoBlock}>
        <div className={styles.logo}>{t('app.title')}</div>
        <div className={styles.tagline}>{t('app.tagline')}</div>
      </div>

      <div className={`${styles.field} ${tooLong ? styles.fieldOver : ''}`}>
        {rippleKey > 0 && <span key={rippleKey} className={styles.ripple} aria-hidden="true" />}
        <span className={`${styles.chevron} chevron-blink`}>&gt;&gt;</span>
        <input
          autoFocus
          className={styles.input}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('input.placeholder')}
          aria-invalid={tooLong || undefined}
        />
        <button
          className={styles.searchBtn}
          onClick={submit}
          aria-label={t('input.search')}
          disabled={tooLong}
        >
          <Search size={16} color={val && !tooLong ? CYAN : `${CYAN}44`} />
        </button>
      </div>
      <div className={styles.underline} />

      <div className={styles.meta}>
        {tooLong ? (
          <span className={styles.tooLong} role="alert">{t('input.tooLong', { max: MAX_CHARS })}</span>
        ) : idle ? (
          <button
            className={`${styles.example} ${exampleFading ? styles.exampleFading : ''}`}
            onClick={() => setVal(t(EXAMPLE_KEYS[exampleIdx]))}
            tabIndex={-1}
          >
            <span className={styles.examplePrefix}>&gt;</span>
            {t(EXAMPLE_KEYS[exampleIdx])}
          </button>
        ) : (
          <span className={styles.hint}>{t('input.hint')}</span>
        )}
        {length >= COUNTER_FROM && (
          <span className={`${styles.counter} ${tooLong ? styles.counterOver : ''}`}>
            {t('input.counter', { count: length, max: MAX_CHARS })}
          </span>
        )}
      </div>

      {historySlot && <div className={styles.history}>{historySlot}</div>}
    </div>
  );
}
