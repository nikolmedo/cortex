// ---------------------------------------------------------------------------
// Contract constants (mirrored byte-for-byte in server/domain/Scene.ts)
// ---------------------------------------------------------------------------

export const VALID_TYPES = [
  'person', 'place', 'product', 'film', 'series', 'company',
  'event', 'concept', 'sports_team', 'album', 'book', 'unknown',
] as const;
export const SCENE_INTENTS = [
  'entity', 'explanation', 'problem', 'howto', 'comparison', 'analysis', 'current',
] as const;
export const SCENE_LAYOUTS = ['focus', 'dossier', 'split', 'sequence', 'mosaic'] as const;
export const SCENE_MOODS = ['calm', 'kinetic', 'archival', 'volatile'] as const;
export const SCENE_MOTIFS = ['flow', 'rings', 'grid', 'none'] as const;
export const SCENE_DENSITIES = ['sparse', 'balanced', 'dense'] as const;
export const FACT_KINDS = [
  'list', 'timeline', 'stats', 'comparison', 'quote', 'ranking', 'progress', 'keyvalue', 'tags',
  'steps', 'formula', 'code', 'prose', 'proscons', 'chart',
] as const;
export const SPOTLIGHT_KINDS = ['stat', 'quote', 'callout'] as const;
export const ITEM_SIDES = ['a', 'b'] as const;
export const SCENE_VERSION = 3;

export const LIMITS = {
  title: 120,
  subtitle: 160,
  summary: 900,
  answerHeadline: 220,
  paragraph: 900,
  maxParagraphs: 8,
  caveat: 240,
  maxCaveats: 3,
  fact: 160,
  label: 160,
  value: 80,
  detail: 240,
  stepDetail: 480,
  formula: 240,
  code: 2400,
  prose: 1600,
  headline: 140,
  categoryName: 40,
  maxModules: 8,
  maxItems: 6,
  maxSteps: 8,
  maxChartPoints: 12,
  maxMeta: 8,
  maxSources: 8,
  maxTags: 12,
  followup: 160,
  maxFollowups: 4,
  planStep: 120,
  maxPlan: 3,
  imageQuery: 80,
  url: 2048,
} as const;

/** Layout used when the model omits or corrupts `presentation.layout`. */
export const LAYOUT_BY_INTENT = {
  entity: 'dossier',
  explanation: 'focus',
  problem: 'focus',
  howto: 'sequence',
  comparison: 'split',
  analysis: 'focus',
  current: 'sequence',
} as const;

export const DEFAULT_PALETTE = Object.freeze({
  primary: '#7FD8FF',
  secondary: '#8C9EFF',
  accent: '#5EF2C2',
});

export type SceneType = typeof VALID_TYPES[number];
export type SceneIntent = typeof SCENE_INTENTS[number];
export type SceneLayout = typeof SCENE_LAYOUTS[number];
export type SceneMood = typeof SCENE_MOODS[number];
export type SceneMotif = typeof SCENE_MOTIFS[number];
export type SceneDensity = typeof SCENE_DENSITIES[number];
export type FactKind = typeof FACT_KINDS[number];
export type SpotlightKind = typeof SPOTLIGHT_KINDS[number];
export type ItemSide = typeof ITEM_SIDES[number];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const BARE_HEX_RE = /^[0-9a-fA-F]{6}$/;
const CONTROL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// ---------------------------------------------------------------------------
// Sanitizing helpers (mirrored byte-for-byte in server/domain/Scene.ts)
// ---------------------------------------------------------------------------

/**
 * Truncates to at most `max` characters. When a cut is needed it ends at the
 * last word boundary (when that keeps at least 60% of the budget) with an ellipsis.
 */
export function truncateText(input: string, max: number): string {
  if (input.length <= max) return input;
  if (max < 2) return input.slice(0, max);
  const cut = input.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  const head = space >= Math.floor(max * 0.6) ? cut.slice(0, space) : cut;
  return `${head.replace(/[\s,;:·–—-]+$/, '')}…`;
}

