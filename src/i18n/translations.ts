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
  'input.examples.1': 'The Voyager 1 probe',
  'input.examples.2': 'Ada Lovelace',
  'input.examples.3': 'The 1969 Moon landing',
  'input.examples.4': 'Kyoto',
  'input.examples.5': 'The Fibonacci sequence',
  'input.examples.6': 'Blade Runner (1982)',
  'input.counter': '{count} / {max}',
  'input.tooLong': 'QUERY EXCEEDS {max} CHARACTERS',

  'topbar.newQuery': 'NEW QUERY',
  'topbar.settings': 'Settings',
  'topbar.signature': 'Scene signature',

  'loading.step1': 'PARSING QUERY',
  'loading.step2': 'CONNECTING SOURCES',
  'loading.step3': 'AGGREGATING DATA',
  'loading.step4': 'BUILDING GRAPH',
  'loading.step5': 'FINALIZING',
  'loading.step6': 'COMPOSING PRESENTATION',

  'graph.overview': 'OVERVIEW',
  'graph.esc': 'ESC',

  'scene.archetype.constellation': 'CONSTELLATION',
  'scene.archetype.orbital': 'ORBITAL',
  'scene.archetype.spine': 'SPINE',
  'scene.archetype.mosaic': 'MOSAIC',
  'scene.archetype.spiral': 'SPIRAL',
  'scene.mood.calm': 'CALM',
  'scene.mood.kinetic': 'KINETIC',
  'scene.mood.archival': 'ARCHIVAL',
  'scene.mood.volatile': 'VOLATILE',
  'scene.kind.list': 'List',
  'scene.kind.timeline': 'Timeline',
  'scene.kind.stats': 'Statistics',
  'scene.kind.comparison': 'Comparison',
  'scene.kind.quote': 'Quotes',
  'scene.kind.ranking': 'Ranking',
  'scene.kind.progress': 'Progress',
  'scene.kind.keyvalue': 'Key facts',
  'scene.kind.tags': 'Tags',

  'dossier.title': 'DOSSIER',
  'dossier.summary': 'SUMMARY',
  'dossier.metadata': 'METADATA',
  'dossier.connections': 'CONNECTIONS',
  'dossier.spotlight': 'SPOTLIGHT',
  'dossier.sources': 'SOURCES',
  'dossier.headline': 'Headline',
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
  'settings.motion': 'MOTION',
  'settings.motionAuto': 'AUTO',
  'settings.motionReduced': 'REDUCED',
  'settings.motionHint': 'Reduced motion disables ambient loops and long transitions',

  'mobile.connections': 'CONNECTIONS · {count} NODES',
  'mobile.newQuery': 'NEW QUERY',

  'empty.title': 'NO CONNECTIONS FOUND',
  'empty.body': 'The scan returned an entity without a graph. Refine the query or run the scan again.',
  'empty.retry': 'RETRY SCAN',

  'error.parse': 'The engine returned a response that could not be read',
  'error.validation': 'The engine returned a response that failed validation',
  'error.upstream': 'The knowledge source is unavailable. Try again shortly',
  'error.network': 'Cortex is unreachable. Check the connection',
  'error.timeout': 'The model took too long to answer. Try again',
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
  'input.examples.1': 'La sonda Voyager 1',
  'input.examples.2': 'Ada Lovelace',
  'input.examples.3': 'La llegada a la Luna en 1969',
  'input.examples.4': 'Kioto',
  'input.examples.5': 'La sucesión de Fibonacci',
  'input.examples.6': 'Blade Runner (1982)',
  'input.counter': '{count} / {max}',
  'input.tooLong': 'LA CONSULTA SUPERA LOS {max} CARACTERES',

  'topbar.newQuery': 'NUEVA CONSULTA',
  'topbar.settings': 'Configuración',
  'topbar.signature': 'Firma de la escena',

  'loading.step1': 'ANALIZANDO CONSULTA',
  'loading.step2': 'CONECTANDO FUENTES',
  'loading.step3': 'AGREGANDO DATOS',
  'loading.step4': 'CONSTRUYENDO GRAFO',
  'loading.step5': 'FINALIZANDO',
  'loading.step6': 'COMPONIENDO PRESENTACIÓN',

  'graph.overview': 'VISTA GENERAL',
  'graph.esc': 'ESC',

  'scene.archetype.constellation': 'CONSTELACIÓN',
  'scene.archetype.orbital': 'ORBITAL',
  'scene.archetype.spine': 'ESPINA',
  'scene.archetype.mosaic': 'MOSAICO',
  'scene.archetype.spiral': 'ESPIRAL',
  'scene.mood.calm': 'CALMO',
  'scene.mood.kinetic': 'CINÉTICO',
  'scene.mood.archival': 'ARCHIVO',
  'scene.mood.volatile': 'VOLÁTIL',
  'scene.kind.list': 'Lista',
  'scene.kind.timeline': 'Cronología',
  'scene.kind.stats': 'Estadísticas',
  'scene.kind.comparison': 'Comparación',
  'scene.kind.quote': 'Citas',
  'scene.kind.ranking': 'Ranking',
  'scene.kind.progress': 'Progreso',
  'scene.kind.keyvalue': 'Datos clave',
  'scene.kind.tags': 'Etiquetas',

  'dossier.title': 'DOSSIER',
  'dossier.summary': 'RESUMEN',
  'dossier.metadata': 'METADATOS',
  'dossier.connections': 'CONEXIONES',
  'dossier.spotlight': 'DESTACADO',
  'dossier.sources': 'FUENTES',
  'dossier.headline': 'Titular',
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
  'settings.motion': 'MOVIMIENTO',
  'settings.motionAuto': 'AUTO',
  'settings.motionReduced': 'REDUCIDO',
  'settings.motionHint': 'El modo reducido desactiva los bucles ambientales y las transiciones largas',

  'mobile.connections': 'CONEXIONES · {count} NODOS',
  'mobile.newQuery': 'NUEVA CONSULTA',

  'empty.title': 'SIN CONEXIONES',
  'empty.body': 'El escaneo devolvió una entidad sin grafo. Ajustá la consulta o volvé a ejecutar el escaneo.',
  'empty.retry': 'REINTENTAR ESCANEO',

  'error.parse': 'El motor devolvió una respuesta que no se pudo leer',
  'error.validation': 'El motor devolvió una respuesta que no pasó la validación',
  'error.upstream': 'La fuente de conocimiento no está disponible. Probá de nuevo en un momento',
  'error.network': 'No se puede alcanzar Cortex. Revisá la conexión',
  'error.timeout': 'El modelo tardó demasiado en responder. Probá de nuevo',
  'error.unknown': 'Error desconocido',
};

export const TRANSLATIONS: Record<Locale, Translations> = { en, es };
