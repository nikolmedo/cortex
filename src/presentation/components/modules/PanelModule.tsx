import type { ReactElement } from 'react';
import type { ItemShape, SceneItem } from '../../../domain/Scene';
import { staggerIndex } from '../../hooks/useCountUp';
import { RichText } from '../text/RichText';
import { Bar, Detail, Figure, Gauge, KvList, TagRow } from './kinds';
import { moduleItems } from './items';
import type { ModuleRendererProps } from './registry';
import styles from './PanelModule.module.css';

/*
 * The one kind the model composes itself. It still writes no markup: each item
 * carries a validated `shape` that picks one of the atoms every other kind
 * already uses, and this file only decides how those atoms sit next to each
 * other. An item with no shape is a note, which is the cheapest thing to mean.
 */

const DEFAULT_SHAPE: ItemShape = 'note';

/**
 * Tags and pairs read as runs rather than as separate cells, so consecutive
 * items of those shapes collapse into one row or one list.
 */
type Group =
  | { kind: 'tag'; items: SceneItem[] }
  | { kind: 'pair'; items: SceneItem[] }
  | { kind: 'single'; item: SceneItem; shape: ItemShape };

function groupItems(items: SceneItem[]): Group[] {
  const groups: Group[] = [];
  for (const item of items) {
    const shape = item.shape ?? DEFAULT_SHAPE;
    if (shape !== 'tag' && shape !== 'pair') {
      groups.push({ kind: 'single', item, shape });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last !== undefined && (last.kind === 'tag' || last.kind === 'pair') && last.kind === shape) {
      last.items.push(item);
    } else {
      groups.push(shape === 'tag' ? { kind: 'tag', items: [item] } : { kind: 'pair', items: [item] });
    }
  }
  return groups;
}

function Part({ item, shape, index }: { item: SceneItem; shape: ItemShape; index: number }): ReactElement {
  if (shape === 'divider') {
    return (
      <div className={styles.divider}>
        {item.label ? <span className={styles.dividerLabel}>{item.label}</span> : null}
      </div>
    );
  }

  if (shape === 'figure') {
    return (
      <div className={styles.cell} data-shape="figure" style={staggerIndex(index)}>
        {item.weight != null ? <Gauge weight={item.weight} /> : null}
        <div className={styles.cellText}>
          {item.value ? <Figure value={item.value} /> : null}
          <span className={styles.caption}>{item.label}</span>
          <Detail text={item.detail} />
        </div>
      </div>
    );
  }

  if (shape === 'bar') {
    return (
      <div className={styles.cell} data-shape="bar" style={staggerIndex(index)}>
        <div className={styles.barHead}>
          <span className={styles.caption}>{item.label}</span>
          <span className={styles.barValue}>
            {item.value ?? (item.weight != null ? `${Math.round(item.weight)}%` : '')}
          </span>
        </div>
        <Bar value={(item.weight ?? 0) / 100} />
        <Detail text={item.detail} />
      </div>
    );
  }

  return (
    <div className={styles.cell} data-shape="note" style={staggerIndex(index)}>
      <span className={styles.noteLabel}><RichText text={item.label} /></span>
      <Detail text={item.detail} />
    </div>
  );
}

export function PanelModule({ module }: ModuleRendererProps): ReactElement {
  const groups = groupItems(moduleItems(module));
  // Only the parts that animate consume a stagger slot, so a divider between
  // two figures does not leave a gap in the cascade.
  let slot = 0;
  return (
    <div className={styles.panel}>
      {groups.map((group, i) => {
        if (group.kind === 'tag') return <div key={i} className={styles.full}><TagRow items={group.items} /></div>;
        if (group.kind === 'pair') return <div key={i} className={styles.full}><KvList items={group.items} /></div>;
        const index = group.shape === 'divider' ? slot : slot++;
        return <Part key={i} item={group.item} shape={group.shape} index={index} />;
      })}
    </div>
  );
}
