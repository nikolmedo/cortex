import { useCallback, useEffect, useMemo, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import type { Scene } from '../../domain/Scene';
import { typeColor } from '../../domain/typeColors';
import { TOP_BAR_H } from '../../infrastructure/constants';
import { IMG } from '../../infrastructure/image';
import { useI18n } from '../../i18n/I18nContext';
import type { ViewRect, ViewTransform } from '../../layout/fitView';
import { useSettings } from '../hooks/useSettings';
import { useUiState } from '../hooks/useUiState';
import { DossierPanel, DOSSIER_W } from './dossier/DossierPanel';
import { GraphStage } from './graph/GraphStage';
import { HUDFrame } from './HUDFrame';
import { Lightbox } from './overlay/Lightbox';
import { NodeDetailSheet } from './overlay/NodeDetailSheet';
import { QueryHistory } from './QueryHistory';
import { TopBar } from './TopBar';
import styles from './DesktopScene.module.css';

interface DesktopSceneProps {
  query: string;
  scene: Scene;
  history: string[];
  W: number;
  H: number;
  onSubmit: (q: string) => void;
  onNewQuery: () => void;
  onToggleSettings: () => void;
  onTransformRef?: (ref: React.RefObject<ViewTransform>) => void;
}

export function DesktopScene({
  query,
  scene,
  history,
  W,
  H,
  onSubmit,
  onNewQuery,
  onToggleSettings,
  onTransformRef,
}: DesktopSceneProps) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const ui = useUiState(settings.defaultViewMode, scene);
  const [focusedCat, setFocusedCat] = useState<number | null>(null);
  const [spotlightRequest, setSpotlightRequest] = useState(0);

  useEffect(() => {
    setFocusedCat(null);
    setSpotlightRequest(0);
  }, [scene]);

  const viewRect = useMemo<ViewRect>(() => {
    const top = ui.immersive ? 0 : TOP_BAR_H;
    const right = !ui.immersive && ui.dossierOpen ? DOSSIER_W : 0;
    return { left: 0, top, width: W - right, height: H - top };
  }, [W, H, ui.immersive, ui.dossierOpen]);

  // Keyboard: 'i' toggles immersive; Esc unwinds detail sheet → focus.
  // (Lightbox and SettingsMenu intercept Esc themselves while open.)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'i' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        ui.toggleImmersive();
      }
      if (e.key === 'Escape') {
        if (ui.detailCat != null) ui.closeDetail();
        else if (focusedCat != null) setFocusedCat(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ui, focusedCat]);

  const color = typeColor(scene.type);
  const lightboxSrc = scene.image_url || IMG.lightbox(scene.image_query || scene.title, 99);

  const openEntityLightbox = useCallback(() => {
    ui.openLightbox({ src: lightboxSrc, title: scene.title, color });
  }, [ui, lightboxSrc, scene.title, color]);

  const handleCategoryClick = useCallback(
    (index: number) => {
      if (ui.immersive) {
        ui.openDetail(index);
      } else {
        setFocusedCat(prev => (prev === index ? null : index));
      }
    },
    [ui],
  );

  const handleSpotlightClick = useCallback(() => {
    ui.openDossier();
    setSpotlightRequest(n => n + 1);
  }, [ui]);

  return (
    <>
      <GraphStage
        key={query}
        scene={scene}
        viewRect={viewRect}
        focusedCat={focusedCat}
        onCategoryClick={handleCategoryClick}
        onBackgroundClick={() => setFocusedCat(null)}
        onCenterImageClick={openEntityLightbox}
        onSpotlightClick={handleSpotlightClick}
        onTransformRef={onTransformRef}
      />

      <TopBar
        query={query}
        scene={scene}
        onNewQuery={onNewQuery}
        hidden={ui.immersive}
        dossierOpen={ui.dossierOpen}
        onToggleDossier={ui.toggleDossier}
        onToggleImmersive={ui.toggleImmersive}
        onToggleSettings={onToggleSettings}
      />
      <HUDFrame hidden={ui.immersive} />
      <QueryHistory history={history} onSelect={onSubmit} hidden={ui.immersive} />

      <DossierPanel
        scene={scene}
        open={ui.dossierOpen && !ui.immersive}
        onHeroClick={openEntityLightbox}
        spotlightRequest={spotlightRequest}
      />

      {focusedCat != null && scene.graph[focusedCat] && (
        <button className={styles.focusBar} onClick={() => setFocusedCat(null)}>
          <span>◄</span>
          <span>{t('graph.overview')}</span>
          <span className={styles.focusBarEsc}>{t('graph.esc')}</span>
        </button>
      )}

      <button
        className={styles.immersiveBtn}
        onClick={ui.toggleImmersive}
        title={ui.immersive ? t('immersive.exit') : t('immersive.enter')}
        aria-label={ui.immersive ? t('immersive.exit') : t('immersive.enter')}
      >
        {ui.immersive ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>

      {ui.detailCat != null && scene.graph[ui.detailCat] && (
        <NodeDetailSheet category={scene.graph[ui.detailCat]} onClose={ui.closeDetail} />
      )}

      {ui.lightbox && (
        <Lightbox
          src={ui.lightbox.src}
          title={ui.lightbox.title}
          color={ui.lightbox.color}
          onClose={ui.closeLightbox}
        />
      )}
    </>
  );
}
