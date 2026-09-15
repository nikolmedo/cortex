import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Scene } from '../../../domain/Scene';
import { typeColor } from '../../../domain/typeColors';
import { IMG } from '../../../infrastructure/image';
import { useI18n } from '../../../i18n/I18nContext';
import type { TranslationKey } from '../../../i18n/translations';
import { useImageCascade } from '../../hooks/useImageCascade';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Monogram } from '../shared/Monogram';
import { CategorySection, copyCategoryText } from './CategorySection';
import { dossierLayout, type DossierBlock } from './dossierLayout';
import { MetaList } from './MetaList';
import { SourcesList } from './SourcesList';
import { SpotlightBlock, spotlightText } from './SpotlightBlock';
import styles from './DossierPanel.module.css';

export const DOSSIER_W = 360;

interface DossierPanelProps {
  scene: Scene;
  open: boolean;
  onHeroClick: () => void;
  /** Increment to scroll the spotlight block into view (graph spotlight click). */
  spotlightRequest?: number;
}

function buildDossierText(scene: Scene): string {
  const parts: string[] = [scene.title];
  if (scene.subtitle) parts.push(scene.subtitle);
  if (scene.spotlight) parts.push('', spotlightText(scene.spotlight));
  if (scene.summary) parts.push('', scene.summary);
  if (Object.keys(scene.meta).length) {
    parts.push('', ...Object.entries(scene.meta).map(([k, v]) => `${k}: ${v}`));
  }
  for (const cat of scene.graph) {
    parts.push('', copyCategoryText(cat));
  }
  if (scene.sources?.length) {
    parts.push('', ...scene.sources.map(s => (s.title ? `${s.title} — ${s.url}` : s.url)));
  }
  return parts.join('\n');
}

const BLOCK_LABEL: Record<DossierBlock, TranslationKey> = {
  spotlight: 'dossier.spotlight',
  summary: 'dossier.summary',
  meta: 'dossier.metadata',
  connections: 'dossier.connections',
  sources: 'dossier.sources',
};

export function DossierPanel({ scene, open, onHeroClick, spotlightRequest = 0 }: DossierPanelProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const [copiedAll, setCopiedAll] = useState(false);
  const spotlightRef = useRef<HTMLDivElement | null>(null);
  const color = typeColor(scene.type);
  const layout = useMemo(() => dossierLayout(scene), [scene]);
  const img = useImageCascade(scene.image_url || undefined, IMG.hero(scene.image_query || scene.title, 99));

  useEffect(() => {
    if (spotlightRequest === 0) return;
    spotlightRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [spotlightRequest, reducedMotion]);

  const copyAll = () => {
    navigator.clipboard.writeText(buildDossierText(scene)).then(() => {
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1400);
    });
  };

  const header = (block: DossierBlock, trailing?: ReactNode) => (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionLabel}>{t(BLOCK_LABEL[block])}</span>
      <span className={styles.sectionRule} />
      {trailing}
    </div>
  );

  const renderBlock = (block: DossierBlock): ReactNode => {
    switch (block) {
      case 'spotlight':
        return (
          <div ref={spotlightRef} className={styles.spotlight}>
            {header(block)}
            <SpotlightBlock spotlight={scene.spotlight!} color={color} />
          </div>
        );
      case 'summary':
        return (
          <>
            {header(
              block,
              <button className={styles.sectionCopy} onClick={copyAll}>
                {copiedAll ? t('dossier.copied') : t('dossier.copyAll')}
              </button>,
            )}
            <p className={styles.summary}>{scene.summary}</p>
          </>
        );
      case 'meta':
        return (
          <>
            {header(block)}
            <MetaList meta={scene.meta} color={color} />
          </>
        );
      case 'connections':
        return (
          <>
            {header(block, <span className={styles.sectionCount}>{String(scene.graph.length).padStart(2, '0')}</span>)}
            <div className={styles.connections}>
              {scene.graph.map((cat, i) => (
                <CategorySection
                  key={`${i}-${cat.category}`}
                  category={cat}
                  variant="panel"
                  defaultOpen={layout.openByDefault(i)}
                  railIndex={layout.indexRail ? i + 1 : undefined}
                />
              ))}
            </div>
          </>
        );
      case 'sources':
        return (
          <>
            {header(block)}
            <SourcesList sources={scene.sources!} color={color} />
          </>
        );
    }
  };

  return (
    <aside
      className={`${styles.panel} ${open ? '' : styles.panelClosed}`}
      style={{ '--c': color } as CSSProperties}
      data-mood={scene.presentation.mood}
      data-archetype={scene.presentation.archetype}
    >
      <div className={styles.scroll}>
        <div className={styles.hero} onClick={onHeroClick}>
          {img.src ? (
            <img className={styles.heroImg} src={img.src} alt={scene.title} onError={img.onError} />
          ) : (
            <Monogram title={scene.title} color={color} size={42} />
          )}
          <div className={styles.heroScrim} />
          <div className={styles.typeBadge}>
            <span className={styles.typeDot} />
            {scene.type.toUpperCase()}
          </div>
        </div>

        <div className={styles.title}>{scene.title}</div>
        {scene.subtitle && <div className={styles.subtitle}>{scene.subtitle}</div>}

        {layout.blocks.map((block, i) => (
          <section key={block} className={styles.block} style={{ '--i': i } as CSSProperties}>
            {renderBlock(block)}
          </section>
        ))}
      </div>
    </aside>
  );
}
