import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import type { GraphCategory } from '../../../domain/GraphData';
import { CYAN } from '../../../infrastructure/constants';
import { IMG } from '../../../infrastructure/image';
import { useImageCascade } from '../../hooks/useImageCascade';
import styles from './CategorySection.module.css';

interface CategorySectionProps {
  category: GraphCategory;
  defaultOpen?: boolean;
  /** Stagger delay in seconds for the entrance animation (mobile list). */
  revealDelay?: number;
  /** Optional 40px image in the header (mobile accordion variant). */
  showImage?: boolean;
}

export function copyCategoryText(category: GraphCategory): string {
  return `${category.category}\n${category.facts.map((f, i) => `${i + 1}. ${f}`).join('\n')}`;
}

export function CategorySection({
  category,
  defaultOpen = false,
  revealDelay,
  showImage = false,
}: CategorySectionProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const color = category.color || CYAN;
  const img = useImageCascade(
    undefined,
    showImage && category.image_query ? IMG.category(category.image_query) : null,
  );

  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(copyCategoryText(category)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <div
      className={styles.section}
      style={{
        '--c': color,
        ...(revealDelay != null
          ? { animation: `fadeInUp 0.45s var(--ease-out-expo) ${revealDelay}s both` }
          : {}),
      } as React.CSSProperties}
    >
      <button className={styles.header} onClick={() => setOpen(o => !o)}>
        {showImage && img.src ? (
          <img className={styles.headerImage} src={img.src} alt="" onError={img.onError} />
        ) : (
          <span className={styles.dot} />
        )}
        <span className={styles.name}>{category.category}</span>
        <span className={styles.count}>{String(category.facts.length).padStart(2, '0')}</span>
        <span className={styles.copyBtn} onClick={copy} role="button">
          {copied ? t('dossier.copied') : t('dossier.copy')}
        </span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
          <ChevronRight size={12} />
        </span>
      </button>
      <div className={`${styles.facts} ${open ? styles.factsOpen : ''}`}>
        {category.facts.map((fact, i) => (
          <div key={i} className={styles.fact}>
            <span className={styles.factIndex}>{String(i + 1).padStart(2, '0')}</span>
            <span>{fact}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
