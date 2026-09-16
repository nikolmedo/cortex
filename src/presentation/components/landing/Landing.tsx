import type { ReactElement } from 'react';
import { Clock } from 'lucide-react';
import { DEFAULT_PALETTE } from '../../../domain/Scene';
import { useI18n } from '../../../i18n/I18nContext';
import type { TranslationKey } from '../../../i18n/translations';
import { ThinkingCore } from '../../canvas/ThinkingCore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { CommandBar } from '../command/CommandBar';
import styles from './Landing.module.css';

const EXAMPLE_KEYS: readonly TranslationKey[] = [
  'command.examples.3',
  'command.examples.2',
  'command.examples.1',
  'command.examples.4',
  'command.examples.5',
];

interface LandingProps {
  recent: string[];
  reduced: boolean;
  onSubmit: (query: string) => void;
}

export function Landing({ recent, reduced, onSubmit }: LandingProps): ReactElement {
  const { t } = useI18n();
  const bp = useBreakpoint();

  return (
    <main className={styles.landing}>
      <div className={styles.center}>
        <ThinkingCore
          className={styles.core}
          phase="idle"
          palette={DEFAULT_PALETTE}
          steps={[]}
          size={bp === 'mobile' ? 104 : 144}
          reduced={reduced}
        />
        <h1 className={styles.name}>{t('app.name')}</h1>
        <p className={styles.tagline}>{t('app.tagline')}</p>

        <div className={styles.command}>
          <CommandBar docked={false} busy={false} onSubmit={onSubmit} onStop={() => undefined} />
        </div>

        <section className={styles.section} aria-labelledby="landing-examples">
          <h2 id="landing-examples" className={styles.sectionLabel}>{t('landing.examples')}</h2>
          <ul className={styles.chips}>
            {EXAMPLE_KEYS.map(key => (
              <li key={key}>
                <button type="button" className={styles.chip} onClick={() => onSubmit(t(key))}>
                  {t(key)}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {recent.length > 0 ? (
          <section className={styles.section} aria-labelledby="landing-recent">
            <h2 id="landing-recent" className={styles.sectionLabel}>{t('landing.recent')}</h2>
            <ul className={styles.recent}>
              {recent.map(q => (
                <li key={q}>
                  <button type="button" className={styles.recentItem} onClick={() => onSubmit(q)}>
                    <Clock size={15} aria-hidden="true" />
                    <span className={styles.recentText}>{q}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}
