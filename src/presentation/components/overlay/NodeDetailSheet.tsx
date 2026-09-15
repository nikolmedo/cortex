import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { categoryKind, type SceneCategory } from '../../../domain/Scene';
import { CYAN } from '../../../infrastructure/constants';
import { IMG } from '../../../infrastructure/image';
import { useI18n } from '../../../i18n/I18nContext';
import { useImageCascade } from '../../hooks/useImageCascade';
import { copyCategoryText } from '../dossier/CategorySection';
import { categoryItems, FactBlock } from '../facts';
import { KIND_ICON, kindLabelKey } from '../shared/kindIcons';
import styles from './NodeDetailSheet.module.css';

interface NodeDetailSheetProps {
  category: SceneCategory;
  onClose: () => void;
}

/** Category info access while in immersive mode (no dossier panel). */
export function NodeDetailSheet({ category, onClose }: NodeDetailSheetProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const color = category.color || CYAN;
  const kind = categoryKind(category);
  const KindIcon = KIND_ICON[kind];
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
      style={{ '--c': color } as CSSProperties}
      onClick={e => e.stopPropagation()}
    >
      <div className={styles.header}>
        {img.src && <img className={styles.image} src={img.src} alt="" onError={img.onError} />}
        <span className={styles.titles}>
          <span className={styles.name}>{category.category}</span>
          <span className={styles.kind}>
            <KindIcon size={10} strokeWidth={1.75} aria-hidden="true" />
            {t(kindLabelKey(kind))}
            <span className={styles.count}>
              · {String(categoryItems(category).length).padStart(2, '0')} {t('sheet.facts')}
            </span>
          </span>
        </span>
        <button className={styles.copyBtn} onClick={copy}>
          {copied ? t('dossier.copied') : t('dossier.copy')}
        </button>
        <button className={styles.closeBtn} onClick={onClose} aria-label={t('lightbox.close')}>
          <X size={10} />
        </button>
      </div>
      {category.headline && <p className={styles.headline}>{category.headline}</p>}
      <div className={styles.facts}>
        <FactBlock category={category} variant="panel" color={color} />
      </div>
    </div>,
    document.body,
  );
}
