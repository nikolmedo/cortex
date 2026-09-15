import { useState, type CSSProperties, type MouseEvent } from 'react';
import { ChevronRight } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import { categoryKind, type SceneCategory } from '../../../domain/Scene';
import { CYAN } from '../../../infrastructure/constants';
import { IMG } from '../../../infrastructure/image';
import { useImageCascade } from '../../hooks/useImageCascade';
import { categoryItems, FactBlock } from '../facts';
import { KIND_ICON, kindLabelKey } from '../shared/kindIcons';
import styles from './CategorySection.module.css';

interface CategorySectionProps {
  category: SceneCategory;
  variant: 'panel' | 'mobile';
  defaultOpen?: boolean;
  /** Stagger delay in seconds for the entrance animation (mobile list). */
  revealDelay?: number;
  /** Optional 40px image in the header (mobile accordion variant). */
  showImage?: boolean;
  /** 1-based number for the spine index rail; omitted for other archetypes. */
  railIndex?: number;
}

export function copyCategoryText(category: SceneCategory): string {
  const lines = [category.category];
  if (category.headline) lines.push(category.headline);
  categoryItems(category).forEach((item, i) => {
    const parts = [item.label];
    if (item.value) parts.push(item.value);
    if (item.detail) parts.push(item.detail);
    lines.push(`${i + 1}. ${parts.join(' — ')}`);
  });
  return lines.join('\n');
}

export function CategorySection({
  category,
  variant,
  defaultOpen = false,
  revealDelay,
  showImage = false,
  railIndex,
}: CategorySectionProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const color = category.color || CYAN;
  const kind = categoryKind(category);
  const KindIcon = KIND_ICON[kind];
  const count = categoryItems(category).length;
  const img = useImageCascade(
    undefined,
    showImage && category.image_query ? IMG.category(category.image_query) : null,
  );

  const copy = (e: MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(copyCategoryText(category)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  const style = {
    '--c': color,
    ...(revealDelay != null
      ? { animation: `fadeInUp 0.45s var(--ease-out-expo) ${revealDelay}s both` }
      : {}),
  } as CSSProperties;

  return (
    <div className={styles.section} style={style} data-kind={kind} data-rail={railIndex != null || undefined}>
      {railIndex != null && (
        <span className={styles.rail} aria-hidden="true">
          {String(railIndex).padStart(2, '0')}
        </span>
      )}
      <div className={styles.body}>
        <button className={styles.header} onClick={() => setOpen(o => !o)} aria-expanded={open}>
          {showImage && img.src ? (
            <img className={styles.headerImage} src={img.src} alt="" onError={img.onError} />
          ) : (
            <span className={styles.glyph} title={t(kindLabelKey(kind))}>
              <KindIcon size={11} strokeWidth={1.75} aria-label={t(kindLabelKey(kind))} />
            </span>
          )}
          <span className={styles.titles}>
            <span className={styles.name}>{category.category}</span>
            {category.headline && (
              <span className={styles.headline} title={t('dossier.headline')}>{category.headline}</span>
            )}
          </span>
          <span className={styles.count}>{String(count).padStart(2, '0')}</span>
          <span className={styles.copyBtn} onClick={copy} role="button">
            {copied ? t('dossier.copied') : t('dossier.copy')}
          </span>
          <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>
            <ChevronRight size={12} />
          </span>
        </button>
        <div className={`${styles.facts} ${open ? styles.factsOpen : ''}`}>
          <div className={styles.factsInner}>
            <FactBlock category={category} variant={variant} color={color} />
          </div>
        </div>
      </div>
    </div>
  );
}
