import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { safeHttpsUrl, type Scene, type SceneSpotlight } from '../../../domain/Scene';
import { useBreakpoint } from '../../hooks/useBreakpoint';
import { useImageSource } from '../../hooks/useImageSource';
import { Materialize } from '../motion/Materialize';
import { balancedSpans, capRail, partitionModules, type IndexedModule, type ModuleSpan } from '../modules/items';
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

/** Stagger slots before the first module: header, spotlight, body. */
const LEAD_SLOTS = 3;

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
  const { layout } = scene.presentation;

  // Modules that were already on screen keep still; only newly arrived ones stagger.
  const rendered = useRef(0);
  const batchStart = rendered.current;
  useEffect(() => {
    rendered.current = scene.modules.length;
  }, [scene.modules.length]);
  const delayOf = (index: number) => (batchStart === 0 ? LEAD_SLOTS + index : Math.max(0, index - batchStart));

  // Only the scene's own validated https image; no keyword stock photos.
  const image = useImageSource(layout === 'dossier' ? safeHttpsUrl(scene.image_url) || null : null);
  const heroSrc = image.src;

  const spotlight = scene.spotlight && isTelling(scene.spotlight) ? scene.spotlight : undefined;
  const metaEntries = Object.entries(scene.meta);

  const split = partitionModules(layout, scene.modules);
  // Desktop puts the rail beside the reading column and the modules in a full
  // width row under both, so the rail only keeps what fits next to the answer.
  const railBudget = readingHeight(scene) - (spotlight ? 170 : 0) - (metaEntries.length > 0 ? 70 + Math.ceil(metaEntries.length / 2) * 58 : 0);
  const { main, rail } = bp === 'desktop' ? capRail(split.main, split.rail, railBudget) : split;

  const prosCons = layout === 'split' && bp === 'mobile' ? main.filter(m => m.module.kind === 'proscons') : [];
  const pair: [IndexedModule, IndexedModule] | null = prosCons.length >= 2 ? [prosCons[0], prosCons[1]] : null;

  const mainShown = pair ? main.filter(entry => entry !== pair[1]) : main;
  const mainSpans = balancedSpans(layout, mainShown, bp === 'desktop' ? 'wide' : 'narrow');
  const railSpans = balancedSpans(layout, rail);

  const card = ({ module, index }: IndexedModule, span: ModuleSpan) => (
    <Materialize key={index} index={delayOf(index)} active={reveal} span={span}>
      <ModuleCard module={module} />
    </Materialize>
  );

  const mainNodes: ReactNode[] = mainShown.map((entry, i) => (pair && entry === pair[0]
    ? (
      <Materialize key="pair" index={delayOf(entry.index)} active={reveal} span="wide">
        <SplitTabs pair={pair} />
      </Materialize>
    )
    : card(entry, mainSpans[i])));

  const hasBody = scene.answer.body.length > 0 || Boolean(scene.answer.caveats);
  // Follow-ups and sources close the answer: they wait until nothing else is coming.
  const followups = pending ? [] : scene.followups ?? [];
  const sources = pending ? [] : scene.sources ?? [];
  const lastSlot = LEAD_SLOTS + scene.modules.length;
  const shortRail = rail.length === 0 && metaEntries.length === 0;

  return (
    <article
      className={styles.composition}
      data-layout={layout}
      data-hero={heroSrc ? 'true' : 'false'}
      data-rail={shortRail ? 'short' : 'full'}
    >
      {heroSrc ? (
        <Materialize index={0} active={reveal} className={styles.hero}>
          <HeroMedia src={heroSrc} alt={scene.title} onError={image.onError} />
        </Materialize>
      ) : null}

      <Materialize index={0} active={reveal} className={styles.head}>
        <SceneHeader scene={scene} reveal={reveal} />
      </Materialize>

      <aside className={styles.rail}>
        {spotlight ? (
          <Materialize index={1} active={reveal} className={styles.spotlight}>
            <SpotlightCard spotlight={spotlight} />
          </Materialize>
        ) : null}
        {metaEntries.length > 0 ? (
          <Materialize index={2} active={reveal} className={styles.meta}>
            <MetaGrid entries={metaEntries} />
          </Materialize>
        ) : null}
        {rail.length > 0 ? (
          <div className={styles.railModules}>{rail.map((entry, i) => card(entry, railSpans[i]))}</div>
        ) : null}
      </aside>

      <div className={styles.main}>
        {hasBody ? (
          <Materialize index={2} active={reveal} className={styles.body}>
            <AnswerBody answer={scene.answer} reveal={reveal} />
          </Materialize>
        ) : null}
        {mainNodes.length > 0 ? <div className={styles.mainModules}>{mainNodes}</div> : null}
        {pending ? (
          <div className={styles.pending}>
            <Skeleton layout={layout} compact />
          </div>
        ) : null}
      </div>

      {followups.length > 0 || sources.length > 0 ? (
        <Materialize index={batchStart === 0 ? lastSlot : 0} active={reveal} className={styles.foot}>
          {followups.length > 0 ? <Followups items={followups} onSelect={onFollowup} /> : null}
          {sources.length > 0 ? <SourceList sources={sources} /> : null}
        </Materialize>
      ) : null}
    </article>
  );
}
