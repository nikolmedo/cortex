import type { FactKind } from '../../../domain/Scene';
import { IMG } from '../../../infrastructure/image';
import { useImageCascade } from '../../hooks/useImageCascade';
import { Monogram } from '../shared/Monogram';
import { KIND_ICON } from '../shared/kindIcons';
import styles from './CategoryNode.module.css';

interface CategoryNodeProps {
  color: string;
  label: string;
  headline?: string;
  kind: FactKind;
  imageQuery?: string;
  factCount: number;
  focused: boolean;
  onClick: () => void;
}

export function CategoryNode({
  color,
  label,
  headline,
  kind,
  imageQuery,
  factCount,
  focused,
  onClick,
}: CategoryNodeProps) {
  const img = useImageCascade(undefined, imageQuery ? IMG.category(imageQuery) : null);
  const Glyph = KIND_ICON[kind];

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
        <Glyph className={styles.glyph} size={11} strokeWidth={1.75} aria-hidden />
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
        {headline ? <div className={styles.headline}>{headline}</div> : null}
        <div className={styles.count}>{factCount}</div>
      </div>
    </div>
  );
}
