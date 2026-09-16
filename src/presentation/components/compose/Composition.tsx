import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  safeHttpsUrl,
  type ModuleReveal, type Scene, type SceneLayout, type ScenePresentation, type SceneSpotlight,
} from '../../../domain/Scene';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useImageSource } from '../../hooks/useImageSource';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { staggerDelay } from '../../motion/motion';
import { MotionProvider } from '../../scene/MotionContext';
import { motionFor, staggerStep } from '../../scene/motionProfile';
import { Materialize, type MaterializeVariant } from '../motion/Materialize';
import {
  balancedSpans, capRail, hasContent, moduleItems, moduleReveal, moduleSpan, partitionModules,
  type IndexedModule, type ModuleSpan,
} from '../modules/items';
import { ModuleCard } from '../modules/ModuleCard';
import { Skeleton } from '../session/Skeleton';
import {
  AnswerBody, Followups, HeroMedia, MetaGrid, SceneHeader, SourceList, SplitTabs, SpotlightCard,
} from './blocks';
import styles from './Composition.module.css';

interface CompositionProps {
  scene: Scene;
  /** Animate arriving content (latest turn only). */
  reveal: boolean;
  /** More modules may still arrive; show a placeholder after the last one. */
  pending: boolean;
  onFollowup: (query: string) => void;
}

/** Stagger slot of each opening piece. The first module takes `modules`. */
interface LeadSlots {
  hero: number;
  head: number;
  spotlight: number;
  meta: number;
  body: number;
  modules: number;
}

/**
 * How a layout opens. Slots are shared on purpose: two pieces on the same slot
 * land together. Each layout leads with whatever carries its answer, so the
 * order the eye is given matches the order the layout wants to be read in.
 */
const LEAD_SLOTS: Record<SceneLayout, LeadSlots> = {
  // The reading column opens; the facts that support it follow.
  focus: { hero: 0, head: 0, spotlight: 1, meta: 2, body: 2, modules: 3 },
  // The portrait lands first and the identity reads off it.
  dossier: { hero: 0, head: 1, spotlight: 2, meta: 3, body: 3, modules: 4 },
  // Verdict, then both options arriving as one.
  split: { hero: 0, head: 0, spotlight: 1, meta: 2, body: 1, modules: 2 },
  // The track leads: the steps arrive before the prose framing them.
  sequence: { hero: 0, head: 0, spotlight: 2, meta: 3, body: 2, modules: 1 },
  // Many small tiles, so the opening is short and they cascade quickly.
  mosaic: { hero: 0, head: 0, spotlight: 1, meta: 2, body: 1, modules: 2 },
};

/**
 * Fixed map from a `reveal` directive to one of the four entrance families in
 * global.css. `fade` has no family of its own: it reuses the default entrance
 * and drops the card's inner draws instead (see kinds.module.css), which is the
 * part that actually reads as motion.
 */
const REVEAL_VARIANT: Record<ModuleReveal, MaterializeVariant> = {
  rise: 'materialize',
  draw: 'unfurl',
  count: 'settle',
  fade: 'materialize',
};

/** The scene's own `--dur-slow`, in ms, read back from the table that emits it. */
function slowMs(presentation: ScenePresentation): number {
  return parseInt(motionFor(presentation)['--dur-slow'], 10);
}

/**
 * A spotlight earns its place only when it carries something on its own: a
 * figure, a quotation, or a sentence. A bare title ("The default choice") would
 * render as an almost empty card, so it is dropped.
 */
function isTelling(spotlight: SceneSpotlight): boolean {
  if (spotlight.value) return true;
  const words = spotlight.label.trim().split(/\s+/).length;
  return words >= (spotlight.kind === 'quote' ? 4 : 6);
}

/** Rough height of the reading column, used to keep the rail from outrunning it. */
function readingHeight(scene: Scene): number {
  const paragraphs = scene.answer.body.reduce((sum, p) => sum + Math.ceil(p.length / 68) * 27 + 18, 0);
  const caveats = scene.answer.caveats ? 90 + scene.answer.caveats.length * 34 : 0;
  return 150 + paragraphs + caveats;
}

/**
 * One tree for every layout. Reading order is the DOM order; the layout's
 * CSS module arranges it per breakpoint (mobile, tablet, desktop).
 */
