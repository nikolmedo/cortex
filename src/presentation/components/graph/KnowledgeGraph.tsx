import { useState, useEffect, useRef, useMemo, type MutableRefObject } from 'react';
import { CYAN, BG, TOP_BAR_H, BOTTOM_STRIP_H } from '../../../infrastructure/constants';
import { computeLayout, floatOffset, type CategoryPos } from '../../../layout/computeLayout';
import { loremflickrUrl } from '../../../infrastructure/image';
import { NodeDiv } from './NodeDiv';
import { CategoryNodeInner } from './CategoryNodeInner';
import { LoadingScene } from './LoadingScene';
import { Tooltip } from '../Tooltip';
import type { GraphData, GraphCategory } from '../../../domain/GraphData';

interface KnowledgeGraphProps {
  graphData: GraphData | null;
  phase: string;
  hoveredCat: number | null;
  setHoveredCat: (cat: number | null) => void;
  W: number;
  H: number;
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

export function KnowledgeGraph({ graphData, phase, hoveredCat, setHoveredCat, W, H }: KnowledgeGraphProps) {
  const nodeEls  = useRef<Record<string, HTMLDivElement | null>>({});
  const edgeRefs = useRef<Record<string, SVGPathElement | null>>({});
  const rafRef   = useRef<number | null>(null);

  const [tooltip,        setTooltip]        = useState<TooltipState>({ text: '', x: 0, y: 0 });
  const [focusedCat,     setFocusedCat]     = useState<number | null>(null);
  const [centerImgStage, setCenterImgStage] = useState(1);

  const baseLayout = useMemo(() => {
    if (!graphData) return null;
    return computeLayout(graphData, W, H, focusedCat);
  }, [graphData, W, H, focusedCat]);

  useEffect(() => {
    if (!graphData) return;
    setFocusedCat(null);
    setCenterImgStage(graphData.image_url ? 0 : 1);
  }, [graphData]);

  useEffect(() => {
    if (focusedCat == null) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFocusedCat(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedCat]);

  const nodeKeys = useMemo(() => {
    if (!baseLayout) return [];
    const keys = ['center'];
    baseLayout.categories.forEach((_, i) => {
      keys.push(`cat-${i}`);
      (graphData?.graph[i]?.facts ?? []).forEach((_, j) => keys.push(`fact-${i}-${j}`));
    });
    return keys;
  }, [baseLayout, graphData]);

  useEffect(() => {
    if (phase !== 'graph' || !baseLayout) return;
    const tick = (t: number) => {
      rafRef.current = requestAnimationFrame(tick);
      nodeKeys.forEach((key, k) => {
        const { dx, dy } = floatOffset(k, t);
        const el = nodeEls.current[key];
        if (el) el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, baseLayout, nodeKeys]);

  useEffect(() => {
    if (!baseLayout) return;
    const { cx, cy, categories, facts } = baseLayout;
    categories.forEach((cat, i) => {
      edgeRefs.current[`e-c-${i}`]?.setAttribute('d', `M${cx},${cy}L${cat.x},${cat.y}`);
    });
    facts.forEach((group, i) =>
      group.forEach((fact, j) => {
        edgeRefs.current[`e-f-${i}-${j}`]?.setAttribute('d', `M${categories[i].x},${categories[i].y}L${fact.x},${fact.y}`);
      })
    );
  }, [baseLayout]);

  if (phase === 'loading' && !graphData) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 5 }}>
        <LoadingScene W={W} H={H} />
      </div>
    );
  }

  if (!baseLayout || !graphData) return null;

  const { cx, cy, categories, facts } = baseLayout;
  const title      = graphData.title ?? '';
  const imageQuery = graphData.image_query ?? title;
  const initials   = title.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase();

  const centerImgSrc = centerImgStage === 0
    ? graphData.image_url
    : centerImgStage === 1
    ? loremflickrUrl(imageQuery, 200, 200, 99)
    : null;

  return (
    <div
      className="graph-stage"
      style={{ position: 'fixed', inset: 0, zIndex: 5 }}
      onClick={() => { if (focusedCat != null) setFocusedCat(null); }}
    >
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
        <defs>
          <filter id="glow-edge">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {categories.map((cat, i) => {
          const key = `e-c-${i}`;
          return (
            <g key={key} filter="url(#glow-edge)" className="edge-anim" style={{ opacity: focusedCat == null ? 1 : 0.12 }}>
              <path
                ref={el => { edgeRefs.current[key] = el; }}
                id={key}
                className="edge-draw"
                d={`M${cx},${cy}L${cat.x},${cat.y}`}
                stroke={`${CYAN}55`} strokeWidth="1" fill="none"
                style={{ animationDelay: `${0.35 + i * 0.08}s` }}
              />
              {focusedCat == null && (
                <circle r="3" fill={CYAN} style={{ filter: `drop-shadow(0 0 4px ${CYAN})` }}>
                  <animateMotion dur={`${2.6 + i * 0.28}s`} repeatCount="indefinite" begin={`${(i * 0.42).toFixed(2)}s`}>
                    <mpath href={`#${key}`} />
                  </animateMotion>
                </circle>
              )}
            </g>
          );
        })}

        {facts.map((group, i) =>
          group.map((fact, j) => {
            const key   = `e-f-${i}-${j}`;
            const color = categories[i]?.color ?? CYAN;
            const show  = focusedCat === i;
            return (
              <g key={key} filter="url(#glow-edge)" className="edge-anim" style={{ opacity: show ? 1 : 0 }}>
                <path
                  ref={el => { edgeRefs.current[key] = el; }}
                  id={key}
                  d={`M${categories[i].x},${categories[i].y}L${fact.x},${fact.y}`}
                  stroke={`${color}55`} strokeWidth="0.9" fill="none"
                />
                {show && (
                  <circle r="2" fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }}>
                    <animateMotion dur={`${1.8 + (i + j) * 0.22}s`} repeatCount="indefinite" begin={`${((i * 4 + j) * 0.28).toFixed(2)}s`}>
                      <mpath href={`#${key}`} />
                    </animateMotion>
                  </circle>
                )}
              </g>
            );
          })
        )}
      </svg>

