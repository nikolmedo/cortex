import { useEffect, useId, useRef, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import type { TranslationKey } from '../../../i18n/translations';
import { useSettings } from '../../hooks/useSettings';
import styles from './SettingsMenu.module.css';

interface SegmentProps<T extends string> {
  label: TranslationKey;
  hint: TranslationKey;
  value: T;
  options: ReadonlyArray<{ value: T; label: TranslationKey }>;
  onChange: (value: T) => void;
}

function Segment<T extends string>({ label, hint, value, options, onChange }: SegmentProps<T>) {
  const { t } = useI18n();
  const hintId = useId();
  return (
    <div className={styles.group}>
      <p className={styles.groupLabel}>{t(label)}</p>
      <div className={styles.segment} role="radiogroup" aria-label={t(label)} aria-describedby={hintId}>
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            className={styles.option}
            onClick={() => onChange(opt.value)}
          >
            {t(opt.label)}
          </button>
        ))}
      </div>
      <p id={hintId} className={styles.hint}>{t(hint)}</p>
    </div>
  );
}

export function SettingsMenu({ onClose }: { onClose: () => void }): ReactElement {
  const { t } = useI18n();
  const { settings, setLocale, setMotion } = useSettings();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>{t('settings.title')}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('settings.close')}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <Segment
          label="settings.language"
          hint="settings.langHint"
          value={settings.locale}
          options={[
            { value: 'en', label: 'settings.langEnglish' },
            { value: 'es', label: 'settings.langSpanish' },
          ]}
          onChange={setLocale}
        />
        <Segment
          label="settings.motion"
          hint="settings.motionHint"
          value={settings.motion}
          options={[
            { value: 'auto', label: 'settings.motionAuto' },
            { value: 'reduced', label: 'settings.motionReduced' },
          ]}
          onChange={setMotion}
        />
      </div>
    </>,
    document.body,
  );
}
