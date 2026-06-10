import { useState, useEffect, useMemo } from 'react';
import { CYAN, BG, TOP_BAR_H, BOTTOM_STRIP_H } from '../../../infrastructure/constants';

const LOADING_STATUS = [
  'PARSING QUERY',
  'CONNECTING SOURCES',
  'AGGREGATING DATA',
  'BUILDING GRAPH',
  'FINALIZING',
] as const;

interface LoadingSceneProps {
  W: number;
  H: number;
}

export function LoadingScene({ W, H }: LoadingSceneProps) {
  const availH = H - TOP_BAR_H - BOTTOM_STRIP_H;
  const cx = W / 2;
  const cy = TOP_BAR_H + availH / 2;
  const r  = Math.min(W, availH) * 0.36;

  const [statusIdx, setStatusIdx] = useState(0);
  const [tick, setTick]           = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStatusIdx(i => (i + 1) % LOADING_STATUS.length), 1100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 80);
    return () => clearInterval(id);
  }, []);

  const particles = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const angle  = (i * 137.508) % 360;
    const startR = r * (1 + (i % 3) * 0.15);
    const rad    = angle * Math.PI / 180;
    return {
      x:      cx + startR * Math.cos(rad),
      y:      cy + startR * Math.sin(rad),
      driftX: -startR * Math.cos(rad) * 0.95,
      driftY: -startR * Math.sin(rad) * 0.95,
      delay:  i * 0.18,
      dur:    2.1 + (i % 4) * 0.3,
    };
  }), [cx, cy, r]);

  const SWEEP_ARMS = [
    { dur: '3s',   offset: 0,   opacity: 0.85, width: 1.5 },
    { dur: '4.4s', offset: 120, opacity: 0.5,  width: 1   },
    { dur: '5.6s', offset: 240, opacity: 0.32, width: 0.8 },
  ] as const;

  const RINGS = [
    { scale: 1.12, dash: '2 14', width: 1,   alpha: '10' },
    { scale: 1,    dash: '',     width: 1,   alpha: '1e' },
    { scale: 0.78, dash: '4 8',  width: 0.6, alpha: '14' },
    { scale: 0.55, dash: '6 4',  width: 0.6, alpha: '1c' },
    { scale: 0.32, dash: '2 6',  width: 0.6, alpha: '24' },
  ] as const;

  return (
    <>
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
        <defs>
          <radialGradient id="scanCone">
            <stop offset="0%"   stopColor={CYAN} stopOpacity="0.18" />
            <stop offset="60%"  stopColor={CYAN} stopOpacity="0.05" />
            <stop offset="100%" stopColor={CYAN} stopOpacity="0" />
          </radialGradient>
        </defs>

        {RINGS.map(({ scale, dash, width, alpha }, i) => (
          <circle key={i} cx={cx} cy={cy} r={r * scale}
            fill="none" stroke={`${CYAN}${alpha}`} strokeWidth={width}
            strokeDasharray={dash || undefined}
          />
        ))}

        {SWEEP_ARMS.map(({ dur, offset, opacity, width }, i) => (
          <g key={i} transform={`translate(${cx}, ${cy})`}>
            <g className="radar-sweep" style={{ animationDuration: dur, transform: `rotate(${offset}deg)`, transformOrigin: '0 0' }}>
              <path
                d={`M0,0 L${r * Math.sin(0.18)},${-r * Math.cos(0.18)} A${r},${r} 0 0,0 0,${-r} Z`}
                fill="url(#scanCone)" opacity={opacity}
              />
              <line x1={0} y1={0} x2={0} y2={-r} stroke={CYAN} strokeWidth={width} opacity={opacity} />
              <circle cx={0} cy={-r} r={2.5} fill={CYAN} opacity={opacity} style={{ filter: `drop-shadow(0 0 5px ${CYAN})` }} />
            </g>
          </g>
        ))}

        {([0, 45, 90, 135, 180, 225, 270, 315] as const).map(deg => {
          const rad = (deg - 90) * Math.PI / 180;
          const major = deg % 90 === 0;
          const len = major ? 12 : 6;
          return (
            <line key={deg}
              x1={cx + (r - len) * Math.cos(rad)} y1={cy + (r - len) * Math.sin(rad)}
              x2={cx + r * Math.cos(rad)}          y2={cy + r * Math.sin(rad)}
              stroke={`${CYAN}${major ? '88' : '44'}`} strokeWidth={major ? 1.5 : 0.8}
            />
          );
        })}

        {particles.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.8} fill={CYAN}
            style={{
              filter: `drop-shadow(0 0 4px ${CYAN})`,
              animation: `particleDrift ${p.dur}s ease-in ${p.delay}s infinite`,
              ['--drift' as string]: `translate(${p.driftX}px, ${p.driftY}px)`,
              transformBox: 'fill-box', transformOrigin: 'center',
            } as React.CSSProperties}
          />
        ))}
      </svg>

      <div style={{ position: 'absolute', left: cx - 80, top: cy - 80, pointerEvents: 'none' }}>
        <div style={{ width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          {(['', '0.7s', '1.4s'] as const).map((delay, i) => (
            <div key={i} className="ring-expand" style={{ position: 'absolute', width: 80, height: 80, borderRadius: '50%', border: `1px solid ${CYAN}${i === 0 ? '' : i === 1 ? '88' : '55'}`, animationDelay: delay }} />
          ))}
          <div className="center-pulse-2" style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', border: `2px solid ${CYAN}22` }} />
          <div className="center-pulse-1" style={{ position: 'absolute', width: 138, height: 138, borderRadius: '50%', border: `1px solid ${CYAN}44` }} />
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            background: `radial-gradient(circle, ${CYAN}22 0%, ${BG} 70%)`,
            border: `1.5px solid ${CYAN}`,
            boxShadow: `0 0 30px ${CYAN}66, inset 0 0 20px ${CYAN}33`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Orbitron', color: CYAN, position: 'relative', zIndex: 2,
          }}>
            <div style={{ fontSize: 8, letterSpacing: 3, opacity: 0.7 }}>CORTEX</div>
            <div style={{ fontSize: 12, letterSpacing: 4, marginTop: 2, fontWeight: 900 }}>SCAN</div>
          </div>
        </div>
      </div>

      <div style={{
        position: 'fixed', left: '50%', bottom: BOTTOM_STRIP_H + 60,
        transform: 'translateX(-50%)', zIndex: 6,
        fontFamily: 'Space Mono', fontSize: 11, color: `${CYAN}cc`,
        letterSpacing: 4, textAlign: 'center', textShadow: `0 0 12px ${CYAN}66`, whiteSpace: 'nowrap',
      }}>
        <span className="status-blink">▸</span>{' '}
        <span style={{ color: CYAN }}>{LOADING_STATUS[statusIdx]}</span>
        <span style={{ display: 'inline-block', width: 24, textAlign: 'left' }}>{'.'.repeat(tick % 4)}</span>
      </div>

      <div style={{
        position: 'fixed', bottom: BOTTOM_STRIP_H + 24, left: 24,
        zIndex: 6, fontFamily: 'Space Mono', fontSize: 8, letterSpacing: 1.5,
        color: `${CYAN}55`, textAlign: 'left', lineHeight: 1.8,
      }}>
        {LOADING_STATUS.slice(0, statusIdx + 1).map((s, i) => (
          <div key={i} style={{ color: i === statusIdx ? CYAN : `${CYAN}44` }}>
            <span style={{ marginRight: 6 }}>[{String(i + 1).padStart(2, '0')}]</span>
            <span>{s} {i === statusIdx ? '…' : '✓'}</span>
          </div>
        ))}
      </div>
    </>
  );
}
