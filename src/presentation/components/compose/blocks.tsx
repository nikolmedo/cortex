import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from 'react';
import { ArrowRight, ArrowUpRight, Expand, Info } from 'lucide-react';
import { safeHttpsUrl, type Scene, type SceneAnswer, type SceneSource, type SceneSpotlight } from '../../../domain/Scene';
import { useI18n } from '../../../i18n/I18nContext';
import type { ImageStatus } from '../../hooks/useImageSource';
import type { IndexedModule } from '../modules/items';
import { ModuleCard } from '../modules/ModuleCard';
import { RichText } from '../text/RichText';
import { ImageViewer } from '../overlay/ImageViewer';
import styles from './blocks.module.css';

export function SceneHeader({ scene, reveal }: { scene: Scene; reveal: boolean }): ReactElement {
  const { t } = useI18n();
  return (
    <header className={styles.sceneHeader}>
      <p className={styles.eyebrow}>
        <span className={styles.eyebrowDot} aria-hidden="true" />
        {t(`intent.${scene.intent}`)}
      </p>
      <h2 className={styles.title}>{scene.title}</h2>
      {scene.subtitle ? <p className={styles.subtitle}>{scene.subtitle}</p> : null}
      {scene.answer.headline ? (
        <p className={styles.lead}>
          <RichText text={scene.answer.headline} reveal={reveal} delay={120} />
        </p>
      ) : null}
    </header>
  );
}

