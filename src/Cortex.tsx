import { useCallback, useEffect, useState } from 'react';
import { useCortex } from './application/useCortex';
import { I18nProvider } from './i18n/I18nContext';
import { AmbientField } from './presentation/canvas/AmbientField';
import { CommandBar } from './presentation/components/command/CommandBar';
import { Landing } from './presentation/components/landing/Landing';
import { SessionStream } from './presentation/components/session/SessionStream';
import { SettingsMenu } from './presentation/components/shell/SettingsMenu';
import { TopBar } from './presentation/components/shell/TopBar';
import { useRecentQueries } from './presentation/hooks/useRecentQueries';
import { useReducedMotion } from './presentation/hooks/useReducedMotion';
import { SettingsContext, useSettings, useSettingsState } from './presentation/hooks/useSettings';
import { turnPresentation } from './presentation/scene/presentation';

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
  const reduced = useReducedMotion();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { turns, submit, retry, cancel, clearSession } = useCortex(settings.locale);
  const { recent, remember } = useRecentQueries();

  const latest = turns.length > 0 ? turns[turns.length - 1] : undefined;
  // Any turn can be in flight, not just the last one: retrying an older turn
  // must still show ambient activity and offer Stop instead of Send.
  const busy = turns.some(t => t.status === 'thinking' || t.status === 'streaming');
  const ambient = turnPresentation(latest);

  // Portaled overlays live outside the app root, so the hooks go on <html>.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.motion === 'reduced') root.dataset.motion = 'reduced';
    else delete root.dataset.motion;
  }, [settings.motion]);

  useEffect(() => {
    document.documentElement.lang = settings.locale;
  }, [settings.locale]);

  const ask = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    remember(q);
    submit(q);
  }, [remember, submit]);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const newSession = useCallback(() => {
    clearSession();
    window.scrollTo({ top: 0 });
  }, [clearSession]);

  return (
    <>
      <AmbientField
        palette={ambient.palette}
        mood={ambient.mood}
        motif={ambient.motif}
        active={busy}
        reduced={reduced}
      />
      <TopBar session={turns.length > 0} onNewSession={newSession} onOpenSettings={openSettings} />
      {turns.length === 0 ? (
        <Landing recent={recent} reduced={reduced} onSubmit={ask} />
      ) : (
        <>
          <main>
            <SessionStream turns={turns} reduced={reduced} onRetry={retry} onFollowup={ask} />
          </main>
          <CommandBar docked busy={busy} onSubmit={ask} onStop={cancel} />
        </>
      )}
      {settingsOpen ? <SettingsMenu onClose={closeSettings} /> : null}
    </>
  );
}
