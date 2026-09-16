import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactElement } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { MAX_QUERY_LENGTH } from '../../../application/cortexService';
import { useI18n } from '../../../i18n/I18nContext';
import type { TranslationKey } from '../../../i18n/translations';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import styles from './CommandBar.module.css';

const GHOST_KEYS: readonly TranslationKey[] = [
  'command.placeholder',
  'command.examples.1',
  'command.examples.2',
  'command.examples.3',
  'command.examples.4',
  'command.examples.5',
  'command.examples.6',
];
const GHOST_PERIOD_MS = 4200;
const COUNTER_FROM = MAX_QUERY_LENGTH - 300;

interface CommandBarProps {
  /** Landing: centered in flow. Docked: fixed to the bottom above the keyboard. */
  docked: boolean;
  /** The latest turn is in flight; an empty bar offers "stop". */
  busy: boolean;
  onSubmit: (query: string) => void;
  onStop: () => void;
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

export function CommandBar({ docked, busy, onSubmit, onStop }: CommandBarProps): ReactElement {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const [value, setValue] = useState('');
  const [ghost, setGhost] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hintId = useId();

  const length = value.trim().length;
  const tooLong = length > MAX_QUERY_LENGTH;
  const empty = value.trim() === '';
  const showStop = busy && empty;

  useKeyboardInset(docked);

  // Auto-grow up to the CSS max-height, then scroll inside.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, docked]);

  // Rotating example on the landing bar while it is empty.
  useEffect(() => {
    if (docked || value !== '' || reduced) return undefined;
    const id = window.setTimeout(() => setGhost(i => (i + 1) % GHOST_KEYS.length), GHOST_PERIOD_MS);
    return () => window.clearTimeout(id);
  }, [docked, value, ghost, reduced]);

  // "/" or Ctrl/Cmd+K focuses the bar.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const combo = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
      const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditable(e.target);
      if (combo || slash) {
        e.preventDefault();
        areaRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The session stream reserves room for the docked bar.
  useEffect(() => {
    const el = shellRef.current;
    if (!docked || !el) return undefined;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty('--dock-h', `${Math.ceil(el.offsetHeight)}px`));
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--dock-h');
    };
  }, [docked]);

  const submit = () => {
    const q = value.trim();
    if (!q || tooLong) return;
    onSubmit(q);
    setValue('');
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (showStop) onStop();
    else submit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const form = (
    <form className={styles.bar} data-docked={docked} role="search" onSubmit={onFormSubmit}>
      <div className={styles.frame}>
        <span className={styles.ring} aria-hidden="true" />
        <div className={styles.field}>
          {!docked && value === '' ? (
            <span key={ghost} className={styles.ghost} aria-hidden="true">{t(GHOST_KEYS[ghost])}</span>
          ) : null}
          <textarea
            ref={areaRef}
            className={styles.input}
            rows={1}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={docked ? t('command.placeholderDocked') : undefined}
            aria-label={t('command.label')}
            aria-describedby={hintId}
            aria-invalid={tooLong || undefined}
            autoFocus={!docked}
            enterKeyHint="send"
            spellCheck
          />
        </div>
        <button
          type="submit"
          className={`${styles.send} ${showStop ? styles.stop : ''}`}
          disabled={!showStop && (empty || tooLong)}
          aria-label={t(showStop ? 'command.stop' : 'command.send')}
        >
          {showStop ? <Square size={14} fill="currentColor" aria-hidden="true" /> : <ArrowUp size={20} aria-hidden="true" />}
        </button>
      </div>
      <div className={styles.meta} id={hintId}>
        {tooLong ? (
          <span className={styles.warn} role="alert">{t('command.tooLong', { max: MAX_QUERY_LENGTH })}</span>
        ) : (
          <span className={styles.hint}>{t('command.hint')}</span>
        )}
        {length >= COUNTER_FROM ? (
          <span className={tooLong ? styles.warn : styles.counter}>
            {t('command.counter', { count: length, max: MAX_QUERY_LENGTH })}
          </span>
        ) : null}
      </div>
    </form>
  );

  if (!docked) return form;
  return (
    <div ref={shellRef} className={styles.dock} data-dock="">
      {form}
    </div>
  );
}
