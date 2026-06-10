import styles from './FactCard.module.css';

interface FactCardProps {
  color: string;
  index: number;
  text: string;
}

export function FactCard({ color, index, text }: FactCardProps) {
  return (
    <div
      className={styles.card}
      style={{ '--c': color } as React.CSSProperties}
      data-no-pan
      onClick={e => e.stopPropagation()}
    >
      <div className={styles.index}>{String(index + 1).padStart(2, '0')}</div>
      <div className={styles.text}>{text}</div>
    </div>
  );
}
