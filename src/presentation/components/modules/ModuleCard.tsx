import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactElement } from 'react';
import { isHex, type SceneModule } from '../../../domain/Scene';
import { useI18n } from '../../../i18n/I18nContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { MotionProvider, useMotion } from '../../scene/MotionContext';
import { CardPattern } from './CardPattern';
import { moduleReveal } from './items';
import { KIND_ICON, kindLabelKey } from './kindIcons';
import { MODULE_RENDERERS } from './registry';
import styles from './ModuleCard.module.css';

interface ModuleCardProps {
  module: SceneModule;
  /** Hide the card title (the surrounding control already shows it, e.g. split tabs). */
  bare?: boolean;
  /** 1-based position among the cards on screen; drawn by the `numeral` header only. */
  ordinal?: number;
  /** Seeds the pattern; must hold for the whole turn (items.ts `patternSeed`). */
  seed?: string;
  /** The card's entrance delay in ms; inner JS motion (the count) starts with it. */
  delay?: number;
}

/**
 * Pointer-following highlight. The position is written as two custom properties
 * at most once per frame, and only a transform reads them; the stylesheet shows
 * the layer on fine hover-capable pointers only.
 */
function usePointerGlow(off: boolean) {
  const frame = useRef(0);
  const point = useRef({ x: 0, y: 0 });
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (e: PointerEvent<HTMLElement>) => {
    if (off || e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    point.current = { x: e.clientX, y: e.clientY };
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const box = el.getBoundingClientRect();
      el.style.setProperty('--px', `${(point.current.x - box.left).toFixed(1)}px`);
      el.style.setProperty('--py', `${(point.current.y - box.top).toFixed(1)}px`);
    });
  };
}

export function ModuleCard({ module, bare = false, ordinal, seed = module.kind, delay = 0 }: ModuleCardProps): ReactElement {
  const { t } = useI18n();
  const { reveal } = useMotion();
  const reduced = useReducedMotion();
  const onPointerMove = usePointerGlow(reduced);
  const entrance = moduleReveal(module);
  const Icon = KIND_ICON[module.kind];
  const Renderer = MODULE_RENDERERS[module.kind] ?? MODULE_RENDERERS.list;
  const color = isHex(module.color) ? module.color : undefined;
  const kindLabel = t(kindLabelKey(module.kind));
  const title = module.category || kindLabel;
  // A numeral needs a position to draw; without one the card keeps its icon.
  const header = module.header === 'numeral' && ordinal === undefined ? 'icon' : module.header ?? 'icon';

  return (
    <section
      className={styles.card}
      data-kind={module.kind}
      // Directives reach CSS only as these attributes; each stylesheet rule that
      // reads one is scoped to the card, never to a bare [data-kind].
      data-emphasis={module.emphasis ?? 'normal'}
      data-tone={module.tone ?? 'neutral'}
      // Card grammar: absent attributes leave the mood's defaults in charge.
      data-surface={module.surface}
      data-corner={module.corner}
      data-header={header}
      // Not `data-motion`: that attribute is the app-wide reduced-motion switch
      // on :root, and a second meaning on the card is a collision waiting to happen.
      data-enter={entrance ?? 'rise'}
      style={color ? ({ '--m': color } as CSSProperties) : undefined}
      aria-label={title}
      onPointerMove={onPointerMove}
    >
      <span className={styles.glow} aria-hidden="true">
        <span className={styles.glowSpot} />
      </span>
      {module.pattern && module.pattern !== 'none' ? (
        <CardPattern pattern={module.pattern} seed={seed} />
      ) : null}
      {module.corner === 'notch' ? (
        <>
          <span className={styles.notch} data-at="top" aria-hidden="true" />
          <span className={styles.notch} data-at="bottom" aria-hidden="true" />
        </>
      ) : null}
      {!bare || module.headline ? (
        <header className={styles.head}>
          {!bare && header === 'icon' ? (
            <span className={styles.icon} title={kindLabel}>
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
          ) : null}
          {!bare && header === 'numeral' ? (
            <span className={styles.numeral} aria-hidden="true">{String(ordinal).padStart(2, '0')}</span>
          ) : null}
          <div className={styles.titles}>
            {!bare ? (
              <h3 className={header === 'none' ? 'visually-hidden' : styles.title}>
                {title}
                {header === 'rule' ? <span className={styles.rule} aria-hidden="true" /> : null}
              </h3>
            ) : null}
            {module.headline ? <p className={styles.headline}>{module.headline}</p> : null}
          </div>
        </header>
      ) : null}
      <div className={styles.body}>
        <MotionProvider reveal={reveal} entrance={entrance} delay={delay}>
          <Renderer module={module} />
        </MotionProvider>
      </div>
    </section>
  );
}
