import type { ReactElement } from 'react';
import { Plus, Settings } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './TopBar.module.css';

interface TopBarProps {
  /** Session view shows the brand and "new session"; the landing shows settings only. */
  session: boolean;
  onNewSession: () => void;
  onOpenSettings: () => void;
}

export function TopBar({ session, onNewSession, onOpenSettings }: TopBarProps): ReactElement {
  const { t } = useI18n();
  return (
    <header className={styles.bar} data-session={session}>
      {session ? (
        <span className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true" />
          {t('app.name')}
        </span>
      ) : (
        <span />
      )}
      <div className={styles.actions}>
        {session ? (
          <button type="button" className={styles.action} onClick={onNewSession}>
            <Plus size={18} aria-hidden="true" />
            <span className={styles.actionLabel}>{t('topbar.newSession')}</span>
          </button>
        ) : null}
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onOpenSettings}
          aria-label={t('topbar.settings')}
          aria-haspopup="dialog"
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
