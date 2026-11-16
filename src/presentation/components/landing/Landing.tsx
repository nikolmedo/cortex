import type { CSSProperties, ReactElement } from 'react';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import type { TranslationKey } from '../../../i18n/translations';
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

/** Two-digit index readout for a row ("01", "02"). */
function indexOf(i: number): string {
  return String(i + 1).padStart(2, '0');
}

interface QuestionRowsProps {
  questions: readonly string[];
  onSubmit: (query: string) => void;
  className?: string;
}

/** A list of soft rows, entering one after another (--i); the whole row is the button. */
function QuestionRows({ questions, onSubmit, className }: QuestionRowsProps): ReactElement {
  return (
    <ol className={[styles.list, className].filter(Boolean).join(' ')}>
      {questions.map((question, i) => (
        <li key={question} style={{ '--i': i } as CSSProperties}>
          <button type="button" className={styles.row} onClick={() => onSubmit(question)}>
            <span className={styles.rowIndex} aria-hidden="true">{indexOf(i)}</span>
            <span className={styles.rowText}>{question}</span>
            <ArrowRight className={styles.rowArrow} size={16} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ol>
  );
}

export function Landing({ recent, reduced, onSubmit }: LandingProps): ReactElement {
  const { t, locale } = useI18n();
  const trending = useTrendingQuestions(locale);
  const live = trending.questions !== null;
  const examples = trending.questions ?? EXAMPLE_KEYS.map(key => t(key));
  // Fresh trending questions fade in over the static ones; a cached set is simply there.
  const swapClass = live && !trending.cached && !reduced ? styles.swap : undefined;

  return (
    <main className={styles.landing}>
      <div className={styles.column}>
        <h1 className={styles.name}>{t('app.name')}</h1>
        <p className={styles.tagline}>{t('app.tagline')}</p>

        <div className={styles.command}>
          <CommandBar docked={false} busy={false} onSubmit={onSubmit} onStop={() => undefined} />
        </div>

        <section className={styles.section} aria-labelledby="landing-examples" data-trending={live ? 'live' : 'static'}>
          <h2 id="landing-examples" key={live ? 'live' : 'static'} className={[styles.sectionLabel, swapClass].filter(Boolean).join(' ')}>
            {live ? <span className={styles.liveMark} aria-hidden="true" /> : null}
            {live ? t('landing.trending') : t('landing.examples')}
          </h2>
          <div className={styles.listArea}>
            <QuestionRows
              key={live ? 'live' : 'static'}
              questions={examples}
              onSubmit={onSubmit}
              className={swapClass}
            />
          </div>
        </section>

        {recent.length > 0 ? (
          <section className={styles.section} aria-labelledby="landing-recent">
            <h2 id="landing-recent" className={styles.sectionLabel}>{t('landing.recent')}</h2>
            <QuestionRows questions={recent} onSubmit={onSubmit} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
