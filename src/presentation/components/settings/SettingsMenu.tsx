import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../../i18n/I18nContext';
import { useSettings } from '../../hooks/useSettings';
import styles from './SettingsMenu.module.css';

interface SettingsMenuProps {
  onClose: () => void;
}

export function SettingsMenu({ onClose }: SettingsMenuProps) {
  const { t } = useI18n();
  const { settings, setLocale, setDefaultViewMode } = useSettings();

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

        <div className={styles.groupLabel}>{t('settings.viewMode')}</div>
        <div className={styles.segment}>
          <button
            className={`${styles.option} ${settings.defaultViewMode === 'panel' ? styles.optionActive : ''}`}
            onClick={() => setDefaultViewMode('panel')}
          >
            {t('settings.viewModePanel')}
          </button>
          <button
            className={`${styles.option} ${settings.defaultViewMode === 'immersive' ? styles.optionActive : ''}`}
            onClick={() => setDefaultViewMode('immersive')}
          >
            {t('settings.viewModeImmersive')}
          </button>
        </div>

        <div className={styles.groupLabel}>{t('settings.language')}</div>
        <div className={styles.segment}>
          <button
            className={`${styles.option} ${settings.locale === 'en' ? styles.optionActive : ''}`}
            onClick={() => setLocale('en')}
          >
            {t('settings.langEnglish')}
          </button>
          <button
            className={`${styles.option} ${settings.locale === 'es' ? styles.optionActive : ''}`}
            onClick={() => setLocale('es')}
          >
            {t('settings.langSpanish')}
          </button>
        </div>
        <div className={styles.hint}>{t('settings.langHint')}</div>
      </div>
    </>,
    document.body,
  );
}
