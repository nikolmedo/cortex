import styles from './QueryHistory.module.css';

interface QueryHistoryProps {
  history: string[];
  onSelect: (query: string) => void;
  /** 'dock' pins chips top-right (graph view); 'inline' renders them in flow (input view). */
  variant?: 'dock' | 'inline';
  hidden?: boolean;
}

export function QueryHistory({ history, onSelect, variant = 'dock', hidden = false }: QueryHistoryProps) {
  if (!history.length) return null;

  const chips = history.slice(0, 4).map((q, i) => (
    <button key={i} className={styles.chip} onClick={() => onSelect(q)}>
      {q}
    </button>
  ));

  if (variant === 'inline') return <>{chips}</>;

  return (
    <div className={`${styles.dockRight} ${hidden ? styles.dockHidden : ''}`}>{chips}</div>
  );
}
