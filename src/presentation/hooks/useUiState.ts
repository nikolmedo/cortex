import { useCallback, useEffect, useState } from 'react';
import type { ViewMode } from './useSettings';

export interface LightboxState {
  src: string | null;
  /** When src is null the lightbox shows the animated monogram fallback. */
  title: string;
  color: string;
}

export interface UiState {
  immersive: boolean;
  toggleImmersive: () => void;
  dossierOpen: boolean;
  toggleDossier: () => void;
  lightbox: LightboxState | null;
  openLightbox: (state: LightboxState) => void;
  closeLightbox: () => void;
  /** Category index shown in the immersive-mode detail sheet. */
  detailCat: number | null;
  openDetail: (index: number) => void;
  closeDetail: () => void;
}

/**
 * Presentation-only UI state for the desktop scene.
 * `resetKey` re-initializes immersive/dossier from the default view mode
 * whenever a new result arrives.
 */
export function useUiState(defaultViewMode: ViewMode, resetKey: unknown): UiState {
  const [immersive, setImmersive] = useState(defaultViewMode === 'immersive');
  const [dossierOpen, setDossierOpen] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [detailCat, setDetailCat] = useState<number | null>(null);

  // On each new result: re-apply the default view mode and slide the dossier
  // in late, as the final beat of the graph reveal timeline.
  useEffect(() => {
    setImmersive(defaultViewMode === 'immersive');
    setDossierOpen(false);
    setLightbox(null);
    setDetailCat(null);
    if (defaultViewMode === 'panel') {
      const id = window.setTimeout(() => setDossierOpen(true), 1200);
      return () => window.clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return {
    immersive,
    toggleImmersive: useCallback(() => {
      setImmersive(prev => !prev);
      setDetailCat(null);
    }, []),
    dossierOpen,
    toggleDossier: useCallback(() => setDossierOpen(prev => !prev), []),
    lightbox,
    openLightbox: useCallback((state: LightboxState) => setLightbox(state), []),
    closeLightbox: useCallback(() => setLightbox(null), []),
    detailCat,
    openDetail: useCallback((index: number) => setDetailCat(index), []),
    closeDetail: useCallback(() => setDetailCat(null), []),
  };
}
