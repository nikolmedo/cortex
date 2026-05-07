import { useEffect } from 'react';
import { BG, CYAN } from '../constants/index.js';

export const GLOBAL_CSS = `
  .cortex-root { position: fixed; inset: 0; overflow: hidden; background: ${BG}; }

  @keyframes pulseRing {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50%       { transform: scale(1.3); opacity: 0.18; }
  }
  @keyframes pulseRing2 {
    0%, 100% { transform: scale(1.1); opacity: 0.45; }
    50%       { transform: scale(1.55); opacity: 0.06; }
  }
  @keyframes hexPan {
    0%   { transform: translateX(0) translateY(0); }
    100% { transform: translateX(-60px) translateY(-34px); }
  }
  @keyframes scanLine {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(100%); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px) scale(0.9); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes glowPulse {
    0%, 100% { filter: drop-shadow(0 0 3px ${CYAN}66); }
    50%       { filter: drop-shadow(0 0 9px ${CYAN}); }
  }
  @keyframes chevronBlink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.2; }
  }
  @keyframes inputFadeIn {
    from { opacity: 0; transform: translateY(-24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes graphStageIn {
    from { opacity: 0; transform: scale(0.88); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes hudSlideLeft {
    from { opacity: 0; transform: translateX(-20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes hudSlideRight {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes galleryIn {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scanningDot {
    0%, 100% { opacity: 0.3; }
    50%       { opacity: 1; }
  }
  @keyframes radarSweep {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes radarFade {
    0%   { opacity: 0.7; }
    100% { opacity: 0; }
  }
  @keyframes overlayFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes expandIn {
    from { opacity: 0; transform: scale(0.88) translateY(12px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes backBtnIn {
    from { opacity: 0; transform: translate(-50%, -8px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes materialize {
    0%   { opacity: 0; filter: blur(8px) brightness(2.4); }
    60%  { opacity: 1; filter: blur(0) brightness(1.2); }
    100% { opacity: 1; filter: blur(0) brightness(1); }
  }
  @keyframes edgeDraw {
    from { stroke-dashoffset: 1200; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes hudBracketFadeIn {
    from { opacity: 0; transform: scale(0.85); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes statusBlink {
    0%, 100% { opacity: 0.3; }
    50%       { opacity: 1; }
  }
  @keyframes particleDrift {
    0%   { opacity: 0; transform: translate(0,0) scale(0.4); }
    20%  { opacity: 1; }
    100% { opacity: 0; transform: var(--drift, translate(40px,-60px)) scale(1.4); }
  }
  @keyframes ringExpand {
    0%   { transform: scale(0); opacity: 0.7; }
    100% { transform: scale(1.8); opacity: 0; }
  }
  @keyframes typewriter {
    from { width: 0; }
    to   { width: 100%; }
  }

  .node-anim {
    transition:
      left 0.55s cubic-bezier(0.22, 1, 0.36, 1),
      top  0.55s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.4s ease;
  }
  .node-spawn   { animation: materialize 0.7s cubic-bezier(0.16, 1, 0.3, 1) both; }
  .edge-anim    { transition: opacity 0.4s ease, stroke-width 0.4s ease; }
  .edge-draw    { stroke-dasharray: 1200; animation: edgeDraw 0.85s cubic-bezier(0.5, 0, 0.5, 1) 0.25s both; }
  .hud-bracket  { animation: hudBracketFadeIn 0.6s ease 0.1s both; }
  .status-blink { animation: statusBlink 1.4s ease-in-out infinite; }
  .ring-expand  { animation: ringExpand 2.2s ease-out infinite; transform-origin: center; }

  .hex-grid       { animation: hexPan 20s linear infinite; }
  .query-wrap     { animation: inputFadeIn 0.6s ease both; }
  .graph-stage    { animation: graphStageIn 0.5s cubic-bezier(0.16,1,0.3,1) both; }
  .center-pulse-1 { animation: pulseRing  3s ease-in-out infinite;    transform-origin: center; }
  .center-pulse-2 { animation: pulseRing2 3s ease-in-out infinite 1s; transform-origin: center; }
  .cat-node       { animation: glowPulse 4s ease-in-out infinite; cursor: pointer; }
  .hud-left       { animation: hudSlideLeft  0.5s ease 0.55s both; }
  .hud-right      { animation: hudSlideRight 0.5s ease 0.55s both; }
  .chevron-blink  { animation: chevronBlink 1.2s ease-in-out infinite; }
  .scanning-dot   { animation: scanningDot  1s ease-in-out infinite; }
  .radar-sweep    { animation: radarSweep 3s linear infinite; transform-origin: 0 0; }

  .fact-node {
    animation: fadeInUp 0.4s ease both;
    transition: opacity 0.2s, transform 0.2s;
  }
  .fact-node--collapsed {
    opacity: 0 !important;
    transform: scale(0.45) !important;
    pointer-events: none !important;
  }

  ::-webkit-scrollbar { display: none; }
`;

export function GlobalStyles() {
  useEffect(() => {
    const el = document.createElement('style');
    el.id = 'cortex-globals';
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
  return null;
}
