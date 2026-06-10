import type { GraphData } from '../../../domain/GraphData';
import { typeColor } from '../../../domain/typeColors';
import { IMG } from '../../../infrastructure/image';
import { useImageCascade } from '../../hooks/useImageCascade';
import { Monogram } from '../shared/Monogram';
import styles from './HeroCard.module.css';

interface HeroCardProps {
  graphData: GraphData;
  onClick: () => void;
}

export function HeroCard({ graphData, onClick }: HeroCardProps) {
  const color = typeColor(graphData.type);
  const img = useImageCascade(
    graphData.image_url || undefined,
    IMG.hero(graphData.image_query ?? graphData.title, 99),
  );

  return (
    <div
      className={styles.hero}
      style={{ '--c': color } as React.CSSProperties}
      onClick={onClick}
    >
      {img.src ? (
        <img className={styles.image} src={img.src} alt={graphData.title} onError={img.onError} />
      ) : (
        <Monogram title={graphData.title} color={color} size={48} />
      )}
      <div className={styles.scrim} />
      <div className={styles.badge}>
        <span className={styles.badgeDot} />
        {(graphData.type ?? 'unknown').toUpperCase()}
      </div>
      <div className={styles.titleBlock}>
        <div className={styles.title}>{graphData.title}</div>
        {graphData.subtitle && <div className={styles.subtitle}>{graphData.subtitle}</div>}
      </div>
    </div>
  );
}
