import { useState } from 'react';
import { Search } from 'lucide-react';
import { CYAN } from '../../infrastructure/constants';
import { useI18n } from '../../i18n/I18nContext';
import styles from './QueryInput.module.css';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  /** Optional history chips rendered under the input. */
  historySlot?: React.ReactNode;
}

export function QueryInput({ onSubmit, historySlot }: QueryInputProps) {
  const { t } = useI18n();
  const [val, setVal] = useState('');
  const submit = () => val.trim() && onSubmit(val.trim());

  return (
    <div className={styles.wrap}>
      <div className={styles.logoBlock}>
        <div className={styles.logo}>{t('app.title')}</div>
        <div className={styles.tagline}>{t('app.tagline')}</div>
      </div>

      <div className={styles.field}>
        <span className={`${styles.chevron} chevron-blink`}>&gt;&gt;</span>
        <input
          autoFocus
          className={styles.input}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={t('input.placeholder')}
        />
        <button className={styles.searchBtn} onClick={submit} aria-label={t('input.search')}>
          <Search size={16} color={val ? CYAN : `${CYAN}44`} />
        </button>
      </div>
      <div className={styles.underline} />

      <div className={styles.hint}>{t('input.hint')}</div>

      {historySlot && <div className={styles.history}>{historySlot}</div>}
    </div>
  );
}
