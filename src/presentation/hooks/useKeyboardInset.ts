import { useEffect } from 'react';

/**
 * Publishes the height the on-screen keyboard covers as `--kb` on <html>, from
 * the visual viewport, so the docked command bar can lift above it with a transform.
 */
export function useKeyboardInset(enabled: boolean): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!enabled || !vv) return undefined;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--kb', `${Math.round(inset)}px`);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--kb');
    };
  }, [enabled]);
}
