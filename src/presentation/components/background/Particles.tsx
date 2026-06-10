import { useEffect, useRef } from 'react';
import { CYAN, MAGENTA } from '../../../infrastructure/constants';

interface Particle {
  x: number;
  y: number;
  depth: number;
  speed: number;
  size: number;
  color: string;
  phase: number;
}

interface ParticlesProps {
  /** Optional world offset (e.g. pan position) used for subtle parallax. */
  offsetRef?: React.RefObject<{ x: number; y: number }>;
  count?: number;
}

export function Particles({ offsetRef, count = 60 }: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const particles: Particle[] = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      depth: 0.3 + Math.random() * 0.7,
      speed: 6 + Math.random() * 14,
      size: 1 + Math.random() * 1.5,
      color: i % 5 === 0 ? MAGENTA : CYAN,
      phase: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.clearRect(0, 0, W, H);
      const px = (offsetRef?.current?.x ?? 0) * 0.05;
      const py = (offsetRef?.current?.y ?? 0) * 0.05;

      for (const p of particles) {
        p.y -= p.speed * p.depth * dt;
        p.x += Math.sin(now * 0.0004 + p.phase) * 0.12;
        if (p.y < -4) {
          p.y = H + 4;
          p.x = Math.random() * W;
        }
        const alpha = 0.12 + p.depth * 0.3;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x + px * p.depth, p.y + py * p.depth, p.size * p.depth, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [offsetRef, count]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{ position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none' }}
    />
  );
}
