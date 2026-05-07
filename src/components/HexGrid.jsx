import React from 'react';
import { CYAN } from '../constants/index.js';

export function HexGrid({ W, H }) {
  const hexSize = 30;
  const hw = hexSize * 2;
  const hh = Math.sqrt(3) * hexSize;
  const cols = Math.ceil(W / hw) + 4;
  const rows = Math.ceil(H / hh) + 4;

  const hexes = [];
  for (let r = -2; r < rows; r++) {
    for (let c = -2; c < cols; c++) {
      const x = c * hw * 0.75;
      const y = r * hh + (c % 2 === 0 ? 0 : hh / 2);
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 180) * (60 * i - 30);
        return `${x + hexSize * Math.cos(a)},${y + hexSize * Math.sin(a)}`;
      }).join(' ');
      hexes.push(<polygon key={`${r}-${c}`} points={pts} fill="none" stroke={CYAN} strokeWidth="0.5" />);
    }
  }

  return (
    <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', opacity: 0.055, pointerEvents: 'none', zIndex: 0 }}>
      <g className="hex-grid">{hexes}</g>
    </svg>
  );
}
