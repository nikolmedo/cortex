/*
 * Single source of truth for every user-visible UI string.
 * Components must never hardcode visible text — add a key here instead.
 * English is the default locale; `es` must mirror every key.
 */

export const en = {
  'app.title': 'CORTEX',
  'app.tagline': 'KNOWLEDGE GRAPH ENGINE',

  'input.placeholder': 'Query Cortex...',
  'input.hint': 'PRESS ENTER TO SEARCH',
  'input.search': 'Search',

  'topbar.newQuery': 'NEW QUERY',
  'topbar.settings': 'Settings',

  'loading.step1': 'PARSING QUERY',
  'loading.step2': 'CONNECTING SOURCES',
  'loading.step3': 'AGGREGATING DATA',
  'loading.step4': 'BUILDING GRAPH',
  'loading.step5': 'FINALIZING',

  'graph.overview': 'OVERVIEW',
  'graph.esc': 'ESC',
  'graph.entries': '{count} ENTRIES',

  'dossier.title': 'DOSSIER',
  'dossier.summary': 'SUMMARY',
  'dossier.metadata': 'METADATA',
  'dossier.connections': 'CONNECTIONS',
  'dossier.copy': 'COPY',
  'dossier.copied': 'COPIED',
  'dossier.copyAll': 'COPY ALL',
  'dossier.toggle': 'Toggle dossier panel',

  'immersive.enter': 'IMMERSIVE',
  'immersive.exit': 'EXIT IMMERSIVE',

  'lightbox.close': 'CLOSE',

  'sheet.facts': 'ENTRIES',

  'settings.title': 'SETTINGS',
  'settings.viewMode': 'VIEW MODE',
  'settings.viewModePanel': 'PANEL',
  'settings.viewModeImmersive': 'IMMERSIVE',
  'settings.language': 'LANGUAGE',
  'settings.langEnglish': 'EN',
  'settings.langSpanish': 'ES',
  'settings.langHint': 'Result language applies from the next query',

  'mobile.connections': 'CONNECTIONS · {count} NODES',
  'mobile.newQuery': 'NEW QUERY',

  'error.unknown': 'Unknown error',
} as const;

export type TranslationKey = keyof typeof en;
export type Translations = Record<TranslationKey, string>;
export type Locale = 'en' | 'es';

export const es: Translations = {
  'app.title': 'CORTEX',
  'app.tagline': 'MOTOR DE GRAFOS DE CONOCIMIENTO',

  'input.placeholder': 'Consultar Cortex...',
  'input.hint': 'PRESIONÁ ENTER PARA BUSCAR',
  'input.search': 'Buscar',

  'topbar.newQuery': 'NUEVA CONSULTA',
  'topbar.settings': 'Configuración',

  'loading.step1': 'ANALIZANDO CONSULTA',
  'loading.step2': 'CONECTANDO FUENTES',
  'loading.step3': 'AGREGANDO DATOS',
  'loading.step4': 'CONSTRUYENDO GRAFO',
  'loading.step5': 'FINALIZANDO',

  'graph.overview': 'VISTA GENERAL',
  'graph.esc': 'ESC',
  'graph.entries': '{count} ENTRADAS',

  'dossier.title': 'DOSSIER',
  'dossier.summary': 'RESUMEN',
  'dossier.metadata': 'METADATOS',
  'dossier.connections': 'CONEXIONES',
  'dossier.copy': 'COPIAR',
  'dossier.copied': 'COPIADO',
  'dossier.copyAll': 'COPIAR TODO',
  'dossier.toggle': 'Mostrar/ocultar panel dossier',

  'immersive.enter': 'INMERSIVO',
  'immersive.exit': 'SALIR DE INMERSIVO',

  'lightbox.close': 'CERRAR',

  'sheet.facts': 'ENTRADAS',

  'settings.title': 'CONFIGURACIÓN',
  'settings.viewMode': 'MODO DE VISTA',
  'settings.viewModePanel': 'PANEL',
  'settings.viewModeImmersive': 'INMERSIVO',
  'settings.language': 'IDIOMA',
  'settings.langEnglish': 'EN',
  'settings.langSpanish': 'ES',
  'settings.langHint': 'El idioma de resultados aplica desde la próxima consulta',

  'mobile.connections': 'CONEXIONES · {count} NODOS',
  'mobile.newQuery': 'NUEVA CONSULTA',

  'error.unknown': 'Error desconocido',
};

export const TRANSLATIONS: Record<Locale, Translations> = { en, es };
