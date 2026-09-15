import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../../i18n/I18nContext';
import type { TranslationKey } from '../../../i18n/translations';
import { useSettings } from '../../hooks/useSettings';
import styles from './SettingsMenu.module.css';

interface SettingsMenuProps {
  onClose: () => void;
}

interface SegmentProps<T extends string> {
  label: TranslationKey;
  value: T;
  options: ReadonlyArray<{ value: T; label: TranslationKey }>;
  onChange: (value: T) => void;
}

function Segment<T extends string>({ label, value, options, onChange }: SegmentProps<T>) {
  const { t } = useI18n();
  return (
    <>
      <div className={styles.groupLabel}>{t(label)}</div>
      <div className={styles.segment} role="radiogroup" aria-label={t(label)}>
        {options.map(opt => (
          <button
            key={opt.value}
            role="radio"
            aria-checked={value === opt.value}
            className={`${styles.option} ${value === opt.value ? styles.optionActive : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {t(opt.label)}
          </button>
        ))}
      </div>
    </>
  );
}

export function SettingsMenu({ onClose }: SettingsMenuProps) {
  const { t } = useI18n();
  const { settings, setLocale, setDefaultViewMode, setMotion } = useSettings();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.panel}>
        <div className={styles.title}>
          {t('settings.title')}
          <span className={styles.titleRule} />
        </div>

        <Segment
          label="settings.viewMode"
          value={settings.defaultViewMode}
          options={[
            { value: 'panel', label: 'settings.viewModePanel' },
            { value: 'immersive', label: 'settings.viewModeImmersive' },
          ]}
          onChange={setDefaultViewMode}
        />

        <Segment
          label="settings.language"
          value={settings.locale}
          options={[
            { value: 'en', label: 'settings.langEnglish' },
            { value: 'es', label: 'settings.langSpanish' },
          ]}
          onChange={setLocale}
        />
        <div className={styles.hint}>{t('settings.langHint')}</div>

        <Segment
          label="settings.motion"
          value={settings.motion}
          options={[
            { value: 'auto', label: 'settings.motionAuto' },
            { value: 'reduced', label: 'settings.motionReduced' },
          ]}
          onChange={setMotion}
        />
        <div className={styles.hint}>{t('settings.motionHint')}</div>
      </div>
    </>,
    document.body,
  );
}
