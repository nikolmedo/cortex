import React from 'react';
import { CYAN, MAGENTA, PURPLE, BOTTOM_STRIP_H } from '../constants/index.js';

const TYPE_COLOR = {
  person:      CYAN,
  place:       '#00FF88',
  product:     '#FFB800',
  film:        MAGENTA,
  series:      MAGENTA,
  company:     PURPLE,
  event:       '#FF8C00',
  concept:     '#A855F7',
  sports_team: '#10B981',
  album:       '#FF6B35',
  book:        '#00D4FF',
};

export function MetaHUD({ graphData }) {
  if (!graphData) return null;

  const color = TYPE_COLOR[graphData.type] || CYAN;
  const catCount = graphData.graph?.length || 0;
  const factCount = (graphData.graph || []).reduce((s, c) => s + (c.facts?.length || 0), 0);

  return (
    <div className="hud-left" style={{
      position: 'fixed', bottom: BOTTOM_STRIP_H + 18, left: 24, zIndex: 25,
      background: 'rgba(1,5,15,0.92)', backdropFilter: 'blur(16px)',
      border: `1px solid ${color}22`, borderTop: `2px solid ${color}88`,
      borderRadius: 4, padding: 0,
      width: 320, maxWidth: '32vw',
      boxShadow: `0 0 36px rgba(0,0,0,0.7), 0 0 60px ${color}10, inset 0 0 30px rgba(0,212,255,0.015)`,
      overflow: 'hidden',
    }}>
      {/* Scanlines */}
      <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.012) 3px, rgba(0,212,255,0.012) 4px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: `linear-gradient(180deg, ${color}05, transparent)`, animation: 'scanLine 5s linear infinite', pointerEvents: 'none' }} />

      {/* Corner brackets */}
      {[
        { top: 6,    left: 6,    borderTop: `1px solid ${color}77`, borderLeft:  `1px solid ${color}77` },
        { top: 6,    right: 6,   borderTop: `1px solid ${color}77`, borderRight: `1px solid ${color}77` },
        { bottom: 6, left: 6,    borderBottom: `1px solid ${color}77`, borderLeft:  `1px solid ${color}77` },
        { bottom: 6, right: 6,   borderBottom: `1px solid ${color}77`, borderRight: `1px solid ${color}77` },
      ].map((s, i) => (
        <span key={i} style={{ position: 'absolute', width: 10, height: 10, pointerEvents: 'none', ...s }} />
      ))}

      {/* Header */}
      <div style={{ position: 'relative', padding: '14px 18px 10px', borderBottom: `1px solid ${color}18` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}, 0 0 16px ${color}`, flexShrink: 0 }} />
          <span style={{ fontFamily: 'Orbitron', fontSize: 10, color, letterSpacing: 4, fontWeight: 700 }}>
            {(graphData.type || 'unknown').toUpperCase()}
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: 'Space Mono', fontSize: 8, color: `${color}66`, letterSpacing: 1 }}>
            {String(catCount).padStart(2, '0')}.{String(factCount).padStart(2, '0')}
          </span>
        </div>
        <div style={{ fontFamily: 'Orbitron', fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: 1.5, lineHeight: 1.15, textShadow: `0 0 14px ${color}55` }}>
          {graphData.title}
        </div>
        {graphData.subtitle && (
          <div style={{ fontFamily: 'Space Mono', fontSize: 9, color: `${color}99`, letterSpacing: 1.5, marginTop: 5, wordBreak: 'break-word' }}>
            {graphData.subtitle}
          </div>
        )}
      </div>

      {/* Summary */}
      {graphData.summary && (
        <div style={{ position: 'relative', padding: '12px 18px 10px', borderBottom: `1px solid ${color}10` }}>
          <SectionHeader label="SUMMARY" color={color} />
          <div style={{ fontFamily: 'Space Mono', fontSize: 10.5, color: '#cdd9e8', letterSpacing: 0.2, lineHeight: 1.7, wordBreak: 'break-word' }}>
            {graphData.summary}
          </div>
        </div>
      )}

      {/* Metadata */}
      {Object.keys(graphData.meta || {}).length > 0 && (
        <div style={{ position: 'relative', padding: '11px 18px 14px' }}>
          <SectionHeader label="METADATA" color={color} />
          {Object.entries(graphData.meta).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 10, marginBottom: 5, fontFamily: 'Space Mono', fontSize: 9.5, alignItems: 'flex-start' }}>
              <span style={{ color: `${color}66`, minWidth: 80, flexShrink: 0, paddingTop: 1, letterSpacing: 1 }}>{k}</span>
              <span style={{ color: '#dde6f0', flex: 1, wordBreak: 'break-word', lineHeight: 1.55 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
      <span style={{ fontFamily: 'Orbitron', fontSize: 8, color: `${color}88`, letterSpacing: 3 }}>{label}</span>
      <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}33, transparent)` }} />
    </div>
  );
}