/** Strips control characters, neutralises angle brackets, collapses whitespace and truncates at a word boundary. */
export function sanitizeText(input: string, max: number): string {
  return truncateText(input
    .replace(CONTROL_RE, '')
    .replace(/</g, '‹')
    .replace(/>/g, '›')
    .replace(/\s+/g, ' ')
    .trim(), max);
}

/**
 * For code bodies and formula labels only: normalises newlines, strips control
 * characters except newline and tab, keeps angle brackets and indentation,
 * drops leading blank lines and trailing whitespace, and truncates.
 * The result must only ever be rendered as a React text node.
 */
export function sanitizeCode(input: string, max: number): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_RE, '')
    .replace(/^(?:[ \t]*\n)+/, '')
    .replace(/\s+$/, '')
    .slice(0, max);
}

/** Returns the URL untouched when it is a well-formed https URL, otherwise ''. */
export function safeHttpsUrl(input: unknown): string {
  if (typeof input !== 'string') return '';
  const s = input.trim();
  if (s === '' || s.length > LIMITS.url || /\s/.test(s)) return '';
  try {
    return new URL(s).protocol === 'https:' ? s : '';
  } catch {
    return '';
  }
}

export function isHex(input: unknown): input is string {
  return typeof input === 'string' && HEX_RE.test(input);
}

/** Adds the missing "#" to a bare 6-digit hex ("7FD8FF" -> "#7FD8FF"); anything else is returned untouched. */
export function normalizeHex(input: unknown): unknown {
  return typeof input === 'string' && BARE_HEX_RE.test(input) ? `#${input}` : input;
}

/** Hue, saturation and lightness in 0-1 from a validated "#RRGGBB". */
function toHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslChannel(p: number, q: number, t: number): number {
  const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
  if (x < 1 / 6) return p + (q - p) * 6 * x;
  if (x < 1 / 2) return q;
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
  return p;
}

function fromHsl(h: number, s: number, l: number): string {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => Math.round(hslChannel(p, q, t) * 255).toString(16).padStart(2, '0');
  return `#${channel(h + 1 / 3)}${channel(h)}${channel(h - 1 / 3)}`;
}

/**
 * Scene colors are light emitted on a near-black page. A dark or washed-out
 * choice (a mid-red, a navy, a muted stock swatch) is lifted into the readable
 * band instead of being discarded; near-greys are deliberate and stay as they are.
 */
export function luminousHex(hex: string): string {
  const [h, s, l] = toHsl(hex);
  if (s < 0.08) return hex;
  const saturation = Math.max(s, 0.45);
  const lightness = Math.min(0.82, Math.max(0.58, l));
  return saturation === s && lightness === l ? hex : fromHsl(h, saturation, lightness);
}

/** The validated 6-digit hex (bare digits accepted, dark values lifted), or the fallback. */
export function hexOr(input: unknown, fallback: string): string {
  const value = normalizeHex(input);
  return isHex(value) ? luminousHex(value) : fallback;
}

/** Maximum number of items a module of this kind keeps. */
export function itemCap(kind: FactKind): number {
  if (kind === 'tags') return LIMITS.maxTags;
  if (kind === 'steps') return LIMITS.maxSteps;
  if (kind === 'chart') return LIMITS.maxChartPoints;
  return LIMITS.maxItems;
}

/** Item `side` is kept only for these kinds. */
export function kindUsesSide(kind: FactKind): boolean {
  return kind === 'comparison' || kind === 'proscons';
}

/** Item `weight` is kept only for these kinds. */
export function kindUsesWeight(kind: FactKind): boolean {
  return kind === 'stats' || kind === 'ranking' || kind === 'progress' || kind === 'chart';
}

// ---------------------------------------------------------------------------
// Types (structurally identical to the server's output types)
// ---------------------------------------------------------------------------

export interface ScenePalette {
  primary: string;
  secondary: string;
  accent: string;
}

