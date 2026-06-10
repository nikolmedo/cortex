import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphData } from '../../../domain/GraphData';
import type { ViewRect, ViewTransform } from '../../../layout/fitView';
import { floatOffset } from '../../../layout/float';
import { categoryBBox, computeForceLayout } from '../../../layout/forceLayout';
import { fontsReady } from '../../../layout/measure';
import { usePanZoom } from '../../hooks/usePanZoom';
import { CategoryNode } from './CategoryNode';
import { CenterNode } from './CenterNode';
import { EdgeLayer } from './EdgeLayer';
import { FactCard } from './FactCard';
import { NodeDiv } from './NodeDiv';

interface GraphStageProps {
  graphData: GraphData;
  viewRect: ViewRect;
  focusedCat: number | null;
  onCategoryClick: (index: number) => void;
  onBackgroundClick: () => void;
  onCenterImageClick: () => void;
  /** Exposes the live pan/zoom transform (e.g. for particle parallax). */
  onTransformRef?: (ref: React.RefObject<ViewTransform>) => void;
}

export function GraphStage({
  graphData,
  viewRect,
  focusedCat,
  onCategoryClick,
  onBackgroundClick,
  onCenterImageClick,
  onTransformRef,
}: GraphStageProps) {
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const nodeEls = useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = useRef<number | null>(null);
  const didInitialFit = useRef(false);
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const { containerRef, stageRef, transformRef, zoomToFit } = usePanZoom();

  useEffect(() => {
    let alive = true;
    fontsReady().then(() => alive && setFontsLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    onTransformRef?.(transformRef);
  }, [onTransformRef, transformRef]);

  const layout = useMemo(
    () => (fontsLoaded ? computeForceLayout(graphData) : null),
    [graphData, fontsLoaded],
  );

  // Camera: fit the whole constellation, or the focused category subtree.
  useEffect(() => {
    if (!layout) return;
    const bbox = focusedCat != null ? categoryBBox(layout, focusedCat) : layout.bbox;
    zoomToFit(bbox, viewRect, didInitialFit.current);
    didInitialFit.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, focusedCat, viewRect.left, viewRect.top, viewRect.width, viewRect.height, zoomToFit]);

  // Organic float drift on top of the settled layout (amplitude < collision padding).
  useEffect(() => {
    if (!layout) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const keys = layout.nodes.map(n => n.id);
    const tick = (t: number) => {
      rafRef.current = requestAnimationFrame(tick);
      keys.forEach((key, k) => {
        const el = nodeEls.current[key];
        if (el) {
          const { dx, dy } = floatOffset(k, t);
          el.style.translate = `${dx}px ${dy}px`;
        }
      });
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [layout]);

  if (!layout) return null;

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
        zoomToFit(layout.bbox, viewRect, true);
      }}
    >
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
        <EdgeLayer layout={layout} focusedCat={focusedCat} />

        {layout.nodes.map(n => {
          const isDimmed = focusedCat != null && n.catIndex !== focusedCat;
          // Dim opacity lives on the OUTER wrapper and the spawn animation on
          // an INNER one: a fill-mode animation would otherwise hold opacity
          // at 1 forever and break focus dimming.
          const baseStyle: React.CSSProperties = {
            position: 'absolute',
            left: n.x - n.w / 2,
            top: n.y - n.h / 2,
            width: n.w,
            transition: 'opacity 0.4s ease',
          };

          let content: React.ReactNode;
          let style: React.CSSProperties;
          let delay: string;

          if (n.kind === 'center') {
            style = { ...baseStyle, zIndex: 3, opacity: focusedCat != null ? 0.25 : 1 };
            delay = '0.15s';
            content = (
              <CenterNode
                title={graphData.title}
                subtitle={graphData.subtitle}
                imageUrl={graphData.image_url}
                imageQuery={graphData.image_query}
                onImageClick={onCenterImageClick}
              />
            );
          } else if (n.kind === 'category') {
            const cat = graphData.graph[n.catIndex];
            style = {
              ...baseStyle,
              zIndex: focusedCat === n.catIndex ? 4 : 2,
              opacity: isDimmed ? 0.3 : 1,
            };
            delay = `${0.6 + n.catIndex * 0.09}s`;
            content = (
              <CategoryNode
                color={n.color}
                label={cat?.category ?? ''}
                imageQuery={cat?.image_query}
                factCount={cat?.facts.length ?? 0}
                focused={focusedCat === n.catIndex}
                onClick={() => onCategoryClick(n.catIndex)}
              />
            );
          } else {
            const text = graphData.graph[n.catIndex]?.facts[n.factIndex] ?? '';
            style = {
              ...baseStyle,
              zIndex: 3,
              opacity: isDimmed ? 0.12 : 1,
              pointerEvents: isDimmed ? 'none' : 'auto',
            };
            delay = `${0.9 + n.catIndex * 0.04 + n.factIndex * 0.05}s`;
            content = <FactCard color={n.color} index={n.factIndex} text={text} />;
          }

          return (
            <NodeDiv key={n.id} nodeKey={n.id} nodeEls={nodeEls} style={style}>
              <div
                className="node-spawn"
                style={{
                  animationDelay: delay,
                  display: n.kind === 'category' ? 'flex' : 'block',
                  justifyContent: 'center',
                }}
              >
                {content}
              </div>
            </NodeDiv>
          );
        })}
      </div>
    </div>
  );
}
