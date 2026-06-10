import { CYAN } from '../../../infrastructure/constants';
import { IMG } from '../../../infrastructure/image';
import { useImageCascade } from '../../hooks/useImageCascade';
import { Monogram } from '../shared/Monogram';
import styles from './CenterNode.module.css';

interface CenterNodeProps {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  imageQuery?: string;
  onImageClick: () => void;
}

export function CenterNode({ title, subtitle, imageUrl, imageQuery, onImageClick }: CenterNodeProps) {
  const img = useImageCascade(imageUrl || undefined, IMG.node(imageQuery ?? title, 99));

  return (
    <div className={styles.root}>
      <div className={`${styles.ringOuter} center-pulse-2`} />
      <div className={`${styles.ringInner} center-pulse-1`} />
      <div
        className={styles.imageWrap}
        onClick={e => {
          e.stopPropagation();
          onImageClick();
        }}
      >
        {img.src ? (
          <img className={styles.image} src={img.src} alt={title} onError={img.onError} />
        ) : (
          <Monogram title={title} color={CYAN} size={34} />
        )}
      </div>
      <div className={styles.title}>{title}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>
  );
}
