import type { CSSProperties, ReactElement } from 'react';
import { isHex, type SceneModule } from '../../../domain/Scene';
import { useI18n } from '../../../i18n/I18nContext';
import { moduleReveal } from './items';
import { KIND_ICON, kindLabelKey } from './kindIcons';
import { MODULE_RENDERERS } from './registry';
import styles from './ModuleCard.module.css';

interface ModuleCardProps {
  module: SceneModule;
  /** Hide the card title (the surrounding control already shows it, e.g. split tabs). */
  bare?: boolean;
}

export function ModuleCard({ module, bare = false }: ModuleCardProps): ReactElement {
  const { t } = useI18n();
  const Icon = KIND_ICON[module.kind];
  const Renderer = MODULE_RENDERERS[module.kind] ?? MODULE_RENDERERS.list;
  const color = isHex(module.color) ? module.color : undefined;
  const kindLabel = t(kindLabelKey(module.kind));

  return (
    <section
      className={styles.card}
      data-kind={module.kind}
      // Directives reach CSS only as these three attributes; each stylesheet rule
      // that reads one is scoped to the card, never to a bare [data-kind].
      data-emphasis={module.emphasis ?? 'normal'}
      data-tone={module.tone ?? 'neutral'}
      // Not `data-motion`: that attribute is the app-wide reduced-motion switch
      // on :root, and a second meaning on the card is a collision waiting to happen.
      data-enter={moduleReveal(module) ?? 'rise'}
      style={color ? ({ '--m': color } as CSSProperties) : undefined}
      aria-label={module.category || kindLabel}
    >
      {!bare || module.headline ? (
        <header className={styles.head}>
          {!bare ? (
            <span className={styles.icon} title={kindLabel}>
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
          ) : null}
          <div className={styles.titles}>
            {!bare ? <h3 className={styles.title}>{module.category || kindLabel}</h3> : null}
            {module.headline ? <p className={styles.headline}>{module.headline}</p> : null}
          </div>
        </header>
      ) : null}
      <div className={styles.body}>
        <Renderer module={module} />
      </div>
    </section>
  );
}
