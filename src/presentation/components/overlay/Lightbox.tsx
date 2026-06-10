import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../../../i18n/I18nContext';
import { Monogram } from '../shared/Monogram';
import styles from './Lightbox.module.css';

interface LightboxProps {
  src: string | null;
  title: string;
  color: string;
  onClose: () => void;
}

export function Lightbox({ src, title, color, onClose }: LightboxProps) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [onClose]);

  const showImage = src && !failed;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.frame}
        style={{ '--c': color } as React.CSSProperties}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.tl} />
        <div className={styles.tr} />
        <div className={styles.bl} />
        <div className={styles.br} />

        {showImage ? (
          <img className={styles.image} src={src} alt={title} onError={() => setFailed(true)} />
        ) : (
          <div className={styles.monogramBox}>
            <Monogram title={title} color={color} size={64} />
          </div>
        )}

        <div className={styles.caption}>
          <span className={styles.captionText}>{title}</span>
          <button className={styles.closeBtn} onClick={onClose}>
            {t('lightbox.close')} · {t('graph.esc')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
