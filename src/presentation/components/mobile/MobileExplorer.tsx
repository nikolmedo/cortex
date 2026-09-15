import { useMemo, useState, type ReactNode } from 'react';
import { Search, Settings } from 'lucide-react';
import type { Scene } from '../../../domain/Scene';
import { typeColor } from '../../../domain/typeColors';
import { IMG } from '../../../infrastructure/image';
import { useI18n } from '../../../i18n/I18nContext';
import { CategorySection } from '../dossier/CategorySection';
import { dossierLayout, type DossierBlock } from '../dossier/dossierLayout';
import { MetaList } from '../dossier/MetaList';
import { SourcesList } from '../dossier/SourcesList';
import { SpotlightBlock } from '../dossier/SpotlightBlock';
import { Lightbox } from '../overlay/Lightbox';
import { EmptyState } from '../shared/EmptyState';
import { SceneSignature } from '../shared/SceneSignature';
import { HeroCard } from './HeroCard';
import styles from './MobileExplorer.module.css';

interface MobileExplorerProps {
  query: string;
  scene: Scene;
  onNewQuery: () => void;
  onRetry: () => void;
  onToggleSettings: () => void;
}

const BLOCK_DELAY = 0.18;

/** Ordered, readable futuristic layout for small screens — no free-floating graph. */
export function MobileExplorer({ query, scene, onNewQuery, onRetry, onToggleSettings }: MobileExplorerProps) {
  const { t } = useI18n();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const color = typeColor(scene.type);
  const layout = useMemo(() => dossierLayout(scene), [scene]);

  const copySummary = () => {
    navigator.clipboard.writeText(scene.summary).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  const card = (label: string, body: ReactNode, delay: number, trailing?: ReactNode) => (
    <div className={styles.card} style={{ animationDelay: `${delay}s` }}>
      <div className={styles.cardLabel}>
        <span className={styles.cardLabelText}>{label}</span>
        <span className={styles.cardLabelRule} />
        {trailing}
      </div>
      {body}
    </div>
  );

  const renderBlock = (block: DossierBlock, order: number): ReactNode => {
    const delay = BLOCK_DELAY + order * 0.08;
    switch (block) {
      case 'spotlight':
        return card(t('dossier.spotlight'), <SpotlightBlock spotlight={scene.spotlight!} color={color} />, delay);
      case 'summary':
        return card(
          t('dossier.summary'),
          <p className={styles.summary}>{scene.summary}</p>,
          delay,
          <button className={styles.copyBtn} onClick={copySummary}>
            {copied ? t('dossier.copied') : t('dossier.copy')}
          </button>,
        );
      case 'meta':
        return card(t('dossier.metadata'), <MetaList meta={scene.meta} color={color} />, delay);
      case 'sources':
        return card(t('dossier.sources'), <SourcesList sources={scene.sources!} color={color} />, delay);
      case 'connections':
        return (
          <>
            <div className={styles.divider} style={{ animationDelay: `${delay}s` }}>
              <span className={styles.dividerText}>
                {t('mobile.connections', { count: String(scene.graph.length).padStart(2, '0') })}
              </span>
              <span className={styles.dividerRule} />
            </div>
            {scene.graph.map((cat, i) => (
              <CategorySection
                key={`${i}-${cat.category}`}
                category={cat}
                variant="mobile"
                defaultOpen={layout.openByDefault(i)}
                showImage
                railIndex={layout.indexRail ? i + 1 : undefined}
                revealDelay={delay + 0.06 + i * 0.07}
              />
            ))}
          </>
        );
    }
  };

  return (
    <div className={styles.root} data-mood={scene.presentation.mood}>
      <div className={styles.stickyBar}>
        <span className={styles.logo}>{t('app.title')}</span>
        <span className={styles.query}>{query}</span>
        <button className={styles.iconBtn} onClick={onNewQuery} aria-label={t('mobile.newQuery')}>
          <Search size={15} />
        </button>
        <button className={styles.iconBtn} onClick={onToggleSettings} aria-label={t('topbar.settings')}>
          <Settings size={15} />
        </button>
      </div>

      <div className={styles.content}>
        <HeroCard scene={scene} onClick={() => setLightboxOpen(true)} />

        <div className={styles.banner}>
          <SceneSignature scene={scene} swatches />
        </div>

        {scene.graph.length === 0 && (
          <EmptyState variant="inline" query={query} onRetry={onRetry} onNewQuery={onNewQuery} />
        )}

        {layout.blocks.map((block, i) => (
          <div key={block} className={styles.block}>
            {renderBlock(block, i)}
          </div>
        ))}

        <button className={styles.newQueryBtn} onClick={onNewQuery}>
          {t('mobile.newQuery')}
        </button>
      </div>

      {lightboxOpen && (
        <Lightbox
          src={scene.image_url || IMG.lightbox(scene.image_query || scene.title, 99)}
          title={scene.title}
          color={color}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
