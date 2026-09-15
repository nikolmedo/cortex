import type { CSSProperties, ReactElement } from 'react';
import type { SceneItem } from '../../../domain/Scene';
import { FactShell } from './FactShell';
import { categoryItems, type FactBlockProps } from './model';
import styles from './kinds.module.css';

/*
 * Kinds that render ONE composite node per category in the graph. They ignore
 * `itemIndex` and always draw the full item set.
 */

function bar(weight: number | undefined, index: number): CSSProperties {
  return { '--w': `${Math.round(weight ?? 0)}%`, '--d': `${0.15 + index * 0.08}s` } as CSSProperties;
}

/** Highest weight in the set, so a ranking without explicit 0-100 scores still reads relatively. */
function maxWeight(items: SceneItem[]): number {
  return Math.max(1, ...items.map(it => it.weight ?? 0));
}

export function TimelineFact({ category, variant, color }: FactBlockProps): ReactElement {
  const items = categoryItems(category);
  return (
    <FactShell kind="timeline" variant={variant} color={color}>
      <ol className={styles.rail}>
        {items.map((item, i) => (
          <li key={i} className={styles.tlRow}>
            {item.value ? <span className={styles.tlDate}>{item.value}</span> : null}
            <p className={styles.text}>{item.label}</p>
            {item.detail ? <p className={styles.detail}>{item.detail}</p> : null}
          </li>
        ))}
      </ol>
    </FactShell>
  );
}

export function ComparisonFact({ category, variant, color }: FactBlockProps): ReactElement {
  const items = categoryItems(category);
  const a = items.filter((it, i) => (it.side ?? (i % 2 === 0 ? 'a' : 'b')) === 'a');
  const b = items.filter((it, i) => (it.side ?? (i % 2 === 0 ? 'a' : 'b')) === 'b');
  const rows = Math.max(a.length, b.length);
  const cell = (item: SceneItem | undefined, sideB: boolean) => (
    <div className={`${styles.cmpCell} ${sideB ? styles.cmpCellB : ''}`}>
      {item ? (
        <>
          {item.value ? <span className={styles.cmpValue}>{item.value}</span> : null}
          <p className={styles.text}>{item.label}</p>
          {item.detail ? <p className={styles.detail}>{item.detail}</p> : null}
        </>
      ) : null}
    </div>
  );

  return (
    <FactShell kind="comparison" variant={variant} color={color}>
      <div className={styles.cmp} style={{ '--rows': rows + 1 } as CSSProperties}>
        <span className={styles.cmpHead}>A</span>
        <div className={styles.cmpDivider} />
        <span className={styles.cmpHeadB}>B</span>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ display: 'contents' }}>
            {cell(a[i], false)}
            {cell(b[i], true)}
          </div>
        ))}
      </div>
    </FactShell>
  );
}

export function RankingFact({ category, variant, color }: FactBlockProps): ReactElement {
  const items = categoryItems(category);
  const top = maxWeight(items);
  return (
    <FactShell kind="ranking" variant={variant} color={color}>
      <ol className={styles.rows}>
        {items.map((item, i) => (
          <li key={i} className={styles.rankRow}>
            <span className={styles.rankNum}>{String(i + 1).padStart(2, '0')}</span>
            <p className={styles.text}>{item.label}</p>
            <span className={styles.rankScore}>{item.value ?? (item.weight != null ? Math.round(item.weight) : '')}</span>
            <div className={styles.rankBar}>
              <div className={styles.fill} style={bar(((item.weight ?? top - i * (top / items.length)) / top) * 100, i)} />
            </div>
          </li>
        ))}
      </ol>
    </FactShell>
  );
}

export function ProgressFact({ category, variant, color }: FactBlockProps): ReactElement {
  const items = categoryItems(category);
  return (
    <FactShell kind="progress" variant={variant} color={color}>
      <div className={styles.rows}>
        {items.map((item, i) => (
          <div key={i} className={styles.progRow}>
            <div className={styles.progHead}>
              <p className={styles.text}>{item.label}</p>
              <span className={styles.progValue}>{item.value ?? `${Math.round(item.weight ?? 0)}%`}</span>
            </div>
            <div className={styles.progTrack}>
              <div className={styles.progFill} style={bar(item.weight, i)} />
            </div>
            {item.detail ? <p className={styles.detail}>{item.detail}</p> : null}
          </div>
        ))}
      </div>
    </FactShell>
  );
}
