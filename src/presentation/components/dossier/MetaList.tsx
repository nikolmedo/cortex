import styles from './MetaList.module.css';

interface MetaListProps {
  meta: Record<string, string>;
  color: string;
}

export function MetaList({ meta, color }: MetaListProps) {
  return (
    <div style={{ '--c': color } as React.CSSProperties}>
      {Object.entries(meta).map(([key, value]) => (
        <div key={key} className={styles.row}>
          <span className={styles.key}>{key}</span>
          <span className={styles.value}>{value}</span>
        </div>
      ))}
    </div>
  );
}
