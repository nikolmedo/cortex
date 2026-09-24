import type { ReactElement } from 'react';
import { Clock } from 'lucide-react';
import { DEFAULT_PALETTE } from '../../../domain/Scene';
import { useI18n } from '../../../i18n/I18nContext';
import type { TranslationKey } from '../../../i18n/translations';
import { ThinkingCore } from '../../canvas/ThinkingCore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useTrendingQuestions } from '../../hooks/useTrendingQuestions';
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
  const { t, locale } = useI18n();
  const bp = useBreakpoint();
  const trending = useTrendingQuestions(locale);
  const live = trending.questions !== null;
  const examples = trending.questions ?? EXAMPLE_KEYS.map(key => t(key));
  // Fresh trending questions fade in over the static ones; a cached set is simply there.
  const swapClass = live && !trending.cached && !reduced ? styles.swap : undefined;

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

        <section className={styles.section} aria-labelledby="landing-examples" data-trending={live ? 'live' : 'static'}>
          <h2 id="landing-examples" key={live ? 'live' : 'static'} className={[styles.sectionLabel, swapClass].filter(Boolean).join(' ')}>
            {live ? (
              <>
                <span className={styles.liveDot} aria-hidden="true" />
                {t('landing.trending')}
              </>
            ) : t('landing.examples')}
          </h2>
          <div className={styles.chipArea}>
            <ul key={live ? 'live' : 'static'} className={[styles.chips, swapClass].filter(Boolean).join(' ')}>
              {examples.map(question => (
                <li key={question}>
                  <button type="button" className={styles.chip} onClick={() => onSubmit(question)}>
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
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