export interface ScenePresentation {
  layout: SceneLayout;
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

export interface SceneModule {
  category: string;
  /** Validated 6-digit hex. */
  color: string;
  image_query: string;
  kind: FactKind;
  headline?: string;
  facts: string[];
  /** code: sanitizeCode output; prose: sanitizeText output; absent otherwise. */
  body?: string;
  /** code only: language name. */
  value?: string;
  /** Present only when non-empty. */
  items?: SceneItem[];
}

export interface SceneAnswer {
  headline: string;
  body: string[];
  caveats?: string[];
}

export interface Scene {
  version: typeof SCENE_VERSION;
  intent: SceneIntent;
  type: SceneType;
  title: string;
  subtitle: string;
  answer: SceneAnswer;
  summary: string;
  /** Empty string or a validated https URL. */
  image_url: string;
  image_query: string;
  meta: Record<string, string>;
  presentation: ScenePresentation;
  spotlight?: SceneSpotlight;
  modules: SceneModule[];
  followups?: string[];
  sources?: SceneSource[];
}

/** Fast first read of the question, streamed before the full scene. */
export interface ScenePreface {
  intent: SceneIntent;
  title: string;
  layout: SceneLayout;
  mood: SceneMood;
  palette: ScenePalette;
  plan: string[];
}

export const DEFAULT_PRESENTATION: Readonly<ScenePresentation> = Object.freeze({
  layout: 'focus',
  mood: 'calm',
  motif: 'flow',
  density: 'balanced',
  palette: DEFAULT_PALETTE,
});

// ---------------------------------------------------------------------------
// Client-side normalisers (same rules as the server strict schemas)
// ---------------------------------------------------------------------------

export function asEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function toText(value: unknown, max: number): string {
  if (typeof value === 'string') return sanitizeText(value, max);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, max);
  return '';
}

function toCode(value: unknown, max: number): string {
  return typeof value === 'string' ? sanitizeCode(value, max) : '';
}

function optionalText(value: unknown, max: number): string | undefined {
  const s = toText(value, max);
  return s === '' ? undefined : s;
}

function textList(raw: unknown, max: number, cap: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const el of raw) {
    if (out.length >= cap) break;
    const s = toText(el, max);
    if (s !== '') out.push(s);
  }
  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toWeight(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
}

function toPalette(raw: unknown): ScenePalette {
  const p = isObject(raw) ? raw : {};
  return {
    primary: hexOr(p.primary, DEFAULT_PALETTE.primary),
    secondary: hexOr(p.secondary, DEFAULT_PALETTE.secondary),
    accent: hexOr(p.accent, DEFAULT_PALETTE.accent),
  };
}

function toItem(raw: unknown, kind: FactKind): SceneItem | null {
  if (!isObject(raw)) return null;
  const label = kind === 'formula' ? toCode(raw.label, LIMITS.formula) : toText(raw.label, LIMITS.label);
  if (label === '') return null;
  const item: SceneItem = { label };
  const value = optionalText(raw.value, LIMITS.value);
  const detail = optionalText(raw.detail, kind === 'steps' ? LIMITS.stepDetail : LIMITS.detail);
  const weight = toWeight(raw.weight);
  if (value !== undefined) item.value = value;
  if (detail !== undefined) item.detail = detail;
  if (weight !== undefined && kindUsesWeight(kind)) item.weight = weight;
  if ((raw.side === 'a' || raw.side === 'b') && kindUsesSide(kind)) item.side = raw.side;
  return item;
}

function toModule(raw: unknown): SceneModule | null {
  if (!isObject(raw)) return null;
  const kind = asEnum(raw.kind, FACT_KINDS, 'list');
  const cap = itemCap(kind);
  const module: SceneModule = {
    category: toText(raw.category, LIMITS.categoryName),
    color: hexOr(raw.color, DEFAULT_PALETTE.primary),
    image_query: toText(raw.image_query, LIMITS.imageQuery),
    kind,
    facts: textList(raw.facts, LIMITS.fact, cap),
  };
  const headline = optionalText(raw.headline, LIMITS.headline);
  if (headline !== undefined) module.headline = headline;
  if (kind === 'code') {
    const body = toCode(raw.body, LIMITS.code);
    const language = toText(raw.value, LIMITS.value);
    if (body !== '') module.body = body;
    if (language !== '') module.value = language;
  } else if (kind === 'prose') {
    const body = toText(raw.body, LIMITS.prose);
    if (body !== '') module.body = body;
  }
  if (Array.isArray(raw.items)) {
    const items: SceneItem[] = [];
    for (const it of raw.items) {
      if (items.length >= cap) break;
      const item = toItem(it, kind);
      if (item) items.push(item);
    }
    if (items.length > 0) module.items = items;
  }
  return module;
}

