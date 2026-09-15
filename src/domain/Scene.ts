import type { GraphCategory, GraphData, GraphDataType } from './GraphData';
import { VALID_TYPES } from './GraphData';

// ---------------------------------------------------------------------------
// Constants (mirror of server/domain/Scene.ts; keep both in sync)
// ---------------------------------------------------------------------------

export const SCENE_ARCHETYPES = ['constellation', 'orbital', 'spine', 'mosaic', 'spiral'] as const;
export const SCENE_MOODS = ['calm', 'kinetic', 'archival', 'volatile'] as const;
export const SCENE_MOTIFS = ['hex', 'lattice', 'wave', 'rings', 'none'] as const;
export const SCENE_DENSITIES = ['sparse', 'balanced', 'dense'] as const;
export const FACT_KINDS = [
  'list', 'timeline', 'stats', 'comparison', 'quote', 'ranking', 'progress', 'keyvalue', 'tags',
] as const;
export const SPOTLIGHT_KINDS = ['stat', 'quote', 'callout'] as const;
export const ITEM_SIDES = ['a', 'b'] as const;
export const SCENE_VERSION = 2;

export const LIMITS = {
  title: 120,
  subtitle: 160,
  summary: 900,
  fact: 160,
  label: 160,
  value: 80,
  detail: 240,
  headline: 140,
  categoryName: 40,
  maxCategories: 8,
  maxItems: 6,
  maxMeta: 8,
  maxSources: 8,
  maxTags: 12,
  imageQuery: 80,
  url: 2048,
} as const;

export type SceneArchetype = typeof SCENE_ARCHETYPES[number];
export type SceneMood = typeof SCENE_MOODS[number];
export type SceneMotif = typeof SCENE_MOTIFS[number];
export type SceneDensity = typeof SCENE_DENSITIES[number];
export type FactKind = typeof FACT_KINDS[number];
export type SpotlightKind = typeof SPOTLIGHT_KINDS[number];
export type ItemSide = typeof ITEM_SIDES[number];

// ---------------------------------------------------------------------------
// Types (structurally identical to the server's inferred output types)
// ---------------------------------------------------------------------------

export interface ScenePalette {
  primary: string;
  secondary: string;
  accent: string;
}

export interface ScenePresentation {
  archetype: SceneArchetype;
  mood: SceneMood;
  motif: SceneMotif;
  density: SceneDensity;
  palette: ScenePalette;
}

export interface SceneSpotlight {
  kind: SpotlightKind;
  label: string;
  value?: string;
  source?: string;
}

export interface SceneSource {
  title: string;
  url: string;
}

export interface SceneItem {
  label: string;
  value?: string;
  detail?: string;
  /** Clamped to 0-100 when present. */
  weight?: number;
  side?: ItemSide;
}

export interface SceneCategory extends GraphCategory {
  category: string;
  /** Validated 6-digit hex. */
  color: string;
  image_query: string;
  kind: FactKind;
  headline?: string;
  facts: string[];
  /** Present only when non-empty. */
  items?: SceneItem[];
}

export interface Scene extends GraphData {
  version: 2;
  type: GraphDataType;
  title: string;
  subtitle: string;
  summary: string;
  /** Empty string or a validated https URL. */
  image_url: string;
  image_query: string;
  meta: Record<string, string>;
  presentation: ScenePresentation;
  spotlight?: SceneSpotlight;
  graph: SceneCategory[];
  sources?: SceneSource[];
}

export const DEFAULT_PALETTE: Readonly<ScenePalette> = Object.freeze({
  primary: '#00D4FF',
  secondary: '#7B2FBE',
  accent: '#FF3C6E',
});

