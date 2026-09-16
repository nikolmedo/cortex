import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Locale } from '../../i18n/translations';

export type MotionMode = 'auto' | 'reduced';

export interface Settings {
  locale: Locale;
  motion: MotionMode;
}

export interface SettingsState {
  settings: Settings;
  setLocale: (locale: Locale) => void;
  setMotion: (motion: MotionMode) => void;
}

const STORAGE_KEY = 'cortex.settings';

const DEFAULT_SETTINGS: Settings = {
  locale: 'en',
  motion: 'auto',
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      locale: parsed.locale === 'es' ? 'es' : 'en',
      motion: parsed.motion === 'reduced' ? 'reduced' : 'auto',
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
    setMotion: motion => setSettings(s => ({ ...s, motion })),
  }), [settings]);
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsContext.Provider');
  return ctx;
}
