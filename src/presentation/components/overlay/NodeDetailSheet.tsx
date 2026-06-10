import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { GraphCategory } from '../../../domain/GraphData';
import { CYAN } from '../../../infrastructure/constants';
import { IMG } from '../../../infrastructure/image';
import { useI18n } from '../../../i18n/I18nContext';
import { useImageCascade } from '../../hooks/useImageCascade';
import { copyCategoryText } from '../dossier/CategorySection';
import styles from './NodeDetailSheet.module.css';

interface NodeDetailSheetProps {
  category: GraphCategory;
  onClose: () => void;
}

/** Category info access while in immersive mode (no dossier panel). */
export function NodeDetailSheet({ category, onClose }: NodeDetailSheetProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const color = category.color || CYAN;
  const img = useImageCascade(
    undefined,
    category.image_query ? IMG.category(category.image_query) : null,
  );

  const copy = () => {
    navigator.clipboard.writeText(copyCategoryText(category)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    });
  };

  return createPortal(
    <div
      className={styles.sheet}
      style={{ '--c': color } as React.CSSProperties}
      onClick={e => e.stopPropagation()}
    >
      <div className={styles.header}>
        {img.src && <img className={styles.image} src={img.src} alt="" onError={img.onError} />}
        <span className={styles.name}>{category.category}</span>
        <span className={styles.count}>
          {String(category.facts.length).padStart(2, '0')} {t('sheet.facts')}
        </span>
        <button className={styles.copyBtn} onClick={copy}>
          {copied ? t('dossier.copied') : t('dossier.copy')}
        </button>
        <button className={styles.closeBtn} onClick={onClose} aria-label={t('lightbox.close')}>
          <X size={10} />
        </button>
      </div>
      <div className={styles.facts}>
        {category.facts.map((fact, i) => (
          <div key={i} className={styles.fact}>
            <span className={styles.factIndex}>{String(i + 1).padStart(2, '0')}</span>
            <span>{fact}</span>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
