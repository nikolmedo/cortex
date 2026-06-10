import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { TRANSLATIONS, type Locale, type TranslationKey } from './translations';

type Interpolations = Record<string, string | number>;

export interface I18n {
  locale: Locale;
  t: (key: TranslationKey, params?: Interpolations) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18n>(() => ({
    locale,
    t: (key, params) => {
      let text: string = TRANSLATIONS[locale][key];
      if (params) {
        for (const [name, v] of Object.entries(params)) {
          text = text.replaceAll(`{${name}}`, String(v));
        }
      }
      return text;
    },
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
