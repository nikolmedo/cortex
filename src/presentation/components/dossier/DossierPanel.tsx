import { useState } from 'react';
import type { GraphData } from '../../../domain/GraphData';
import { typeColor } from '../../../domain/typeColors';
import { IMG } from '../../../infrastructure/image';
import { useI18n } from '../../../i18n/I18nContext';
import { useImageCascade } from '../../hooks/useImageCascade';
import { Monogram } from '../shared/Monogram';
import { CategorySection, copyCategoryText } from './CategorySection';
import { MetaList } from './MetaList';
import styles from './DossierPanel.module.css';

export const DOSSIER_W = 360;

interface DossierPanelProps {
  graphData: GraphData;
  open: boolean;
  onHeroClick: () => void;
}

export function buildDossierText(graphData: GraphData): string {
  const parts: string[] = [graphData.title];
  if (graphData.subtitle) parts.push(graphData.subtitle);
  if (graphData.summary) parts.push('', graphData.summary);
  const meta = graphData.meta ?? {};
  if (Object.keys(meta).length) {
    parts.push('', ...Object.entries(meta).map(([k, v]) => `${k}: ${v}`));
  }
  for (const cat of graphData.graph) {
    parts.push('', copyCategoryText(cat));
  }
  return parts.join('\n');
}

export function DossierPanel({ graphData, open, onHeroClick }: DossierPanelProps) {
  const { t } = useI18n();
  const [copiedAll, setCopiedAll] = useState(false);
  const color = typeColor(graphData.type);
  const img = useImageCascade(
    graphData.image_url || undefined,
    IMG.hero(graphData.image_query ?? graphData.title, 99),
  );

  const copyAll = () => {
    navigator.clipboard.writeText(buildDossierText(graphData)).then(() => {
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1400);
    });
  };

  const meta = graphData.meta ?? {};

  return (
    <aside
      className={`${styles.panel} ${open ? '' : styles.panelClosed}`}
      style={{ '--c': color } as React.CSSProperties}
    >
      <div className={styles.scroll}>
        <div className={styles.hero} onClick={onHeroClick}>
          {img.src ? (
            <img className={styles.heroImg} src={img.src} alt={graphData.title} onError={img.onError} />
          ) : (
            <Monogram title={graphData.title} color={color} size={42} />
          )}
          <div className={styles.heroScrim} />
          <div className={styles.typeBadge}>
            <span className={styles.typeDot} />
            {(graphData.type ?? 'unknown').toUpperCase()}
          </div>
        </div>

        <div className={styles.title}>{graphData.title}</div>
        {graphData.subtitle && <div className={styles.subtitle}>{graphData.subtitle}</div>}

        {graphData.summary && (
          <>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>{t('dossier.summary')}</span>
              <span className={styles.sectionRule} />
              <button className={styles.sectionCopy} onClick={copyAll}>
                {copiedAll ? t('dossier.copied') : t('dossier.copyAll')}
              </button>
            </div>
            <p className={styles.summary}>{graphData.summary}</p>
          </>
        )}

        {Object.keys(meta).length > 0 && (
          <>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>{t('dossier.metadata')}</span>
              <span className={styles.sectionRule} />
            </div>
            <MetaList meta={meta} color={color} />
          </>
        )}

        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>{t('dossier.connections')}</span>
          <span className={styles.sectionRule} />
        </div>
        {graphData.graph.map((cat, i) => (
          <CategorySection key={i} category={cat} defaultOpen={i === 0} />
        ))}
      </div>
    </aside>
  );
}