export function Composition({ scene, reveal, pending, onFollowup }: CompositionProps): ReactElement {
  const bp = useBreakpoint();
  const reduced = useReducedMotion();
  const { layout } = scene.presentation;
  const lead = LEAD_SLOTS[layout];
  const step = staggerStep(scene.presentation);

  // A card whose items, facts and body are all empty has nothing to draw, and an
  // empty one would still hold its cell in the grid. Dropped here, before
  // anything counts, places or staggers the cards, so every index below still
  // lines up with what is actually on screen.
  const modules = scene.modules.filter(hasContent);

  // Modules that were already on screen keep still; only newly arrived ones stagger.
  const rendered = useRef(0);
  const batchStart = rendered.current;
  useEffect(() => {
    rendered.current = modules.length;
  }, [modules.length]);
  const delayOf = (index: number) => (batchStart === 0 ? lead.modules + index : Math.max(0, index - batchStart));

  // `reveal` drops the moment the stream closes, but the last cards are still
  // drawing: the bars, rails and gauges inside a card are delayed by their own
  // item index, so a late chart or a long set of steps finishes well after the
  // card itself landed. Dropping the revealing state there freezes a bar half
  // filled, so it is held for the longest tail the last batch can still have:
  // the last card's own entrance delay, plus its items' stagger, plus --dur-slow.
  const [holding, setHolding] = useState(false);
  const lastModule = modules[modules.length - 1];
  const tailMs = staggerDelay(Math.max(0, modules.length - 1 - batchStart), step)
    + (lastModule ? moduleItems(lastModule).length * step : 0)
    + slowMs(scene.presentation);
  useEffect(() => {
    if (reveal) {
      setHolding(true);
      return undefined;
    }
    if (!holding) return undefined;
    const timer = window.setTimeout(() => setHolding(false), tailMs);
    return () => window.clearTimeout(timer);
  }, [reveal, holding, tailMs]);

  // One boolean settles whether anything moves, so the marker the CSS reads, the
  // value the subtree reads and the entrances themselves can never disagree.
  const animate = (reveal || holding) && !reduced;

  // Only the scene's own validated https image; no keyword stock photos.
  const image = useImageSource(layout === 'dossier' ? safeHttpsUrl(scene.image_url) || null : null);
  const heroSrc = image.src;

  const spotlight = scene.spotlight && isTelling(scene.spotlight) ? scene.spotlight : undefined;
  const metaEntries = Object.entries(scene.meta);

  // A `slot` directive only means something where there is a rail to move into,
  // which is a desktop arrangement; narrower screens stack everything anyway.
  const split = partitionModules(layout, modules, bp === 'desktop');
  // Desktop puts the rail beside the reading column and the modules in a full
  // width row under both, so the rail only keeps what fits next to the answer.
  const railBudget = readingHeight(scene) - (spotlight ? 170 : 0) - (metaEntries.length > 0 ? 70 + Math.ceil(metaEntries.length / 2) * 58 : 0);
  const { main, rail } = bp === 'desktop' ? capRail(split.main, split.rail, railBudget) : split;

  const prosCons = layout === 'split' && bp === 'mobile' ? main.filter(m => m.module.kind === 'proscons') : [];
  const pair: [IndexedModule, IndexedModule] | null = prosCons.length >= 2 ? [prosCons[0], prosCons[1]] : null;

  const mainShown = pair ? main.filter(entry => entry !== pair[1]) : main;
  const width = bp === 'desktop' ? 'wide' : 'narrow';
  const mainSpans = balancedSpans(layout, mainShown, width);
  const railSpans = balancedSpans(layout, rail);

  // While modules stream in, `balancedSpans` widens a lone trailing compact card
  // to fill its row, then flips it back the moment its neighbour arrives. Giving
  // the placeholder that empty column instead keeps the row from reflowing twice.
  const last = mainShown.length - 1;
  const fillsRow = pending
    && bp !== 'mobile'
    && last >= 0
    && mainSpans[last] === 'wide'
    && moduleSpan(layout, mainShown[last].module.kind, width, mainShown[last].module.span) === 'compact';
  if (fillsRow) mainSpans[last] = 'compact';

  // Both sides of a comparison land together; staggering them would imply an
  // order the comparison itself does not have.
  const pairAt = mainSpans.indexOf('pair');
  const pairLead = pairAt >= 0 ? mainShown[pairAt].index : -1;
  const moduleDelay = (entry: IndexedModule, span: ModuleSpan) =>
    delayOf(span === 'pair' && pairLead >= 0 ? pairLead : entry.index);

  const card = (entry: IndexedModule, span: ModuleSpan) => {
    const entrance = moduleReveal(entry.module);
    return (
      <Materialize
        key={entry.index}
        index={moduleDelay(entry, span)}
        active={animate}
        span={span}
        step={step}
        variant={entrance ? REVEAL_VARIANT[entrance] : undefined}
      >
        <ModuleCard module={entry.module} />
      </Materialize>
    );
  };

  const mainNodes: ReactNode[] = mainShown.map((entry, i) => (pair && entry === pair[0]
    ? (
      <Materialize key="pair" index={delayOf(entry.index)} active={animate} span="wide" step={step}>
        <SplitTabs pair={pair} />
      </Materialize>
    )
    : card(entry, mainSpans[i])));

  const hasBody = scene.answer.body.length > 0 || Boolean(scene.answer.caveats);
  // Follow-ups and sources close the answer: they wait until nothing else is coming.
  const followups = pending ? [] : scene.followups ?? [];
  const sources = pending ? [] : scene.sources ?? [];
  const lastSlot = lead.modules + modules.length;
  const shortRail = rail.length === 0 && metaEntries.length === 0;

  return (
    <MotionProvider reveal={animate}>
      <article
        className={styles.composition}
        data-layout={layout}
        data-hero={heroSrc ? 'true' : 'false'}
        data-rail={shortRail ? 'short' : 'full'}
        data-reveal={animate ? 'true' : 'false'}
      >
        {heroSrc ? (
          <Materialize index={lead.hero} active={animate} step={step} className={styles.hero}>
            <HeroMedia src={heroSrc} alt={scene.title} onError={image.onError} onLoad={image.onLoad} />
          </Materialize>
        ) : null}

        {/* A dossier leads with its portrait, so the identity follows it — but with
            no hero there is nothing to follow, and slot 0 would just sit empty. */}
        <Materialize index={heroSrc ? lead.head : lead.hero} active={animate} step={step} className={styles.head}>
          <SceneHeader scene={scene} reveal={reveal} />
        </Materialize>

        <aside className={styles.rail}>
          {spotlight ? (
            <Materialize index={lead.spotlight} active={animate} step={step} className={styles.spotlight}>
              <SpotlightCard spotlight={spotlight} />
            </Materialize>
          ) : null}
          {metaEntries.length > 0 ? (
            <Materialize index={lead.meta} active={animate} step={step} className={styles.meta}>
              <MetaGrid entries={metaEntries} />
            </Materialize>
          ) : null}
          {rail.length > 0 ? (
            <div className={styles.railModules}>{rail.map((entry, i) => card(entry, railSpans[i]))}</div>
          ) : null}
        </aside>

        <div className={styles.main}>
          {hasBody ? (
            <Materialize index={lead.body} active={animate} step={step} className={styles.body}>
              <AnswerBody answer={scene.answer} reveal={reveal} />
            </Materialize>
          ) : null}
          {mainNodes.length > 0 ? (
            <div className={styles.mainModules}>
              {mainNodes}
              {fillsRow ? (
                <div className={styles.pendingCell} data-span="compact">
                  <Skeleton layout={layout} compact />
                </div>
              ) : null}
            </div>
          ) : null}
          {pending && !fillsRow ? (
            <div className={styles.pending}>
              <Skeleton layout={layout} compact />
            </div>
          ) : null}
        </div>

        {followups.length > 0 || sources.length > 0 ? (
          <Materialize index={batchStart === 0 ? lastSlot : 0} active={animate} step={step} className={styles.foot}>
            {followups.length > 0 ? <Followups items={followups} onSelect={onFollowup} /> : null}
            {sources.length > 0 ? <SourceList sources={sources} /> : null}
          </Materialize>
        ) : null}
      </article>
    </MotionProvider>
  );
}
