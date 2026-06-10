import { IMG } from '../../../infrastructure/image';
import { useImageCascade } from '../../hooks/useImageCascade';
import { Monogram } from '../shared/Monogram';
import styles from './CategoryNode.module.css';

interface CategoryNodeProps {
  color: string;
  label: string;
  imageQuery?: string;
  factCount: number;
  focused: boolean;
  onClick: () => void;
}

export function CategoryNode({ color, label, imageQuery, factCount, focused, onClick }: CategoryNodeProps) {
  const img = useImageCascade(undefined, imageQuery ? IMG.category(imageQuery) : null);

  return (
    <div className={focused ? styles.glow : undefined}>
      <div
        className={`${styles.card} ${focused ? styles.cardFocused : ''}`}
        style={{ '--c': color } as React.CSSProperties}
        onClick={e => {
          e.stopPropagation();
          onClick();
        }}
      >
        <div className={styles.imageWrap}>
          {img.src ? (
            <>
              <img className={styles.image} src={img.src} alt={label} onError={img.onError} />
              <div className={styles.tint} />
            </>
          ) : (
            <Monogram title={label} color={color} size={18} />
          )}
        </div>
        <div className={styles.label}>{label}</div>
        <div className={styles.count}>{factCount}</div>
      </div>
    </div>
  );
}
