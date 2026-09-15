import type { CSSProperties } from 'react';
import type { Scene } from '../../../domain/Scene';
import { typeColor } from '../../../domain/typeColors';
import { IMG } from '../../../infrastructure/image';
import { useImageCascade } from '../../hooks/useImageCascade';
import { Monogram } from '../shared/Monogram';
import styles from './HeroCard.module.css';

interface HeroCardProps {
  scene: Scene;
  onClick: () => void;
}

export function HeroCard({ scene, onClick }: HeroCardProps) {
  const color = typeColor(scene.type);
  const { primary, secondary } = scene.presentation.palette;
  const img = useImageCascade(scene.image_url || undefined, IMG.hero(scene.image_query || scene.title, 99));

  return (
    <div
      className={styles.hero}
      style={{ '--c': color, '--p': primary, '--s': secondary } as CSSProperties}
      onClick={onClick}
    >
      {img.src && <img className={styles.image} src={img.src} alt={scene.title} onError={img.onError} />}
      {/* In-flow spacer: keeps the glyph zone above the title, however long the title wraps. */}
      <div className={styles.figure}>
        {!img.src && <Monogram title={scene.title} color={color} size={48} />}
      </div>
      <div className={styles.scrim} />
      <div className={styles.badge}>
        <span className={styles.badgeDot} />
        {scene.type.toUpperCase()}
      </div>
      <div className={styles.titleBlock}>
        <div className={styles.title}>{scene.title}</div>
        {scene.subtitle && <div className={styles.subtitle}>{scene.subtitle}</div>}
      </div>
      <div className={styles.band} />
    </div>
  );
}
