import type { CSSProperties, ReactElement } from 'react';
import type { SceneItem } from '../../../domain/Scene';
import { FactShell } from './FactShell';
import { categoryItems, type FactBlockProps } from './model';
import styles from './kinds.module.css';

/*
 * Kinds that render one node per item in the graph. Each renderer draws a
 * single item when `itemIndex` is given and the whole category otherwise
 * (dossier panel, mobile).
 */

function ordinal(i: number): string {
  return String(i + 1).padStart(2, '0');
}

function pct(weight: number | undefined): CSSProperties {
  return { '--w': `${Math.round(weight ?? 0)}%` } as CSSProperties;
}

interface ItemViewProps {
  item: SceneItem;
  index: number;
}

function ListItem({ item, index }: ItemViewProps) {
  return (
    <div className={styles.listItem}>
      <span className={styles.ordinal}>{ordinal(index)}</span>
      <p className={styles.text}>
        {item.label}
        {item.value ? <span className={styles.detail}> {item.value}</span> : null}
      </p>
      {item.detail ? <p className={styles.detail}>{item.detail}</p> : null}
    </div>
  );
}

function ListAll({ items }: { items: SceneItem[] }) {
  return (
    <ol className={styles.rows}>
      {items.map((item, i) => (
        <li key={i} className={styles.listRow}>
          <span className={styles.ordinal}>{ordinal(i)}</span>
          <div>
            <p className={styles.text}>{item.label}</p>
            {item.detail ? <p className={styles.detail}>{item.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StatItem({ item, index }: ItemViewProps) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue}>{item.value ?? ordinal(index)}</span>
      <span className={styles.statLabel}>{item.label}</span>
      {item.detail ? <p className={styles.detail}>{item.detail}</p> : null}
      {item.weight != null ? (
        <div className={styles.track}>
          <div className={styles.fill} style={pct(item.weight)} />
        </div>
      ) : null}
    </div>
  );
}

function QuoteItem({ item }: ItemViewProps) {
  return (
    <blockquote className={styles.quote}>
      <p className={styles.text}>{item.label}</p>
      {item.detail || item.value ? <div className={styles.cite}>{item.detail ?? item.value}</div> : null}
    </blockquote>
  );
}

function KeyValueItem({ item }: ItemViewProps) {
  return (
    <div className={styles.kv}>
      <span className={styles.kvKey}>{item.label}</span>
      <span className={styles.kvValue}>{item.value ?? item.detail ?? ''}</span>
      {item.value && item.detail ? <p className={styles.detail}>{item.detail}</p> : null}
    </div>
  );
}

function TagChip({ item }: ItemViewProps) {
  return (
    <span className={styles.chip} title={item.detail}>
      {item.label}
      {item.value ? <span className={styles.chipValue}>{item.value}</span> : null}
    </span>
  );
}

interface KindSpec {
  Item: (props: ItemViewProps) => ReactElement;
  /** Container class when every item renders together (panel/mobile). */
  groupClass: string;
  Group?: (props: { items: SceneItem[] }) => ReactElement;
}

const KINDS = {
  list: { Item: ListItem, groupClass: styles.rows, Group: ListAll },
  stats: { Item: StatItem, groupClass: styles.statGrid },
  quote: { Item: QuoteItem, groupClass: styles.rows },
  keyvalue: { Item: KeyValueItem, groupClass: styles.kvGrid },
  tags: { Item: TagChip, groupClass: styles.chips },
} satisfies Record<string, KindSpec>;

type PerItemKind = keyof typeof KINDS;

export function perItemRenderer(kind: PerItemKind) {
  const { Item, groupClass, Group } = KINDS[kind] as KindSpec;
  return function PerItemFact({ category, variant, color, itemIndex }: FactBlockProps): ReactElement | null {
    const items = categoryItems(category);

    if (itemIndex != null) {
      const item = items[itemIndex];
      if (!item) return null;
      return (
        <FactShell kind={kind} variant={variant} color={color}>
          <Item item={item} index={itemIndex} />
        </FactShell>
      );
    }

    return (
      <FactShell kind={kind} variant={variant} color={color}>
        {Group ? (
          <Group items={items} />
        ) : (
          <div className={groupClass}>
            {items.map((item, i) => (
              <Item key={i} item={item} index={i} />
            ))}
          </div>
        )}
      </FactShell>
    );
  };
}
