import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, X } from 'lucide-react';
import { safeHttpsUrl } from '../../../domain/Scene';
import { useI18n } from '../../../i18n/I18nContext';
import { useModalDialog } from '../../hooks/useModalDialog';
import styles from './ImageViewer.module.css';

interface ImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/** The uncropped look at a scene's image: escape, backdrop, or the close button. */
export function ImageViewer({ src, alt, onClose }: ImageViewerProps): ReactElement {
  const { t } = useI18n();
  const { ref, dialogProps, titleId } = useModalDialog<HTMLDivElement>({ onClose, initialFocus: '[data-autofocus]' });

  // Validated again here because this is the one place the URL also becomes a
  // navigation target; an <img src> that fails is a broken picture, an <a href>
  // that is not https is a different kind of problem.
  const original = safeHttpsUrl(src);

  return createPortal(
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div ref={ref} {...dialogProps} className={styles.panel} aria-labelledby={titleId}>
        <img className={styles.image} src={src} alt={alt} decoding="async" />
        <div className={styles.bar}>
          <span id={titleId} className={styles.caption}>{alt}</span>
          {original ? (
            <a className={styles.link} href={original} target="_blank" rel="noopener noreferrer">
              {t('image.openOriginal')}
              <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ) : null}
          <button
            type="button"
            data-autofocus=""
            className={styles.close}
            onClick={onClose}
            aria-label={t('image.close')}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
