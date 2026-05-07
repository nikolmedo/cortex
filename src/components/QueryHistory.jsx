import React from 'react';
import { CYAN, TOP_BAR_H } from '../constants/index.js';

export function QueryHistory({ history, onSelect }) {
  if (!history.length) return null;
  return (
    <div className="hud-right" style={{ position: 'fixed', top: TOP_BAR_H + 10, right: 16, zIndex: 25, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
      {history.slice(0, 4).map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          style={{
            background: `${CYAN}08`, border: `1px solid ${CYAN}2a`, borderRadius: 20,
            padding: '4px 12px', cursor: 'pointer', fontFamily: 'Space Mono', fontSize: 9,
            color: `${CYAN}99`, letterSpacing: 1, transition: 'all 0.2s', whiteSpace: 'nowrap',
            maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = `${CYAN}18`; e.currentTarget.style.color = CYAN; e.currentTarget.style.boxShadow = `0 0 12px ${CYAN}33`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${CYAN}08`; e.currentTarget.style.color = `${CYAN}99`; e.currentTarget.style.boxShadow = 'none'; }}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