      <NodeDiv
        nodeKey="center"
        nodeEls={nodeEls as MutableRefObject<Record<string, HTMLDivElement | null>>}
        className="node-spawn"
        style={{
          position: 'absolute', left: cx - 80, top: cy - 90, zIndex: 3,
          opacity: focusedCat == null ? 1 : 0,
          pointerEvents: focusedCat == null ? 'auto' : 'none',
          transition: 'opacity 0.35s ease',
        }}
      >
        <div style={{ width: 160, minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 18, position: 'relative' }}>
          <div className="center-pulse-2" style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', border: `2px solid ${CYAN}18`, top: 0, left: 0 }} />
          <div className="center-pulse-1" style={{ position: 'absolute', width: 138, height: 138, borderRadius: '50%', border: `1px solid ${CYAN}44`, top: 11, left: 11 }} />
          <div style={{ width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', position: 'relative', zIndex: 1, border: `2px solid ${CYAN}`, boxShadow: `0 0 32px ${CYAN}66, 0 0 60px ${CYAN}1f, inset 0 0 24px ${CYAN}22` }}>
            {centerImgSrc ? (
              <img src={centerImgSrc} alt={title} crossOrigin="anonymous" onError={() => setCenterImgStage(s => s + 1)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: `radial-gradient(circle, ${CYAN}33, ${BG})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Orbitron', fontSize: 24, fontWeight: 900, color: CYAN }}>
                {initials}
              </div>
            )}
          </div>
          <div style={{ marginTop: 12, fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: 2, textAlign: 'center', textShadow: `0 0 16px ${CYAN}77`, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 1, padding: '0 4px' }}>
            {title}
          </div>
          <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: `${CYAN}88`, letterSpacing: 1.4, textAlign: 'center', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', zIndex: 1, marginTop: 4, padding: '0 4px' }}>
            {graphData.subtitle}
          </div>
        </div>
      </NodeDiv>

      {categories.map((cat: CategoryPos, i: number) => {
        const catData   = graphData.graph[i];
        const factCount = catData?.facts?.length ?? 0;
        const intensity = Math.max(0, Math.min(1, (factCount - 2) / 3));
        return (
          <NodeDiv
            key={`cat-${i}`}
            nodeKey={`cat-${i}`}
            nodeEls={nodeEls as MutableRefObject<Record<string, HTMLDivElement | null>>}
            className="node-anim node-spawn"
            style={{
              position: 'absolute',
              left: cat.x - 50, top: cat.y - 50,
              zIndex: focusedCat === i ? 4 : 2,
              opacity: (focusedCat != null && focusedCat !== i) ? 0.22 : 1,
              animationDelay: `${0.18 + i * 0.09}s`,
            }}
          >
            <div
              className="cat-node"
              onClick={e => { e.stopPropagation(); setFocusedCat(prev => (prev === i ? null : i)); }}
              onMouseEnter={() => setHoveredCat(i)}
              onMouseLeave={() => setHoveredCat(null)}
            >
              <CategoryNodeInner
                color={cat.color}
                imgQuery={catData?.image_query}
                label={catData?.category ?? ''}
                isHovered={hoveredCat === i || focusedCat === i}
                isCollapsed={focusedCat !== i}
                isFocused={focusedCat === i}
                intensity={intensity}
                factCount={factCount}
              />
            </div>
          </NodeDiv>
        );
      })}

      {focusedCat != null && graphData.graph[focusedCat] && (
        <FocusedLabel
          category={graphData.graph[focusedCat]}
          entityTitle={graphData.title}
        />
      )}

      {facts.map((group, i) =>
        group.map((fact, j) => {
          const factText  = graphData.graph[i]?.facts[j] ?? '';
          const color     = categories[i]?.color ?? CYAN;
          const isVisible = focusedCat === i;
          return (
            <NodeDiv
              key={`fact-${i}-${j}`}
              nodeKey={`fact-${i}-${j}`}
              nodeEls={nodeEls as MutableRefObject<Record<string, HTMLDivElement | null>>}
              className="node-anim"
              style={{
                position: 'absolute',
                left: fact.x - 110, top: fact.y - 30,
                zIndex: 3,
                opacity: isVisible ? 1 : 0,
                pointerEvents: isVisible ? 'auto' : 'none',
                transitionDelay: isVisible ? `${j * 0.06}s` : '0s',
              }}
            >
              <FactCard color={color} index={j} text={factText} onTooltip={setTooltip} />
            </NodeDiv>
          );
        })
      )}

      {focusedCat != null && (
        <button
          onClick={e => { e.stopPropagation(); setFocusedCat(null); }}
          style={{
            position: 'fixed', top: TOP_BAR_H + 14, left: '50%',
            transform: 'translateX(-50%)', zIndex: 35,
            background: 'rgba(2,5,16,0.85)', backdropFilter: 'blur(10px)',
            border: `1px solid ${CYAN}55`, borderRadius: 4,
            padding: '7px 16px', color: CYAN,
            fontFamily: 'Space Mono', fontSize: 10, letterSpacing: 3, cursor: 'pointer',
            boxShadow: `0 0 20px ${CYAN}33`, animation: 'backBtnIn 0.3s ease both',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${CYAN}22`; e.currentTarget.style.boxShadow = `0 0 28px ${CYAN}55`; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(2,5,16,0.85)'; e.currentTarget.style.boxShadow = `0 0 20px ${CYAN}33`; }}
        >
          <span style={{ fontSize: 12 }}>◄</span>
          <span>OVERVIEW</span>
          <span style={{ color: `${CYAN}55`, fontSize: 9, marginLeft: 4 }}>ESC</span>
        </button>
      )}

      <Tooltip {...tooltip} />
    </div>
  );
}

function FocusedLabel({ category, entityTitle }: { category: GraphCategory; entityTitle: string }) {
  const color = category.color ?? CYAN;
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', left: '50%', bottom: BOTTOM_STRIP_H + 24,
        transform: 'translateX(-50%)', zIndex: 26,
        background: 'rgba(2,5,16,0.85)', backdropFilter: 'blur(10px)',
        border: `1px solid ${color}40`, borderTop: `2px solid ${color}`,
        borderRadius: 6, padding: '10px 18px',
        fontFamily: 'Space Mono', fontSize: 10, color: '#cfd9e6',
        letterSpacing: 1.5, textAlign: 'center', maxWidth: 360,
        animation: 'expandIn 0.3s cubic-bezier(0.16,1,0.3,1) both',
        boxShadow: `0 0 30px ${color}22`,
      }}
    >
      <span style={{ color, fontFamily: 'Orbitron', fontSize: 11, letterSpacing: 3, fontWeight: 700 }}>{category.category}</span>
      <span style={{ margin: '0 10px', color: `${CYAN}33` }}>·</span>
      <span style={{ color: '#88a' }}>{entityTitle}</span>
      <span style={{ margin: '0 10px', color: `${CYAN}33` }}>·</span>
      <span style={{ color: `${color}99` }}>{category.facts.length} entries</span>
    </div>
  );
}