function toAnswer(raw: unknown): SceneAnswer {
  const src = isObject(raw) ? raw : {};
  const answer: SceneAnswer = {
    headline: toText(src.headline, LIMITS.answerHeadline),
    body: textList(src.body, LIMITS.paragraph, LIMITS.maxParagraphs),
  };
  const caveats = textList(src.caveats, LIMITS.caveat, LIMITS.maxCaveats);
  if (caveats.length > 0) answer.caveats = caveats;
  return answer;
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

function toPresentation(raw: unknown, intent: SceneIntent): ScenePresentation {
  const p = isObject(raw) ? raw : {};
  return {
    layout: asEnum<SceneLayout>(p.layout, SCENE_LAYOUTS, LAYOUT_BY_INTENT[intent]),
    mood: asEnum(p.mood, SCENE_MOODS, DEFAULT_PRESENTATION.mood),
    motif: asEnum(p.motif, SCENE_MOTIFS, DEFAULT_PRESENTATION.motif),
    density: asEnum(p.density, SCENE_DENSITIES, DEFAULT_PRESENTATION.density),
    palette: toPalette(isObject(raw) ? p.palette : undefined),
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
// Entry points
// ---------------------------------------------------------------------------

/**
 * Normalises an untrusted scene payload. Applies the same rules as the server
 * strict schema. Throws only when `title` is missing/empty or `modules` is not
 * an array.
 */
export function sanitizeScene(raw: unknown): Scene {
  if (!isObject(raw)) throw new Error('Invalid scene: payload is not an object');
  const title = toText(raw.title, LIMITS.title);
  if (title === '') throw new Error('Invalid scene: title is missing');
  if (!Array.isArray(raw.modules)) throw new Error('Invalid scene: modules is not an array');

  const modules: SceneModule[] = [];
  for (const m of raw.modules) {
    if (modules.length >= LIMITS.maxModules) break;
    const module = toModule(m);
    if (module) modules.push(module);
  }

  const intent = asEnum(raw.intent, SCENE_INTENTS, 'explanation');
  const subtitle = toText(raw.subtitle, LIMITS.subtitle);
  const summary = toText(raw.summary, LIMITS.summary);
  const answer = toAnswer(raw.answer);
  if (answer.headline === '') answer.headline = (subtitle || summary).slice(0, LIMITS.answerHeadline);

  const scene: Scene = {
    version: SCENE_VERSION,
    intent,
    type: asEnum(raw.type, VALID_TYPES, 'unknown'),
    title,
    subtitle,
    answer,
    summary,
    image_url: safeHttpsUrl(raw.image_url),
    image_query: toText(raw.image_query, LIMITS.imageQuery),
    meta: toMeta(raw.meta),
    presentation: toPresentation(raw.presentation, intent),
    modules,
  };
  const spotlight = toSpotlight(raw.spotlight);
  const followups = textList(raw.followups, LIMITS.followup, LIMITS.maxFollowups);
  const sources = toSources(raw.sources);
  if (spotlight) scene.spotlight = spotlight;
  if (followups.length > 0) scene.followups = followups;
  if (sources) scene.sources = sources;
  return scene;
}

/** Normalises an untrusted preface; returns null when it is not an object. Never throws. */
export function sanitizePreface(raw: unknown): ScenePreface | null {
  if (!isObject(raw)) return null;
  const intent = asEnum(raw.intent, SCENE_INTENTS, 'explanation');
  return {
    intent,
    title: toText(raw.title, LIMITS.title),
    layout: asEnum<SceneLayout>(raw.layout, SCENE_LAYOUTS, LAYOUT_BY_INTENT[intent]),
    mood: asEnum(raw.mood, SCENE_MOODS, DEFAULT_PRESENTATION.mood),
    palette: toPalette(raw.palette),
    plan: textList(raw.plan, LIMITS.planStep, LIMITS.maxPlan),
  };
}
