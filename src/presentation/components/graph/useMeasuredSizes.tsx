import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import type { Scene } from '../../../domain/Scene';
import { categoryKind } from '../../../domain/Scene';
import { CENTER_H, fontsReady, ROLE_W } from '../../../layout/measure';
import type { GraphSpec } from '../../../layout/sceneNodes';
import type { NodeSize, NodeSizes } from '../../../layout/types';
import { NodeContent, type NodeHandlers } from './nodeContent';

interface Measured {
  scene: Scene;
  sizes: NodeSizes;
}

const NOOP_HANDLERS: NodeHandlers = {
  onCategoryClick: () => undefined,
  onCenterImageClick: () => undefined,
};

/**
 * Renders every variable-height node offscreen (inside the stage container,
 * hidden, at its role width) and reads the real layout boxes once the web
 * fonts are ready. The center node is fixed-size and skipped.
 *
 * Returns the sizes for `scene` (null until measured) and the probe element
 * the caller must mount inside the container while sizes are null.
 */
export function useMeasuredSizes(scene: Scene, spec: GraphSpec): { sizes: NodeSizes | null; probe: ReactElement | null } {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [measured, setMeasured] = useState<Measured | null>(null);
  const probeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    fontsReady().then(() => alive && setFontsLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const sizes = measured?.scene === scene ? measured.sizes : null;

  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe || sizes) return;
    const map = new Map<string, NodeSize>([['center', { w: ROLE_W.center, h: CENTER_H }]]);
    // offsetWidth/offsetHeight ignore ancestor transforms; the stage container
    // is still playing its scale-in animation when the first measurement runs.
    for (const el of probe.children) {
      const node = el as HTMLElement;
      const id = node.dataset.nodeId;
      if (!id) continue;
      map.set(id, { w: node.offsetWidth, h: node.offsetHeight });
    }
    setMeasured({ scene, sizes: map });
  }, [scene, sizes, fontsLoaded]);

  if (!fontsLoaded || sizes) return { sizes, probe: null };

  const probe = (
    <div
      ref={probeRef}
      aria-hidden
      style={{ position: 'absolute', left: 0, top: 0, visibility: 'hidden', pointerEvents: 'none' }}
    >
      {spec.nodes
        .filter(n => n.kind !== 'center')
        .map(n => {
          // A tag chip is as wide as its text; every other role has a fixed width.
          const chip = n.kind === 'fact' && categoryKind(scene.graph[n.catIndex]) === 'tags';
          return (
            <div
              key={n.id}
              data-node-id={n.id}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: chip ? 'max-content' : ROLE_W[n.kind],
                maxWidth: ROLE_W[n.kind],
                display: n.kind === 'category' ? 'flex' : 'block',
                justifyContent: 'center',
              }}
            >
              <NodeContent node={n} scene={scene} focusedCat={null} measuring {...NOOP_HANDLERS} />
            </div>
          );
        })}
    </div>
  );

  return { sizes: null, probe };
}