function FactCard({ color, index, text, onTooltip }: {
  color: string;
  index: number;
  text: string;
  onTooltip: (state: TooltipState | ((prev: TooltipState) => TooltipState)) => void;
}) {
  return (
    <div
      onClick={e => e.stopPropagation()}
      onMouseEnter={e => onTooltip({ text, x: e.clientX, y: e.clientY })}
      onMouseLeave={() => onTooltip({ text: '', x: 0, y: 0 })}
      onMouseMove={e => onTooltip(p => ({ ...p, x: e.clientX, y: e.clientY }))}
    >
      <div
        style={{
          width: 220, borderRadius: 7,
          background: 'linear-gradient(135deg, rgba(2,6,20,0.96), rgba(2,6,20,0.92))',
          borderTop: `1px solid ${color}55`, borderRight: `1px solid ${color}30`,
          borderBottom: `1px solid ${color}30`, borderLeft: `3px solid ${color}`,
          boxShadow: `0 0 16px ${color}35, inset 0 0 30px ${color}08`,
          padding: '10px 14px 10px 12px',
          transition: 'box-shadow 0.2s, transform 0.2s',
          backdropFilter: 'blur(8px)',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 24px ${color}55, inset 0 0 30px ${color}10`; e.currentTarget.style.transform = 'scale(1.04)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 12px ${color}25, inset 0 0 30px ${color}05`; e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <div style={{ fontFamily: 'Orbitron', fontSize: 8, color: `${color}aa`, letterSpacing: 2, marginBottom: 4 }}>
          {String(index + 1).padStart(2, '0')}
        </div>
        <div style={{ fontFamily: 'Space Mono', fontSize: 12.5, color: '#f0f5ff', letterSpacing: 0.3, lineHeight: 1.55 }}>
          {text}
        </div>
      </div>
    </div>
  );
}
