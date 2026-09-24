import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Dev-only fixture capture and replay.
 * - CORTEX_CAPTURE_DIR=<dir>: every real stream writes <dir>/<slug>.json.
 * - CORTEX_FIXTURES=1: the stream endpoint replays files from CORTEX_FIXTURES_DIR
 *   (default server/fixtures) instead of calling Gemini.
 * Both modes fail closed: they require NODE_ENV=development, so an unset or
 * production NODE_ENV refuses them instead of enabling them silently.
 * Paths resolve from process.cwd() so source (tsx) and dist builds agree.
 */

export interface FixtureFile {
  query: string;
  lang: 'en' | 'es';
  preface: unknown;
  scene: unknown;
  timing?: { prefaceMs: number | null; sceneMs: number | null };
}

/** An explicitly declared development environment; anything else fails closed. */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

const refusals = new Set<string>();

/** Says once why a requested mode was refused, so failing closed is never silent. */
function refuseOnce(mode: string): void {
  if (refusals.has(mode)) return;
  refusals.add(mode);
  console.warn(`[cortex] ${mode} refused: NODE_ENV is "${process.env.NODE_ENV ?? 'unset'}", not "development"`);
}

export function fixturesEnabled(): boolean {
  if (process.env.CORTEX_FIXTURES !== '1') return false;
  if (!isDevelopment()) {
    refuseOnce('CORTEX_FIXTURES');
    return false;
  }
  return true;
}

export function captureDir(): string | null {
  const dir = process.env.CORTEX_CAPTURE_DIR?.trim();
  if (!dir) return null;
  if (!isDevelopment()) {
    refuseOnce('CORTEX_CAPTURE_DIR');
    return null;
  }
  return path.resolve(process.cwd(), dir);
}

function fixturesDir(): string {
  return path.resolve(process.cwd(), process.env.CORTEX_FIXTURES_DIR?.trim() || 'server/fixtures');
}

/** Lowercase ASCII slug, accents stripped, max 60 chars; non-English queries get a ".<lang>" suffix. */
export function slugify(query: string, lang: 'en' | 'es'): string {
  const base = query
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '') || 'query';
  return lang === 'en' ? base : `${base}.${lang}`;
}

export async function writeFixture(dir: string, fixture: FixtureFile): Promise<string> {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${slugify(fixture.query, fixture.lang)}.json`);
  await writeFile(file, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
  return file;
}

function tokens(slug: string): Set<string> {
  return new Set(slug.replace(/\.(en|es)$/, '').split('-').filter(t => t.length > 2));
}

let cycle = 0;

/** Closest fixture by slug token overlap (same language wins ties); cycles when nothing overlaps. */
export async function pickFixture(query: string, lang: 'en' | 'es'): Promise<FixtureFile | null> {
  const dir = fixturesDir();
  let names: string[];
  try {
    names = (await readdir(dir)).filter(n => n.endsWith('.json')).sort();
  } catch {
    return null;
  }
  if (names.length === 0) return null;

  const wanted = tokens(slugify(query, 'en'));
  let best: string | null = null;
  let bestScore = 0;
  for (const name of names) {
    const slug = name.slice(0, -'.json'.length);
    let score = 0;
    for (const t of tokens(slug)) if (wanted.has(t)) score += 1;
    if (score > 0 && slug.endsWith(`.${lang}`) === (lang !== 'en')) score += 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  const chosen = best ?? names[cycle++ % names.length];

  try {
    const parsed = JSON.parse(await readFile(path.join(dir, chosen), 'utf8')) as unknown;
    if (parsed === null || typeof parsed !== 'object' || !('scene' in parsed)) return null;
    return parsed as FixtureFile;
  } catch {
    return null;
  }
}

/**
 * Static landing questions for fixture mode, so screenshots and tests never
 * reach Google Trends or Gemini. Kept in code: every .json in the fixtures
 * directory is replayed as a scene.
 */
export const FIXTURE_TRENDING: Record<'en' | 'es', readonly string[]> = {
  en: [
    'Latest on the James Webb telescope discoveries this month',
    'Why are mortgage rates falling even as inflation stays sticky?',
    'iPhone vs Pixel: how do this year\'s flagship cameras compare?',
    'How does a solar storm disrupt GPS and power grids?',
    'How many people watched the Champions League final, by country?',
  ],
  es: [
    'Lo último sobre el lanzamiento de la misión Artemis a la Luna',
    '¿Por qué sube el dólar blue cuando se acerca fin de mes?',
    'River vs Boca: ¿cómo se comparan sus planteles esta temporada?',
    '¿Cómo funciona el aumento por movilidad de las jubilaciones?',
    '¿Cuánto creció el turismo extranjero en Argentina este año?',
  ],
};
