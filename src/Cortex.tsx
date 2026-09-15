import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import { useCortex } from './application/useCortex';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import type { ViewTransform } from './layout/fitView';
import { Nebula } from './presentation/components/background/Nebula';
import { Particles } from './presentation/components/background/Particles';
import { DesktopScene } from './presentation/components/DesktopScene';
import { LoadingScene } from './presentation/components/graph/LoadingScene';
import { HexGrid } from './presentation/components/HexGrid';
import { HUDFrame } from './presentation/components/HUDFrame';
import { MobileExplorer } from './presentation/components/mobile/MobileExplorer';
import { QueryHistory } from './presentation/components/QueryHistory';
import { QueryInput } from './presentation/components/QueryInput';
import { SettingsMenu } from './presentation/components/settings/SettingsMenu';
import { EmptyState } from './presentation/components/shared/EmptyState';
import { TopBar } from './presentation/components/TopBar';
import { useIsMobile } from './presentation/hooks/useBreakpoint';
import { SettingsContext, useSettings, useSettingsState } from './presentation/hooks/useSettings';
import { SceneTheme } from './presentation/scene/SceneTheme';
import styles from './Cortex.module.css';

export default function Cortex() {
  const settingsState = useSettingsState();
  return (
    <SettingsContext.Provider value={settingsState}>
      <I18nProvider locale={settingsState.settings.locale}>
        <CortexApp />
      </I18nProvider>
    </SettingsContext.Provider>
  );
}

function CortexApp() {
  const { settings } = useSettings();
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [graphTransformRef, setGraphTransformRef] =
    useState<React.RefObject<ViewTransform> | null>(null);

  const { query, phase, scene, history, error, viewport, handleSubmit, handleNewQuery } =
    useCortex(settings.locale);
  const { W, H } = viewport;

  // Portaled overlays live outside .cortex-root, so the hook goes on <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.motion === 'reduced') root.dataset.motion = 'reduced';
    else delete root.dataset.motion;
  }, [settings.motion]);

  const retry = () => handleSubmit(query);
  const emptyScene = phase === 'graph' && scene != null && scene.graph.length === 0;

  const gearButton = (
    <button
      className={styles.gearBtn}
      onClick={() => setSettingsOpen(true)}
      aria-label={t('topbar.settings')}
    >
      <Settings size={16} />
    </button>
  );

  const overlays = (
    <>
      {settingsOpen && <SettingsMenu onClose={() => setSettingsOpen(false)} />}
      {error && <div className={styles.errorToast} role="alert">{t(error)}</div>}
    </>
  );

  if (isMobile) {
    return (
      <SceneTheme scene={scene}>
        <div className={`cortex-root ${phase === 'graph' ? 'cortex-root--scroll' : ''}`}>
          <Nebula />
          {phase === 'input' && (
            <>
              <QueryInput
                onSubmit={handleSubmit}
                historySlot={<QueryHistory history={history} onSelect={handleSubmit} variant="inline" />}
              />
              {gearButton}
            </>
          )}
          {phase === 'loading' && (
            <div className={styles.loadingWrap}>
              <LoadingScene W={W} H={H} query={query} />
            </div>
          )}
          {phase === 'graph' && scene && (
            <MobileExplorer
              query={query}
              scene={scene}
              onNewQuery={handleNewQuery}
              onRetry={retry}
              onToggleSettings={() => setSettingsOpen(true)}
            />
          )}
          {overlays}
        </div>
      </SceneTheme>
    );
  }

  return (
    <SceneTheme scene={scene}>
      <div className="cortex-root">
        <Nebula />
        <HexGrid W={W} H={H} />
        <Particles offsetRef={graphTransformRef ?? undefined} />

        {phase === 'input' && (
          <>
            <QueryInput
              onSubmit={handleSubmit}
              historySlot={<QueryHistory history={history} onSelect={handleSubmit} variant="inline" />}
            />
            {gearButton}
          </>
        )}

        {phase === 'loading' && (
          <>
            <TopBar query={query} onNewQuery={handleNewQuery} />
            <div className={styles.loadingWrap}>
              <LoadingScene W={W} H={H} query={query} />
            </div>
          </>
        )}

        {emptyScene && scene && (
          <>
            <TopBar
              query={query}
              scene={scene}
              onNewQuery={handleNewQuery}
              onToggleSettings={() => setSettingsOpen(true)}
            />
            <HUDFrame />
            <EmptyState query={query} onRetry={retry} onNewQuery={handleNewQuery} />
          </>
        )}

        {phase === 'graph' && scene && !emptyScene && (
          <DesktopScene
            query={query}
            scene={scene}
            history={history}
            W={W}
            H={H}
            onSubmit={handleSubmit}
            onNewQuery={handleNewQuery}
            onToggleSettings={() => setSettingsOpen(true)}
            onTransformRef={setGraphTransformRef}
          />
        )}

        {overlays}
      </div>
    </SceneTheme>
  );
}
