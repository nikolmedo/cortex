import { useEffect, useMemo, useRef } from 'react';
import type { Scene } from '../../../domain/Scene';
import type { ViewRect, ViewTransform } from '../../../layout/fitView';
import { floatOffset } from '../../../layout/float';
import { categoryBBox, computeForceLayout } from '../../../layout/forceLayout';
import { floatAmplitude } from '../../../layout/sceneMetrics';
import { buildGraphSpec } from '../../../layout/sceneNodes';
import type { LayoutNode } from '../../../layout/types';
import { usePanZoom } from '../../hooks/usePanZoom';
import { choreograph } from '../../scene/choreography';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { EdgeLayer } from './EdgeLayer';
import { NodeContent } from './nodeContent';
import { NodeDiv } from './NodeDiv';
import { useMeasuredSizes } from './useMeasuredSizes';

interface GraphStageProps {
  scene: Scene;
  viewRect: ViewRect;
  focusedCat: number | null;
  onCategoryClick: (index: number) => void;
  onBackgroundClick: () => void;
  onCenterImageClick: () => void;
  onSpotlightClick?: () => void;
  /** Exposes the live pan/zoom transform (e.g. for particle parallax). */
  onTransformRef?: (ref: React.RefObject<ViewTransform>) => void;
}

/** Focus mode: everything outside the focused category recedes. */
function focusOpacity(node: LayoutNode, focusedCat: number | null): number {
  if (focusedCat == null) return 1;
  switch (node.kind) {
    case 'center':
      return 0.25;
    case 'spotlight':
      return 0.2;
    case 'category':
      return node.catIndex === focusedCat ? 1 : 0.3;
    default:
      return node.catIndex === focusedCat ? 1 : 0.12;
  }
}

export function GraphStage({
  scene,
  viewRect,
  focusedCat,
  onCategoryClick,
  onBackgroundClick,
  onCenterImageClick,
  onSpotlightClick,
  onTransformRef,
}: GraphStageProps) {
  const nodeEls = useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = useRef<number | null>(null);
  const didInitialFit = useRef(false);
  const downPos = useRef<{ x: number; y: number } | null>(null);
  const reducedMotion = useReducedMotion();

  const { containerRef, stageRef, transformRef, zoomToFit } = usePanZoom();

  useEffect(() => {
    onTransformRef?.(transformRef);
  }, [onTransformRef, transformRef]);

  const spec = useMemo(() => buildGraphSpec(scene), [scene]);
  const { sizes, probe } = useMeasuredSizes(scene, spec);

  const layout = useMemo(() => (sizes ? computeForceLayout(scene, sizes) : null), [scene, sizes]);
  const choreography = useMemo(
    () => (layout ? choreograph(layout, scene.presentation.mood) : null),
    [layout, scene.presentation.mood],
  );

  // Camera: fit the whole graph, or the focused category subtree.
  useEffect(() => {
    if (!layout) return;
    const bbox = focusedCat != null ? categoryBBox(layout, focusedCat) : layout.bbox;
    zoomToFit(bbox, viewRect, didInitialFit.current);
    didInitialFit.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, focusedCat, viewRect.left, viewRect.top, viewRect.width, viewRect.height, zoomToFit]);

  // Organic float drift on top of the settled layout (amplitude < collision padding).
  useEffect(() => {
    if (!layout || reducedMotion) return;
    const amp = floatAmplitude(scene.presentation.mood, scene.presentation.density);
    const keys = layout.nodes.map(n => n.id);
    const tick = (t: number) => {
      rafRef.current = requestAnimationFrame(tick);
      keys.forEach((key, k) => {
        const el = nodeEls.current[key];
        if (el) {
          const { dx, dy } = floatOffset(k, t, amp);
          el.style.translate = `${dx}px ${dy}px`;
        }
      });
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Switching to reduced motion mid-scene must not freeze nodes mid-drift.
      for (const key of keys) {
        const el = nodeEls.current[key];
        if (el) el.style.translate = '';
      }
    };
  }, [layout, reducedMotion, scene.presentation.mood, scene.presentation.density]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5,
        touchAction: 'none',
        cursor: 'grab',
        animation: 'graphStageIn 0.5s cubic-bezier(0.16,1,0.3,1) both',
      }}
      onPointerDown={e => {
        downPos.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={e => {
        const d = downPos.current;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) onBackgroundClick();
      }}
      onDoubleClick={e => {
        // Double-click on selectable text selects a word; don't refit the view.
        if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
        onBackgroundClick();
        if (layout) zoomToFit(layout.bbox, viewRect, true);
      }}
    >
      {probe}

      {layout && choreography && (
        <div
          ref={stageRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 0,
            height: 0,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
        >
          <EdgeLayer layout={layout} focusedCat={focusedCat} choreography={choreography} />

          {layout.nodes.map(n => {
            const opacity = focusOpacity(n, focusedCat);
            const isLeaf = n.kind === 'fact' || n.kind === 'block';
            // Dim opacity lives on the OUTER wrapper and the spawn animation on
            // an INNER one: a fill-mode animation would otherwise hold opacity
            // at 1 forever and break focus dimming.
            const style: React.CSSProperties = {
              position: 'absolute',
              left: n.x - n.w / 2,
              top: n.y - n.h / 2,
              width: n.w,
              transition: 'opacity 0.4s ease',
              opacity,
              zIndex: n.kind === 'category' ? (focusedCat === n.catIndex ? 4 : 2) : 3,
              pointerEvents: isLeaf && opacity < 1 ? 'none' : 'auto',
            };

            return (
              <NodeDiv key={n.id} nodeKey={n.id} nodeEls={nodeEls} style={style}>
                <div
                  className="node-spawn"
                  style={{
                    animationDelay: `${(choreography.delays.get(n.id) ?? 0).toFixed(3)}s`,
                    display: n.kind === 'category' ? 'flex' : 'block',
                    justifyContent: 'center',
                  }}
                >
                  <NodeContent
                    node={n}
                    scene={scene}
                    focusedCat={focusedCat}
                    onCategoryClick={onCategoryClick}
                    onCenterImageClick={onCenterImageClick}
                    onSpotlightClick={onSpotlightClick}
                  />
                </div>
              </NodeDiv>
            );
          })}
        </div>
      )}
    </div>
  );
}
