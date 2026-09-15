import type { CSSProperties } from 'react';
import type { Scene } from '../../../domain/Scene';
import { useI18n } from '../../../i18n/I18nContext';
import { sceneSignature } from '../../scene/sceneSignature';
import { KIND_ICON, kindLabelKey } from './kindIcons';
import styles from './SceneSignature.module.css';

interface SceneSignatureProps {
  scene: Scene;
  /** Palette swatch bar under the labels (mobile banner). */
  swatches?: boolean;
}

/** Archetype · mood · kind glyphs. Reads the scene, never the raw model text. */
export function SceneSignature({ scene, swatches = false }: SceneSignatureProps) {
  const { t } = useI18n();
  const { archetypeLabelKey, moodLabelKey, kinds } = sceneSignature(scene);
  const { primary, secondary, accent } = scene.presentation.palette;

  return (
    <div className={styles.chip} title={t('topbar.signature')} aria-label={t('topbar.signature')}>
      <span className={styles.label}>{t(archetypeLabelKey)}</span>
      <span className={styles.sep} aria-hidden="true">·</span>
      <span className={styles.label}>{t(moodLabelKey)}</span>
      {kinds.length > 0 && (
        <>
          <span className={styles.sep} aria-hidden="true">·</span>
          <span className={styles.glyphs}>
            {kinds.map((kind, i) => {
              const Icon = KIND_ICON[kind];
              return (
                <span key={`${kind}-${i}`} className={styles.glyph} title={t(kindLabelKey(kind))}>
                  <Icon size={10} strokeWidth={1.75} aria-label={t(kindLabelKey(kind))} />
                </span>
              );
            })}
          </span>
        </>
      )}
      {swatches && (
        <span className={styles.swatches} aria-hidden="true">
          {[primary, secondary, accent].map((hex, i) => (
            <span key={i} className={styles.swatch} style={{ '--sw': hex } as CSSProperties} />
          ))}
        </span>
      )}
    </div>
  );
}
