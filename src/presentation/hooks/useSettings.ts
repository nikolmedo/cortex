import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Locale } from '../../i18n/translations';

export type ViewMode = 'panel' | 'immersive';

export interface Settings {
  locale: Locale;
  defaultViewMode: ViewMode;
}

export interface SettingsState {
  settings: Settings;
  setLocale: (locale: Locale) => void;
  setDefaultViewMode: (mode: ViewMode) => void;
}

const STORAGE_KEY = 'cortex.settings';

const DEFAULT_SETTINGS: Settings = {
  locale: 'en',
  defaultViewMode: 'panel',
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      locale: parsed.locale === 'es' ? 'es' : 'en',
      defaultViewMode: parsed.defaultViewMode === 'immersive' ? 'immersive' : 'panel',
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const SettingsContext = createContext<SettingsState | null>(null);

export function useSettingsState(): SettingsState {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage may be unavailable (private mode); settings stay in memory.
    }
  }, [settings]);

  return useMemo<SettingsState>(() => ({
    settings,
    setLocale: locale => setSettings(s => ({ ...s, locale })),
    setDefaultViewMode: defaultViewMode => setSettings(s => ({ ...s, defaultViewMode })),
  }), [settings]);
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsContext.Provider');
  return ctx;
}
