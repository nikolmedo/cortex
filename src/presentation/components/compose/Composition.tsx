import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import {
  safeHttpsUrl,
  type ModuleReveal, type Scene, type SceneLayout, type ScenePresentation, type SceneSpotlight,
} from '../../../domain/Scene';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { COUNT_MS } from '../../hooks/useCountUp';
import { useFlip } from '../../hooks/useFlip';
import { useImageSource } from '../../hooks/useImageSource';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { staggerDelay } from '../../motion/motion';
import { MotionProvider } from '../../scene/MotionContext';
import { CASCADE_CAP_MS, motionFor, staggerStep } from '../../scene/motionProfile';
import { Materialize, type MaterializeVariant } from '../motion/Materialize';
import {
  balancedSpans, capRail, columnsOf, fillRows, hasContent, moduleReveal, moduleSpan, partitionModules,
  patternSeed, type IndexedModule, type ModuleSpan,
} from '../modules/items';
import { ModuleCard } from '../modules/ModuleCard';
import { Lingering, Skeleton } from '../session/Skeleton';
import {
  AnswerBody, Followups, HeroMedia, MetaGrid, SceneHeader, SourceList, SplitTabs, SpotlightCard,
} from './blocks';
import styles from './Composition.module.css';
import { useRevealHold } from './revealHold';

