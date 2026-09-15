import { RotateCcw, Search } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  /** 'overlay' floats over the desktop canvas; 'inline' sits in the mobile document flow. */
  variant?: 'overlay' | 'inline';
  query: string;
  onRetry: () => void;
  onNewQuery: () => void;
}

/** HUD-style notice shown when a scene comes back with no categories. */
export function EmptyState({ variant = 'overlay', query, onRetry, onNewQuery }: EmptyStateProps) {
  const { t } = useI18n();

  return (
    <div className={variant === 'inline' ? styles.inline : styles.wrap} role="status">
      <div className={styles.panel}>
        <span className={styles.tl} />
        <span className={styles.tr} />
        <span className={styles.bl} />
        <span className={styles.br} />

        <div className={styles.readout}>
          <span className={styles.readoutIndex}>[00]</span>
          <span className={styles.readoutQuery}>{query}</span>
        </div>
        <h2 className={styles.title}>{t('empty.title')}</h2>
        <p className={styles.body}>{t('empty.body')}</p>

        <div className={styles.actions}>
          <button className={styles.primary} onClick={onRetry}>
            <RotateCcw size={11} strokeWidth={2} />
            {t('empty.retry')}
          </button>
          <button className={styles.secondary} onClick={onNewQuery}>
            <Search size={11} strokeWidth={2} />
            {t('topbar.newQuery')}
          </button>
        </div>
      </div>
    </div>
  );
}