export function AnswerBody({ answer, reveal }: { answer: SceneAnswer; reveal: boolean }): ReactElement {
  const { t } = useI18n();
  return (
    <div className={styles.answer}>
      {answer.body.length > 0 ? (
        <div className={styles.paragraphs}>
          {answer.body.map((p, i) => (
            <p key={i}>
              <RichText text={p} reveal={reveal} delay={Math.min(200 + i * 60, 360)} />
            </p>
          ))}
        </div>
      ) : null}
      {answer.caveats ? (
        <aside className={styles.caveats}>
          <h3 className={styles.blockLabel}>
            <Info size={15} aria-hidden="true" />
            {t('turn.caveats')}
          </h3>
          <ul>
            {answer.caveats.map((c, i) => <li key={i}><RichText text={c} /></li>)}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}

export function SpotlightCard({ spotlight }: { spotlight: SceneSpotlight }): ReactElement {
  const { kind, label, value, source } = spotlight;
  // A "stat" without its number is not a number: it reads as a callout instead
  // of a card with a caption and nothing above it.
  const shape = kind === 'stat' && !value ? 'callout' : kind;
  return (
    <figure className={styles.spotlight} data-kind={shape}>
      {shape === 'stat' ? (
        <>
          <span className={styles.spotValue}>{value}</span>
          <figcaption className={styles.spotLabel}>{label}</figcaption>
        </>
      ) : shape === 'quote' ? (
        <>
          <blockquote className={styles.spotQuote}>{label}</blockquote>
          {value ? <figcaption className={styles.spotLabel}>{value}</figcaption> : null}
        </>
      ) : (
        <>
          <p className={styles.spotCallout}>{label}</p>
          {value ? <span className={styles.spotLabel}>{value}</span> : null}
        </>
      )}
      {source ? <span className={styles.spotSource}>{source}</span> : null}
    </figure>
  );
}

export function MetaGrid({ entries }: { entries: Array<[string, string]> }): ReactElement {
  const { t } = useI18n();
  return (
    <section className={styles.meta}>
      <h3 className={styles.blockLabel}>{t('turn.details')}</h3>
      <dl className={styles.metaGrid}>
        {entries.map(([key, value]) => (
          <div key={key} className={styles.metaPair}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

interface HeroMediaProps {
  src: string;
  alt: string;
  onError: () => void;
  /** Optional: lets the owner of the URL follow the load it cannot observe itself. */
  onLoad?: () => void;
}

/** The nominal box before the image speaks for itself; it matches --hero-default. */
const RESERVED = { w: 1600, h: 1000 };

interface HeroState {
  src: string;
  status: ImageStatus;
  w: number;
  h: number;
}

export function HeroMedia({ src, alt, onError, onLoad }: HeroMediaProps): ReactElement {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<HeroState>({ src, status: 'loading', w: 0, h: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  // Adjusted during render rather than in an effect: a new URL must not inherit
  // the previous image's status for a frame, or the figure would flash its result.
  if (state.src !== src) setState({ src, status: 'loading', w: 0, h: 0 });
  const current: HeroState = state.src === src ? state : { src, status: 'loading', w: 0, h: 0 };

  const markLoaded = (img: HTMLImageElement) => {
    setState({ src, status: 'loaded', w: img.naturalWidth, h: img.naturalHeight });
    onLoad?.();
  };
  const markFailed = () => {
    setState({ src, status: 'error', w: 0, h: 0 });
    onError();
  };

  // A cached image can finish before React attaches onLoad, which would leave the
  // figure shimmering for good. Once mounted the element already knows the answer.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete) return;
    if (img.naturalWidth === 0) markFailed();
    else markLoaded(img);
  }, [src]);

  // Clamped: a panorama or a tower would otherwise reserve an absurd box. Whatever
  // the clamp letterboxes is covered by the blurred fill, not cut away.
  const ratio = current.w > 0 && current.h > 0
    ? Math.min(Math.max(current.w / current.h, 0.7), 1.9)
    : null;

  return (
    <>
      <figure
        className={styles.hero}
        data-state={current.status}
        style={ratio ? ({ '--hero-ratio': String(ratio) } as CSSProperties) : undefined}
      >
        <button
          type="button"
          className={styles.heroFrame}
          disabled={current.status !== 'loaded'}
          onClick={() => setOpen(true)}
        >
          <img className={styles.heroFill} src={src} alt="" aria-hidden="true" decoding="async" />
          <img
            ref={imgRef}
            className={styles.heroImg}
            src={src}
            alt={alt}
            // Only an intrinsic-ratio hint for the browser; the reserved box is
            // the figure's aspect-ratio, which CSS sizes on its own.
            width={current.w || RESERVED.w}
            height={current.h || RESERVED.h}
            decoding="async"
            onLoad={e => markLoaded(e.currentTarget)}
            onError={markFailed}
          />
          <span className={styles.heroShade} aria-hidden="true" />
          <span className={styles.heroBadge} aria-hidden="true">
            <Expand size={15} />
          </span>
          {/* Composed name: "enlarge" plus the image's own alt, which an
              aria-label on the button would have hidden. */}
          <span className="visually-hidden">{t('image.enlarge')}</span>
        </button>
        {current.status === 'loading' ? (
          <>
            <span className={styles.heroBone} aria-hidden="true" />
            <span className="visually-hidden">{t('image.loading')}</span>
          </>
        ) : null}
        {current.status === 'error' ? (
          <figcaption className={styles.heroFallback}>
            <span className={styles.heroMark} aria-hidden="true" />
            {t('image.unavailable')}
          </figcaption>
        ) : null}
      </figure>
      {open ? <ImageViewer src={src} alt={alt} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function SourceList({ sources }: { sources: SceneSource[] }): ReactElement {
  const { t } = useI18n();
  return (
    <section className={styles.sources}>
      <h3 className={styles.blockLabel}>{t('turn.sources')}</h3>
      <ol className={styles.sourceList}>
        {sources.map((source, i) => {
          const url = safeHttpsUrl(source.url);
          if (!url) return null;
          const host = hostOf(url);
          // Grounded sources come back as one redirect host with the real site in
          // the title; showing that host on every row says nothing.
          const showHost = host !== '' && host !== source.title.toLowerCase() && !host.endsWith('vertexaisearch.cloud.google.com');
          return (
            <li key={i}>
              <a className={styles.source} href={url} target="_blank" rel="noopener noreferrer">
                <span className={styles.sourceTitle}>{source.title || host}</span>
                <span className={styles.sourceHost}>
                  {showHost ? host : null}
                  <ArrowUpRight size={13} aria-hidden="true" />
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function Followups({ items, onSelect }: { items: string[]; onSelect: (query: string) => void }): ReactElement {
  const { t } = useI18n();
  return (
    <section className={styles.followups}>
      <h3 className={styles.blockLabel}>{t('turn.followups')}</h3>
      <ul className={styles.chips}>
        {items.map((q, i) => (
          <li key={i}>
            <button type="button" className={styles.chip} onClick={() => onSelect(q)}>
              <span>{q}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Mobile split: the two sides of a comparison as A/B tabs instead of a squeezed two-up. */
export function SplitTabs({ pair }: { pair: [IndexedModule, IndexedModule] }): ReactElement {
  const { t } = useI18n();
  const id = useId();
  const [selected, setSelected] = useState(0);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = selected === 0 ? 1 : 0;
    setSelected(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  };

  return (
    <div className={styles.tabs}>
      <div
        role="tablist"
        aria-label={t('module.sections')}
        className={styles.tabList}
        style={{ '--tab': selected } as CSSProperties}
        onKeyDown={onKeyDown}
      >
        <span className={styles.tabIndicator} aria-hidden="true" />
        {pair.map(({ module }, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={selected === i}
            aria-controls={`${id}-panel`}
            tabIndex={selected === i ? 0 : -1}
            className={styles.tab}
            onClick={() => setSelected(i)}
          >
            {module.category || t(i === 0 ? 'module.sideA' : 'module.sideB')}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${selected}`} className={styles.tabPanel}>
        <ModuleCard key={selected} module={pair[selected].module} bare />
      </div>
    </div>
  );
}
