import styles from './Monogram.module.css';

interface MonogramProps {
  title: string;
  color: string;
  /** Font size of the initials in px. */
  size?: number;
}

export function initialsOf(title: string): string {
  return title
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Attractive on-brand fallback when every image source fails. */
export function Monogram({ title, color, size = 24 }: MonogramProps) {
  return (
    <div className={styles.root}>
      <div
        className={styles.gradient}
        style={{
          background: `conic-gradient(from 0deg, ${color}00, ${color}55, ${color}00 60%)`,
        }}
      />
      <span className={styles.initials} style={{ fontSize: size, color }}>
        {initialsOf(title)}
      </span>
    </div>
  );
}
