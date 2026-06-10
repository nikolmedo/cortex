import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useCortex } from './application/useCortex';
import { I18nProvider, useI18n } from './i18n/I18nContext';
import type { ViewTransform } from './layout/fitView';
import { Nebula } from './presentation/components/background/Nebula';
import { Particles } from './presentation/components/background/Particles';
import { DesktopScene } from './presentation/components/DesktopScene';
import { LoadingScene } from './presentation/components/graph/LoadingScene';
import { HexGrid } from './presentation/components/HexGrid';
import { MobileExplorer } from './presentation/components/mobile/MobileExplorer';
import { QueryHistory } from './presentation/components/QueryHistory';
import { QueryInput } from './presentation/components/QueryInput';
import { SettingsMenu } from './presentation/components/settings/SettingsMenu';
import { TopBar } from './presentation/components/TopBar';
import { useIsMobile } from './presentation/hooks/useBreakpoint';
import { SettingsContext, useSettings, useSettingsState } from './presentation/hooks/useSettings';
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

  const { query, phase, graphData, history, error, viewport, handleSubmit, handleNewQuery } =
    useCortex(settings.locale);
  const { W, H } = viewport;

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
      {error && <div className={styles.errorToast}>{error}</div>}
    </>
  );

  if (isMobile) {
    return (
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
            <LoadingScene W={W} H={H} />
          </div>
        )}
        {phase === 'graph' && graphData && (
          <MobileExplorer
            query={query}
            graphData={graphData}
            onNewQuery={handleNewQuery}
            onToggleSettings={() => setSettingsOpen(true)}
          />
        )}
        {overlays}
      </div>
    );
  }

  return (
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
            <LoadingScene W={W} H={H} />
          </div>
        </>
      )}

      {phase === 'graph' && graphData && (
        <DesktopScene
          query={query}
          graphData={graphData}
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
  );
}
