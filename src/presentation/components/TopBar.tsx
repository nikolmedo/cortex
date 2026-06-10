import { Maximize2, PanelRight, Settings } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import styles from './TopBar.module.css';

interface TopBarProps {
  query: string;
  onNewQuery: () => void;
  hidden?: boolean;
  dossierOpen?: boolean;
  onToggleDossier?: () => void;
  onToggleImmersive?: () => void;
  onToggleSettings?: () => void;
}

export function TopBar({
  query,
  onNewQuery,
  hidden = false,
  dossierOpen = false,
  onToggleDossier,
  onToggleImmersive,
  onToggleSettings,
}: TopBarProps) {
  const { t } = useI18n();

  return (
    <div className={`${styles.bar} ${hidden ? styles.barHidden : ''}`}>
      <span className={styles.logo}>{t('app.title')}</span>
      <span className={styles.divider}>|</span>
      <span className={`${styles.chevron} chevron-blink`}>&gt;&gt;</span>
      <span className={styles.query}>{query}</span>

      <div className={styles.actions}>
        {onToggleDossier && (
          <button
            className={`${styles.btn} ${dossierOpen ? styles.btnActive : ''}`}
            onClick={onToggleDossier}
            title={t('dossier.toggle')}
          >
            <PanelRight size={11} />
            {t('dossier.title')}
          </button>
        )}
        {onToggleImmersive && (
          <button className={styles.btn} onClick={onToggleImmersive} title={t('immersive.enter')}>
            <Maximize2 size={11} />
            {t('immersive.enter')}
          </button>
        )}
        <button className={styles.btn} onClick={onNewQuery}>
          {t('topbar.newQuery')}
        </button>
        {onToggleSettings && (
          <button
            className={styles.iconBtn}
            onClick={onToggleSettings}
            aria-label={t('topbar.settings')}
            title={t('topbar.settings')}
          >
            <Settings size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