interface CompositionProps {
  scene: Scene;
  /**
   * Entrances may play: this is the latest turn and this view watched it arrive.
   * A turn restored or scrolled back to as already resolved never animates.
   */
  reveal: boolean;
  /** The turn is still in flight; content is arriving now. */
  live: boolean;
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
 * Fixed map from a `reveal` directive to an entrance family. `draw` scans the
 * card in top-down like the draws inside it, `count` locks on to its figures,
 * and `fade` just appears: the rise with no travel, and kinds.module.css drops
 * the card's inner draws as well.
 */
const REVEAL_VARIANT: Record<ModuleReveal, MaterializeVariant> = {
  rise: 'rise',
  draw: 'scan',
  count: 'lock',
  fade: 'fade',
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
export function Composition({ scene, reveal, live, pending, onFollowup }: CompositionProps): ReactElement {
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
  // The lead card is the hero of the module row, so the opening batch starts
  // with it wherever it sits in reading order; the rest keep theirs.
  const leadAt = modules.findIndex(m => m.emphasis === 'lead');
  const openingRank = (index: number) => {
    if (leadAt < 0 || index > leadAt) return index;
    return index === leadAt ? 0 : index + 1;
  };
  const delayOf = (index: number) => (batchStart === 0 ? lead.modules + openingRank(index) : Math.max(0, index - batchStart));

  // Entrances play while content arrives, then for as long as the last batch can
  // still be drawing: its latest card delay, the capped inner cascade, and the
  // longer of the entrance itself and a figure's count (see revealHold.ts).
  const tailMs = staggerDelay(lead.modules + Math.max(0, modules.length - batchStart), step)
    + CASCADE_CAP_MS
    + Math.max(slowMs(scene.presentation), COUNT_MS);
  // One boolean settles whether anything moves, so the marker the CSS reads, the
  // value the subtree reads and the entrances themselves can never disagree.
  const animate = useRevealHold(reveal, live, reduced, tailMs);
  const rootRef = useRef<HTMLElement>(null);

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
  // The rail is one narrow column where a size means nothing, so its cards are
  // balanced as if they had none.
  const railSpans = balancedSpans(layout, rail.map(entry => ({ ...entry, module: { ...entry.module, size: undefined } })));

  // While modules stream in, `balancedSpans` widens a lone trailing compact card
  // to fill its row, then flips it back the moment its neighbour arrives. Giving
  // the placeholder that empty column instead keeps the row from reflowing twice.
  const last = mainShown.length - 1;
  const fillsRow = pending
    && bp !== 'mobile'
    && last >= 0
    && mainShown[last].module.size === undefined
    && mainSpans[last] === 'wide'
    && moduleSpan(layout, mainShown[last].module.kind, width, mainShown[last].module.span) === 'compact';
  if (fillsRow) mainSpans[last] = 'compact';
  // Rows that still end short of 12 widen one of their own cards; the trailing
  // row stays open while more may arrive.
  const mainCols = fillRows(layout, mainShown, mainSpans, width, pending);

  // Spans, fills and rail membership: when this changes, cards that were
  // already on screen slide to their new place instead of jumping.
  const arrangement = [
    ...mainShown.map((entry, i) => `${entry.index}:${mainSpans[i]}:${mainCols[i] ?? ''}`),
    '|',
    ...rail.map(entry => entry.index),
  ].join(',');
  useFlip(rootRef, arrangement, !reduced);

  // Both sides of a comparison land together; staggering them would imply an
  // order the comparison itself does not have.
  const pairAt = mainSpans.indexOf('pair');
  const pairLead = pairAt >= 0 ? mainShown[pairAt].index : -1;
  const moduleDelay = (entry: IndexedModule, span: ModuleSpan) =>
    delayOf(span === 'pair' && pairLead >= 0 ? pairLead : entry.index);

  // The rail is a narrow column, so a size there means nothing and is not passed.
  // `ordinal` is the card's place in the order narrow screens stack them: the
  // main row first, then the rail. It shifts as cards stream in, so it only
  // draws the numeral; the pattern is seeded from the card's place in the scene.
  // A main card always gets its full column count; the stylesheet only spans it.
  const card = (entry: IndexedModule, span: ModuleSpan, ordinal: number, inRail = false, fill?: number) => {
    const entrance = moduleReveal(entry.module);
    const slot = moduleDelay(entry, span);
    const cols = inRail ? undefined : fill ?? columnsOf(layout, entry.module, span, width);
    return (
      <Materialize
        key={entry.index}
        index={slot}
        active={animate}
        span={span}
        size={inRail || span === 'pair' ? undefined : entry.module.size}
        cols={cols}
        step={step}
        variant={entrance ? REVEAL_VARIANT[entrance] : undefined}
        flipKey={entry.index}
      >
        <ModuleCard
          module={entry.module}
          ordinal={ordinal}
          seed={patternSeed(scene.modules, entry.module)}
          delay={animate ? staggerDelay(slot, step) : 0}
        />
      </Materialize>
    );
  };

  const mainNodes: ReactNode[] = mainShown.map((entry, i) => (pair && entry === pair[0]
    ? (
      <Materialize key="pair" index={delayOf(entry.index)} active={animate} span="wide" step={step}>
        <SplitTabs pair={pair} />
      </Materialize>
    )
    : card(entry, mainSpans[i], i + 1, false, mainCols[i])));

  const hasBody = scene.answer.body.length > 0 || Boolean(scene.answer.caveats);
  // Follow-ups and sources close the answer: they wait until nothing else is coming.
  const followups = pending ? [] : scene.followups ?? [];
  const sources = pending ? [] : scene.sources ?? [];
  const lastSlot = lead.modules + modules.length;
  const shortRail = rail.length === 0 && metaEntries.length === 0;

  return (
    <MotionProvider reveal={animate}>
      <article
        ref={rootRef}
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
        {/* Text never takes a clip: the headline and the body rise, and their
            phrases carry the rest of the motion. */}
        <Materialize index={heroSrc ? lead.head : lead.hero} active={animate} step={step} variant="rise" className={styles.head}>
          <SceneHeader scene={scene} reveal={animate} />
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
            <div className={styles.railModules}>{rail.map((entry, i) => card(entry, railSpans[i], mainShown.length + i + 1, true))}</div>
          ) : null}
        </aside>

        <div className={styles.main}>
          {hasBody ? (
            <Materialize index={lead.body} active={animate} step={step} variant="rise" className={styles.body}>
              <AnswerBody answer={scene.answer} reveal={animate} />
            </Materialize>
          ) : null}
          {mainNodes.length > 0 ? (
            <div className={styles.mainModules}>
              {mainNodes}
              <Lingering show={fillsRow} fade={animate} className={styles.pendingCell} span="compact">
                <Skeleton layout={layout} compact />
              </Lingering>
            </div>
          ) : null}
          <Lingering show={pending && !fillsRow} fade={animate} className={styles.pending}>
            <Skeleton layout={layout} compact />
          </Lingering>
        </div>

        {followups.length > 0 || sources.length > 0 ? (
          <Materialize index={batchStart === 0 ? lastSlot : 0} active={animate} step={step} variant="rise" className={styles.foot}>
            {followups.length > 0 ? <Followups items={followups} onSelect={onFollowup} /> : null}
            {sources.length > 0 ? <SourceList sources={sources} /> : null}
          </Materialize>
        ) : null}
      </article>
    </MotionProvider>
  );
}
