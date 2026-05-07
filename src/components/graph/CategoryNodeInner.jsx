import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { loremflickrUrl } from '../../utils/image.js';

export function CategoryNodeInner({
  color,
  imgQuery,
  label,
  isHovered,
  isCollapsed,
  isFocused,
  intensity = 0.5,
  factCount = 0,
}) {
  const [imgErr, setImgErr] = useState(false);
  const src = loremflickrUrl(imgQuery || label, 100, 100);

  // Ring size and glow scale with fact density (intensity 0–1) and focus state
  const baseSize   = Math.round(48 + intensity * 18);
  const ringSize   = isFocused ? 80 : baseSize;
  const glowRadius = isFocused ? 34 : isHovered ? 26 : Math.round(10 + intensity * 14);
  const glowAlpha  = isFocused ? 'cc' : isHovered ? 'cc' : (intensity > 0.66 ? 'aa' : intensity > 0.33 ? '88' : '55');
  const borderWidth = isFocused ? 2.5 : (intensity > 0.66 ? 2.2 : 2);

  return (
    <div style={{
      width: 100, minHeight: 100,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      transform: isFocused ? 'scale(1.18)' : 'scale(1)',
      transition: 'transform 0.55s cubic-bezier(0.22,1,0.36,1)',
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: ringSize, height: ringSize, borderRadius: '50%', overflow: 'hidden', position: 'relative',
          border: `${borderWidth}px solid ${color}`,
          boxShadow: `0 0 ${glowRadius}px ${color}${glowAlpha}, inset 0 0 ${Math.round(glowRadius * 0.5)}px ${color}28`,
          transition: 'box-shadow 0.3s, width 0.4s, height 0.4s, border-width 0.3s',
        }}>
          {imgQuery && !imgErr ? (
            <>
              <img
                src={src}
                alt={label}
                crossOrigin="anonymous"
                onError={() => setImgErr(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isFocused ? 'brightness(0.85) saturate(1.4)' : 'brightness(0.6) saturate(1.6)', transition: 'filter 0.3s' }}
              />
              <div style={{ position: 'absolute', inset: 0, background: `${color}${isFocused ? '15' : '2a'}`, mixBlendMode: 'screen' }} />
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', background: `radial-gradient(circle, ${color}44, ${color}0a)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={16} color={color} style={{ transform: isCollapsed ? 'rotate(0)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
            </div>
          )}
        </div>

        {/* Fact count badge */}
        {factCount > 0 && !isFocused && (
          <div style={{
            position: 'absolute', top: -3, right: -6,
            background: 'rgba(2,5,16,0.85)', borderRadius: 8,
            padding: '2px 5px', border: `1px solid ${color}55`,
            fontFamily: 'Orbitron', fontSize: 8, color, letterSpacing: 0.5,
            boxShadow: `0 0 6px ${color}33`,
          }}>
            {factCount}
          </div>
        )}
      </div>

      <div style={{
        fontFamily: 'Space Mono', fontSize: isFocused ? 9 : 8, color,
        letterSpacing: 2, marginTop: 7,
        textShadow: `0 0 ${isFocused ? 12 : 8}px ${color}aa`,
        textAlign: 'center', maxWidth: 96,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        fontWeight: isFocused ? 700 : 400,
        transition: 'font-size 0.3s, font-weight 0.3s',
      }}>
        {label}
      </div>
    </div>
  );
}
