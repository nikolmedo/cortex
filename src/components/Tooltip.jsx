import React from 'react';
import { CYAN } from '../constants/index.js';

export function Tooltip({ text, x, y }) {
  if (!text) return null;
  return (
    <div style={{
      position: 'fixed',
      left: Math.min(x + 12, window.innerWidth - 260),
      top: Math.max(y - 14, 60),
      zIndex: 60,
      background: 'rgba(1,6,18,0.97)',
      border: `1px solid ${CYAN}44`,
      borderRadius: 4,
      padding: '7px 12px',
      pointerEvents: 'none',
      fontFamily: 'Space Mono',
      fontSize: 11,
      color: '#e0eeff',
      boxShadow: `0 0 20px ${CYAN}22`,
      maxWidth: 240,
      lineHeight: 1.6,
    }}>
      {text}
    </div>
  );
}
