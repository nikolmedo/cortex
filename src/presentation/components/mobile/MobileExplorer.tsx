import { useState } from 'react';
import { Search, Settings } from 'lucide-react';
import type { GraphData } from '../../../domain/GraphData';
import { typeColor } from '../../../domain/typeColors';
import { IMG } from '../../../infrastructure/image';
import { useI18n } from '../../../i18n/I18nContext';
import { CategorySection } from '../dossier/CategorySection';
import { MetaList } from '../dossier/MetaList';
import { Lightbox } from '../overlay/Lightbox';
import { HeroCard } from './HeroCard';
import styles from './MobileExplorer.module.css';

interface MobileExplorerProps {
  query: string;
  graphData: GraphData;
  onNewQuery: () => void;
  onToggleSettings: () => void;
}

/** Ordered, readable futuristic layout for small screens — no free-floating graph. */
export function MobileExplorer({ query, graphData, onNewQuery, onToggleSettings }: MobileExplorerProps) {
  const { t } = useI18n();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const color = typeColor(graphData.type);
  const meta = graphData.meta ?? {};
  const nodeCount = graphData.graph.length;

  const copySummary = () => {
    if (!graphData.summary) return;
    navigator.clipboard.writeText(graphData.summary).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <div className={styles.root}>
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
        <HeroCard graphData={graphData} onClick={() => setLightboxOpen(true)} />

        {graphData.summary && (
          <div className={styles.card} style={{ animationDelay: '0.18s' }}>
            <div className={styles.cardLabel}>
              <span className={styles.cardLabelText}>{t('dossier.summary')}</span>
              <span className={styles.cardLabelRule} />
              <button className={styles.copyBtn} onClick={copySummary}>
                {copied ? t('dossier.copied') : t('dossier.copy')}
              </button>
            </div>
            <p className={styles.summary}>{graphData.summary}</p>
          </div>
        )}

        {Object.keys(meta).length > 0 && (
          <div className={styles.card} style={{ animationDelay: '0.26s' }}>
            <div className={styles.cardLabel}>
              <span className={styles.cardLabelText}>{t('dossier.metadata')}</span>
              <span className={styles.cardLabelRule} />
            </div>
            <MetaList meta={meta} color={color} />
          </div>
        )}

        <div className={styles.divider} style={{ animationDelay: '0.34s' }}>
          <span className={styles.dividerText}>
            {t('mobile.connections', { count: String(nodeCount).padStart(2, '0') })}
          </span>
          <span className={styles.dividerRule} />
        </div>

        {graphData.graph.map((cat, i) => (
          <CategorySection
            key={i}
            category={cat}
            defaultOpen={i === 0}
            showImage
            revealDelay={0.4 + i * 0.07}
          />
        ))}

        <button className={styles.newQueryBtn} onClick={onNewQuery}>
          {t('mobile.newQuery')}
        </button>
      </div>

      {lightboxOpen && (
        <Lightbox
          src={graphData.image_url || IMG.lightbox(graphData.image_query ?? graphData.title, 99)}
          title={graphData.title}
          color={color}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