export const DEFAULT_PRESENTATION: Readonly<ScenePresentation> = Object.freeze({
  archetype: 'constellation',
  mood: 'calm',
  motif: 'hex',
  density: 'balanced',
  palette: DEFAULT_PALETTE,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function isHex(s: unknown): s is string {
  return typeof s === 'string' && HEX_RE.test(s);
}

/** Strips control characters, neutralises angle brackets, collapses whitespace and truncates. */
export function sanitizeText(s: string, max: number): string {
  return s
    .replace(CONTROL_RE, '')
    .replace(/</g, '\u2039')
    .replace(/>/g, '\u203A')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Returns the URL untouched when it is a well-formed https URL, otherwise ''. */
export function safeHttpsUrl(s: unknown): string {
  if (typeof s !== 'string') return '';
  const url = s.trim();
  if (url === '' || url.length > LIMITS.url || /\s/.test(url)) return '';
  try {
    return new URL(url).protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

export function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function toText(value: unknown, max: number): string {
  if (typeof value === 'string') return sanitizeText(value, max);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, max);
  return '';
}

function optionalText(value: unknown, max: number): string | undefined {
  const s = toText(value, max);
  return s === '' ? undefined : s;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function itemCap(kind: FactKind): number {
  return kind === 'tags' ? LIMITS.maxTags : LIMITS.maxItems;
}

function toWeight(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
}

function toItem(raw: unknown): SceneItem | null {
  if (!isObject(raw)) return null;
  const label = toText(raw.label, LIMITS.label);
  if (label === '') return null;
  const item: SceneItem = { label };
  const value = optionalText(raw.value, LIMITS.value);
  const detail = optionalText(raw.detail, LIMITS.detail);
  const weight = toWeight(raw.weight);
  if (value !== undefined) item.value = value;
  if (detail !== undefined) item.detail = detail;
  if (weight !== undefined) item.weight = weight;
  if (raw.side === 'a' || raw.side === 'b') item.side = raw.side;
  return item;
}

function toCategory(raw: unknown): SceneCategory | null {
  if (!isObject(raw)) return null;
  const kind = asEnum(raw.kind, FACT_KINDS, 'list');
  const cap = itemCap(kind);
  const facts: string[] = [];
  if (Array.isArray(raw.facts)) {
    for (const f of raw.facts) {
      if (facts.length >= cap) break;
      const s = toText(f, LIMITS.fact);
      if (s !== '') facts.push(s);
    }
  }
  let items: SceneItem[] | undefined;
  if (Array.isArray(raw.items)) {
    const list: SceneItem[] = [];
    for (const it of raw.items) {
      if (list.length >= cap) break;
      const item = toItem(it);
      if (item) list.push(item);
    }
    if (list.length > 0) items = list;
  }
  const category: SceneCategory = {
    category: toText(raw.category, LIMITS.categoryName),
    color: isHex(raw.color) ? raw.color : DEFAULT_PALETTE.primary,
    image_query: toText(raw.image_query, LIMITS.imageQuery),
    kind,
    facts,
  };
  const headline = optionalText(raw.headline, LIMITS.headline);
  if (headline !== undefined) category.headline = headline;
  if (items) category.items = items;
  return category;
}

function toMeta(raw: unknown): Record<string, string> {
  const pairs: Array<[unknown, unknown]> = Array.isArray(raw)
    ? raw.map(e => (isObject(e) ? [e.key, e.value] : ['', '']) as [unknown, unknown])
    : isObject(raw)
      ? Object.entries(raw)
      : [];
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of pairs) {
    if (count >= LIMITS.maxMeta) break;
    const key = toText(k, LIMITS.value);
    const value = toText(v, LIMITS.label);
    if (key === '' || value === '' || Object.prototype.hasOwnProperty.call(out, key)) continue;
    out[key] = value;
    count += 1;
  }
  return out;
}

function toPresentation(raw: unknown): ScenePresentation {
  if (!isObject(raw)) return { ...DEFAULT_PRESENTATION, palette: { ...DEFAULT_PALETTE } };
  const palette = isObject(raw.palette) ? raw.palette : {};
  return {
    archetype: asEnum(raw.archetype, SCENE_ARCHETYPES, DEFAULT_PRESENTATION.archetype),
    mood: asEnum(raw.mood, SCENE_MOODS, DEFAULT_PRESENTATION.mood),
    motif: asEnum(raw.motif, SCENE_MOTIFS, DEFAULT_PRESENTATION.motif),
    density: asEnum(raw.density, SCENE_DENSITIES, DEFAULT_PRESENTATION.density),
    palette: {
      primary: isHex(palette.primary) ? palette.primary : DEFAULT_PALETTE.primary,
      secondary: isHex(palette.secondary) ? palette.secondary : DEFAULT_PALETTE.secondary,
      accent: isHex(palette.accent) ? palette.accent : DEFAULT_PALETTE.accent,
    },
  };
}

function toSpotlight(raw: unknown): SceneSpotlight | undefined {
  if (!isObject(raw)) return undefined;
  const label = toText(raw.label, LIMITS.label);
  if (label === '') return undefined;
  const spotlight: SceneSpotlight = { kind: asEnum(raw.kind, SPOTLIGHT_KINDS, 'callout'), label };
  const value = optionalText(raw.value, LIMITS.value);
  const source = optionalText(raw.source, LIMITS.label);
  if (value !== undefined) spotlight.value = value;
  if (source !== undefined) spotlight.source = source;
  return spotlight;
}

function toSources(raw: unknown): SceneSource[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: SceneSource[] = [];
  for (const s of raw) {
    if (out.length >= LIMITS.maxSources) break;
    if (!isObject(s)) continue;
    const url = safeHttpsUrl(s.url);
    if (url === '') continue;
    out.push({ title: toText(s.title, LIMITS.title), url });
  }
  return out.length > 0 ? out : undefined;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Normalises an untrusted payload (wire Scene or legacy GraphData) into a Scene.
 * Applies the same rules as the server strict schema. Throws only when `title`
 * is missing/empty or `graph` is not an array.
 */
export function sanitizeScene(raw: unknown): Scene {
  if (!isObject(raw)) throw new Error('Invalid scene: payload is not an object');
  const title = toText(raw.title, LIMITS.title);
  if (title === '') throw new Error('Invalid scene: title is missing');
  if (!Array.isArray(raw.graph)) throw new Error('Invalid scene: graph is not an array');

  const graph: SceneCategory[] = [];
  for (const c of raw.graph) {
    if (graph.length >= LIMITS.maxCategories) break;
    const category = toCategory(c);
    if (category) graph.push(category);
  }

  const scene: Scene = {
    version: SCENE_VERSION,
    type: asEnum(raw.type, VALID_TYPES, 'unknown'),
    title,
    subtitle: toText(raw.subtitle, LIMITS.subtitle),
    summary: toText(raw.summary, LIMITS.summary),
    image_url: safeHttpsUrl(raw.image_url),
    image_query: toText(raw.image_query, LIMITS.imageQuery),
    meta: toMeta(raw.meta),
    presentation: toPresentation(raw.presentation),
    graph,
  };
  const spotlight = toSpotlight(raw.spotlight);
  const sources = toSources(raw.sources);
  if (spotlight) scene.spotlight = spotlight;
  if (sources) scene.sources = sources;
  return scene;
}

/** Primary palette color of the scene. */
export function sceneAccent(scene: Scene): string {
  return scene.presentation.palette.primary;
}

/** Category kind with the 'list' fallback for not-yet-sanitized data. */
export function categoryKind(cat: Pick<SceneCategory, 'kind'> | GraphCategory): FactKind {
  return (cat as Partial<SceneCategory>).kind ?? 'list';
}
