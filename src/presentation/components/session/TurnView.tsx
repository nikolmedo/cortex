import { useLayoutEffect, useRef, type ReactElement } from 'react';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { isInterrupted, type Turn } from '../../../application/useCortex';
import { useI18n } from '../../../i18n/I18nContext';
import { ThinkingCore, type CorePhase, type StepState } from '../../canvas/ThinkingCore';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { turnPresentation } from '../../scene/presentation';
import { SceneTheme } from '../../scene/SceneTheme';
import { Composition } from '../compose/Composition';
import { staggerDelay } from '../../motion/motion';
import { Skeleton } from './Skeleton';
import styles from './TurnView.module.css';

interface TurnViewProps {
  turn: Turn;
  isLatest: boolean;
  reduced: boolean;
  onRetry: (turnId: string) => void;
  onFollowup: (query: string) => void;
}

const CORE_SIZE = { mobile: 132, tablet: 168, desktop: 184 } as const;
const GLYPH_SIZE = { mobile: 36, tablet: 40, desktop: 40 } as const;

function corePhase(turn: Turn): CorePhase {
  if (turn.status === 'error') return 'error';
  if (turn.status === 'done') return 'resolved';
  if (turn.scene) return 'streaming';
  return turn.preface ? 'planned' : 'thinking';
}

/**
 * Plan steps advance on real events, never on a timer: the grounded research
 * returning, the first partial scene, the first module that materialised.
 */
function stepStates(turn: Turn): StepState[] {
  const plan = turn.preface?.plan ?? [];
  if (plan.length === 0) return [];
  if (turn.status === 'error') return plan.map(() => 'pending');
  if (turn.status === 'done') return plan.map(() => 'done');
  const done = (turn.research ? 1 : 0) + (turn.scene ? 1 : 0) + ((turn.scene?.modules.length ?? 0) > 0 ? 1 : 0);
  return plan.map((_, i) => (i < done ? 'done' : i === done ? 'active' : 'pending'));
}

function isEmptyScene(turn: Turn): boolean {
  const scene = turn.scene;
  return turn.status === 'done' && scene != null && scene.modules.length === 0 && scene.answer.body.length === 0;
}

export function TurnView({ turn, isLatest, reduced, onRetry, onFollowup }: TurnViewProps): ReactElement {
  const { t } = useI18n();
  const bp = useBreakpoint();
  const presentation = turnPresentation(turn);
  const inFlight = turn.status === 'thinking' || turn.status === 'streaming';
  const staged = inFlight && !turn.scene;
  const steps = stepStates(turn);
  const coreSize = CORE_SIZE[bp];
  const glyphSize = GLYPH_SIZE[bp];

  const rootRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const glyphRef = useRef<HTMLSpanElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  // One canvas per turn. It lives in the stage while the answer is being built and
  // morphs (transform only) into the header glyph once content arrives.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const core = coreRef.current;
    if (!root || !core) return undefined;
    const place = () => {
      const target = staged ? slotRef.current : glyphRef.current;
      if (!target) return;
      const base = root.getBoundingClientRect();
      const box = target.getBoundingClientRect();
      const scale = box.width / coreSize;
      core.style.transform = `translate(${(box.left - base.left).toFixed(1)}px, ${(box.top - base.top).toFixed(1)}px) scale(${scale.toFixed(4)})`;
    };
    place();
    const frame = requestAnimationFrame(() => {
      core.dataset.ready = 'true';
    });
    const observer = new ResizeObserver(place);
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [staged, coreSize, glyphSize, turn.preface]);

  const scene = turn.scene;
  const empty = isEmptyScene(turn);
  // The partial of an interrupted turn keeps the streaming treatment: the
  // skeleton tail stays, and follow-ups and sources stay closed.
  const interrupted = isInterrupted(turn);

  return (
    <SceneTheme presentation={presentation} className={`${styles.turn} ${isLatest ? styles.latest : ''}`}>
      <div
        ref={rootRef}
        id={turn.id}
        className={styles.frame}
        data-status={turn.status}
        aria-busy={inFlight}
      >
        <div ref={coreRef} className={styles.core} style={{ width: coreSize, height: coreSize }}>
          <ThinkingCore
            phase={corePhase(turn)}
            palette={presentation.palette}
            steps={steps}
            size={coreSize}
            reduced={reduced}
          />
        </div>

        <header className={styles.header}>
          <span ref={glyphRef} className={styles.glyph} style={{ width: glyphSize, height: glyphSize }} aria-hidden="true" />
          <p className={styles.query}>
            <span className="visually-hidden">{t('turn.question')}: </span>
            {turn.query}
          </p>
          {turn.status === 'done' ? (
            <button type="button" className={styles.iconBtn} onClick={() => onRetry(turn.id)} aria-label={t('turn.retry')} title={t('turn.retry')}>
              <RotateCcw size={16} aria-hidden="true" />
            </button>
          ) : null}
        </header>

        {staged ? (
          <div className={styles.stage}>
            <div ref={slotRef} className={styles.coreSlot} style={{ width: coreSize, height: coreSize }} />
            <div className={styles.stageText} aria-live="polite">
              <p className={styles.status}>{t(turn.preface ? 'turn.researching' : 'turn.reading')}</p>
              {turn.preface?.title ? <p className={styles.workingTitle}>{turn.preface.title}</p> : null}
              {steps.length > 0 && turn.preface ? (
                <ol className={styles.plan}>
                  {turn.preface.plan.map((step, i) => (
                    <li
                      key={i}
                      className={styles.planStep}
                      data-state={steps[i]}
                      style={{ animationDelay: `${staggerDelay(i + 1, 90)}ms` }}
                    >
                      <span className={styles.planMark} aria-hidden="true" />
                      <span className={styles.planText}>{step}</span>
                      <span className="visually-hidden">
                        {t(steps[i] === 'done' ? 'turn.stepDone' : steps[i] === 'active' ? 'turn.stepActive' : 'turn.stepPending')}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </div>
        ) : null}

        {staged ? <Skeleton layout={presentation.layout} /> : null}

        {turn.status === 'error' ? (
          <div className={styles.notice} role="alert">
            <TriangleAlert size={20} className={styles.noticeIcon} aria-hidden="true" />
            <div className={styles.noticeText}>
              <p className={styles.noticeTitle}>{t(interrupted ? 'turn.interruptedTitle' : 'turn.errorTitle')}</p>
              <p className={styles.noticeBody}>
                {interrupted
                  ? t(turn.error === 'error.cancelled' ? 'turn.interruptedCancelled' : 'turn.interruptedBody')
                  : t(turn.error ?? 'error.unknown')}
              </p>
            </div>
            <button type="button" className={styles.retry} onClick={() => onRetry(turn.id)}>
              <RotateCcw size={16} aria-hidden="true" />
              {t('turn.retry')}
            </button>
          </div>
        ) : null}

        {scene && empty ? (
          <div className={styles.notice}>
            <div className={styles.noticeText}>
              <p className={styles.noticeTitle}>{t('turn.emptyTitle')}</p>
              <p className={styles.noticeBody}>{t('turn.emptyBody')}</p>
            </div>
            <button type="button" className={styles.retry} onClick={() => onRetry(turn.id)}>
              <RotateCcw size={16} aria-hidden="true" />
              {t('turn.retry')}
            </button>
          </div>
        ) : null}

        {scene && !empty ? (
          <Composition
            scene={scene}
            reveal={isLatest && !reduced}
            pending={turn.status === 'streaming' || interrupted}
            onFollowup={onFollowup}
          />
        ) : null}
      </div>
    </SceneTheme>
  );
}
