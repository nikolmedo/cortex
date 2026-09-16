import { z } from 'genkit';
import { CortexError } from './errors.js';

// ---------------------------------------------------------------------------
// Contract constants (mirrored byte-for-byte in src/domain/Scene.ts)
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
// Sanitizing helpers (mirrored byte-for-byte in src/domain/Scene.ts)
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
// Server-only zod helpers
// ---------------------------------------------------------------------------

function toText(value: unknown, max: number): string {
  if (typeof value === 'string') return sanitizeText(value, max);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, max);
  return '';
}

function toCode(value: unknown, max: number): string {
  return typeof value === 'string' ? sanitizeCode(value, max) : '';
}

function orUndefined(s: string): string | undefined {
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

/** Never-failing bounded string: non-strings become ''. */
const text = (max: number) => z.unknown().transform(v => toText(v, max));

/** Never-failing optional bounded string: empty results collapse to undefined. */
const optionalText = (max: number) => z.unknown().transform(v => orUndefined(toText(v, max)));

const hex = (fallback: string) => z.unknown().transform(v => hexOr(v, fallback));

const httpsUrl = z.unknown().transform(v => safeHttpsUrl(v));

// ---------------------------------------------------------------------------
// A. Wire schemas: handed to Gemini as `output.schema`.
// OpenAPI 3.0 subset only: no regex, no min/max, no record, no union, no
// catch/default/literal/nullable/trim. Descriptions are the model's guidance.
// ---------------------------------------------------------------------------

const WirePaletteSchema = z.object({
  primary: z.string().describe('Main accent color taken from the subject, as "#RRGGBB" including the leading "#".'),
  secondary: z.string().describe('Secondary color as "#RRGGBB" including the leading "#".'),
  accent: z.string().describe('Highlight color as "#RRGGBB" including the leading "#".'),
}).describe('Three distinct colors that fit the question. Each must read clearly on near-black (#05070C).');

const WireItemSchema = z.object({
  label: z.string().describe('Primary text of the item. Meaning depends on the module kind (see items).'),
  // Required on the wire on purpose: with structured output Gemini omitted the
  // optional `value` on every steps item. Unused values arrive as "" and the
  // strict schema drops them.
  value: z.string().describe(
    'Secondary short text: a date, a number with unit, a rank. For steps: the outcome of that step '
    + '(a result with units, a quantity, a time, or a resulting state), never empty. "" for kinds that do not use it.',
  ),
  detail: z.string().optional().describe('Supporting sentence: attribution, explanation of a step, meaning of a formula.'),
  weight: z.number().optional().describe('Relative magnitude 0-100. Used by stats, ranking, progress and chart kinds.'),
  side: z.enum(ITEM_SIDES).optional().describe('comparison: "a" or "b", the side this item belongs to. proscons: "a" = pro, "b" = con.'),
});

const WireModuleSchema = z.object({
  category: z.string().describe('Short module title, at most 40 characters, e.g. "Worked solution" or "Key dates".'),
  color: z.string().describe('Accent color for this module as a 6-digit hex string.'),
  image_query: z.string().optional().describe('Entity intent only: two to four English keywords for a stock image. Omit otherwise.'),
  kind: z.enum(FACT_KINDS).describe(
    'How this module is structured. list: plain facts. timeline: dated events. stats: numeric metrics. '
    + 'comparison: two sides contrasted aspect by aspect. quote: notable quotes. ranking: ordered by score. '
    + 'progress: percentages. keyvalue: attribute/value pairs. tags: short keywords. '
    + 'steps: ordered worked steps. formula: equations with their meaning. code: one code snippet in body. '
    + 'prose: one explanatory passage in body. proscons: advantages vs disadvantages. chart: a numeric series.',
  ),
  headline: z.string().optional().describe('One-line takeaway for the module, at most 140 characters.'),
  facts: z.array(z.string()).optional().describe(
    '2 to 6 plain one-line facts (at most 160 characters each), used as fallback text. Omit for code and prose.',
  ),
  body: z.string().optional().describe(
    'Only for code (the snippet, with newlines and indentation, at most 2400 characters) '
    + 'and prose (a passage of at most 1600 characters). Omit for every other kind.',
  ),
  value: z.string().optional().describe('Only for code: the language name, e.g. "python". Omit otherwise.'),
  items: z.array(WireItemSchema).optional().describe(
    'Structured items matching the kind. Per kind: '
    + 'timeline: value=date, label=event. '
    + 'stats: label=metric, value=number with unit, weight=0-100. '
    + 'comparison: side="a" or "b", label=aspect, value=that side\'s value. '
    + 'quote: label=quote text, detail=attribution. '
    + 'ranking: label=name, value=rank or score, weight=0-100. '
    + 'progress: label=what is measured, weight=0-100 percent, value=display value. '
    + 'keyvalue: label=key, value=value. tags and list: label only. '
    + 'steps: label=what the step does, detail=the full working of that step, value=the intermediate or final result. '
    + 'formula: label=the expression in plain text (e.g. "t = d / v"), detail=what it means. '
    + 'proscons: side="a" for a pro or "b" for a con, label=the point, detail=why. '
    + 'chart: label=x-axis point (a year, a category), value=the real number with unit, weight=0-100 relative magnitude. '
    + 'code and prose: omit items. Provide 3 to 6 items (up to 8 steps, 12 tags or 12 chart points).',
  ),
});

export const SceneWireSchema = z.object({
  intent: z.enum(SCENE_INTENTS).describe(
    'What the user is asking. entity: who/what something is. explanation: why or how something works. '
    + 'problem: a question with a computable or derivable answer. howto: how to do something. '
    + 'comparison: A versus B. analysis: evaluate, assess or predict. current: news or recent developments.',
  ),
  type: z.enum(VALID_TYPES).describe('Entity type of the subject; "concept" or "unknown" for non-entity intents.'),
  title: z.string().describe('Short title of the result, at most 120 characters.'),
  subtitle: z.string().describe('One-line qualifier, at most 160 characters.'),
  presentation: z.object({
    layout: z.enum(SCENE_LAYOUTS).describe(
      'Composition. focus: answer-first reading column. dossier: hero media plus attribute rail. '
      + 'split: two sides side by side. sequence: ordered chronology or procedure. mosaic: dense data grid.',
    ),
    mood: z.enum(SCENE_MOODS).describe('Motion and tone: calm, kinetic, archival or volatile.'),
    motif: z.enum(SCENE_MOTIFS).describe('Ambient field: flow, rings, grid or none.'),
    density: z.enum(SCENE_DENSITIES).describe('How much is shown at once: sparse, balanced or dense.'),
    palette: WirePaletteSchema,
  }).describe('How the result is presented. Decided before the answer is written so the interface can be themed while it streams.'),
  answer: z.object({
    headline: z.string().describe('The direct answer in one sentence, at most 220 characters. For problems, state the final result.'),
    body: z.array(z.string()).describe('1 to 8 paragraphs (at most 900 characters each) that fully answer the question.'),
    caveats: z.array(z.string()).optional().describe('Up to 3 short limitations, assumptions or uncertainties.'),
  }).describe('The answer, written first and complete.'),
  spotlight: z.object({
    kind: z.enum(SPOTLIGHT_KINDS).describe('stat: a headline number. quote: a memorable quote. callout: a key sentence.'),
    label: z.string().describe('The spotlight text: metric name, quote text or callout sentence.'),
    value: z.string().optional().describe('For stat: the number with unit. Otherwise omit.'),
    source: z.string().optional().describe('Attribution or source of the spotlight, if any.'),
  }).optional().describe('One standout element shown prominently. Optional.'),
  summary: z.string().optional().describe('Entity intent: two to four sentence summary. Otherwise omit.'),
  image_url: z.string().describe('Entity intent only: direct https image URL of the subject. Empty string otherwise or if unknown.'),
  image_query: z.string().optional().describe('Entity intent only: two to four English keywords for a stock image. Omit otherwise.'),
  meta: z.array(z.object({
    key: z.string().describe('Short attribute name, e.g. "Founded".'),
    value: z.string().describe('Short attribute value, e.g. "1998".'),
  })).optional().describe('Up to 8 key attributes shown as a compact strip.'),
  modules: z.array(WireModuleSchema).describe('0 to 8 structured modules that support the answer.'),
  followups: z.array(z.string()).optional().describe('Up to 4 natural next questions, each at most 160 characters.'),
});

export type SceneWire = z.infer<typeof SceneWireSchema>;

export const PrefaceWireSchema = z.object({
  intent: z.enum(SCENE_INTENTS).describe('What the user is asking (same meaning as in the full scene).'),
  title: z.string().describe('Short title for the result, at most 120 characters.'),
  layout: z.enum(SCENE_LAYOUTS).describe('Composition that fits the intent.'),
  mood: z.enum(SCENE_MOODS).describe('Motion and tone.'),
  palette: WirePaletteSchema,
  plan: z.array(z.string()).describe('Exactly 3 short research steps specific to this question, at most 120 characters each.'),
});

// ---------------------------------------------------------------------------
// B. Strict domain schemas: validate and normalise untrusted output.
// Only `title` (missing/empty) and `modules` (not an array) fail the scene
// parse; every other field falls back to a safe value.
// ---------------------------------------------------------------------------

export const ScenePaletteSchema = z.object({
  primary: hex(DEFAULT_PALETTE.primary),
  secondary: hex(DEFAULT_PALETTE.secondary),
  accent: hex(DEFAULT_PALETTE.accent),
});
export type ScenePalette = z.infer<typeof ScenePaletteSchema>;

function freshPalette(): ScenePalette {
  return { ...DEFAULT_PALETTE };
}

const intentSchema = z.enum(SCENE_INTENTS).catch('explanation');

export const ScenePresentationSchema = z.object({
  layout: z.enum(SCENE_LAYOUTS).optional().catch(undefined),
  mood: z.enum(SCENE_MOODS).catch('calm'),
  motif: z.enum(SCENE_MOTIFS).catch('flow'),
  density: z.enum(SCENE_DENSITIES).catch('balanced'),
  palette: ScenePaletteSchema.catch(freshPalette),
});

export interface ScenePresentation {
  layout: SceneLayout;
  mood: SceneMood;
  motif: SceneMotif;
  density: SceneDensity;
  palette: ScenePalette;
}

export const SceneSpotlightSchema = z.object({
  kind: z.enum(SPOTLIGHT_KINDS).catch('callout'),
  label: text(LIMITS.label),
  value: optionalText(LIMITS.value),
  source: optionalText(LIMITS.label),
});
export type SceneSpotlight = z.infer<typeof SceneSpotlightSchema>;

export const SceneSourceSchema = z.object({
  title: text(LIMITS.title),
  url: httpsUrl,
});
export type SceneSource = z.infer<typeof SceneSourceSchema>;

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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toWeight(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
}

function toItem(raw: unknown, kind: FactKind): SceneItem | null {
  if (!isObject(raw)) return null;
  const label = kind === 'formula' ? toCode(raw.label, LIMITS.formula) : toText(raw.label, LIMITS.label);
  if (label === '') return null;
  const item: SceneItem = { label };
  const value = orUndefined(toText(raw.value, LIMITS.value));
  const detail = orUndefined(toText(raw.detail, kind === 'steps' ? LIMITS.stepDetail : LIMITS.detail));
  const weight = toWeight(raw.weight);
  if (value !== undefined) item.value = value;
  if (detail !== undefined) item.detail = detail;
  if (weight !== undefined && kindUsesWeight(kind)) item.weight = weight;
  if ((raw.side === 'a' || raw.side === 'b') && kindUsesSide(kind)) item.side = raw.side;
  return item;
}

export const SceneModuleSchema = z.object({
  category: text(LIMITS.categoryName),
  color: hex(DEFAULT_PALETTE.primary),
  image_query: text(LIMITS.imageQuery),
  kind: z.enum(FACT_KINDS).catch('list'),
  headline: optionalText(LIMITS.headline),
  facts: z.unknown(),
  body: z.unknown(),
  value: z.unknown(),
  items: z.unknown(),
}).transform((m): SceneModule => {
  const cap = itemCap(m.kind);
  const module: SceneModule = {
    category: m.category,
    color: m.color,
    image_query: m.image_query,
    kind: m.kind,
    facts: textList(m.facts, LIMITS.fact, cap),
  };
  if (m.headline !== undefined) module.headline = m.headline;
  if (m.kind === 'code') {
    const body = toCode(m.body, LIMITS.code);
    const language = toText(m.value, LIMITS.value);
    if (body !== '') module.body = body;
    if (language !== '') module.value = language;
  } else if (m.kind === 'prose') {
    const body = toText(m.body, LIMITS.prose);
    if (body !== '') module.body = body;
  }
  if (Array.isArray(m.items)) {
    const items: SceneItem[] = [];
    for (const raw of m.items) {
      if (items.length >= cap) break;
      const item = toItem(raw, m.kind);
      if (item) items.push(item);
    }
    if (items.length > 0) module.items = items;
  }
  return module;
});

export interface SceneAnswer {
  headline: string;
  body: string[];
  caveats?: string[];
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

function toMetaRecord(raw: unknown): Record<string, string> {
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

function parseEach<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, list: unknown[]): T[] {
  const out: T[] = [];
  for (const el of list) {
    const r = schema.safeParse(el);
    if (r.success) out.push(r.data);
  }
  return out;
}

export const SceneSchema = z.object({
  intent: intentSchema,
  type: z.enum(VALID_TYPES).catch('unknown'),
  title: text(LIMITS.title).pipe(z.string().min(1, 'title is required')),
  subtitle: text(LIMITS.subtitle),
  answer: z.unknown().transform(toAnswer),
  summary: text(LIMITS.summary),
  image_url: httpsUrl,
  image_query: text(LIMITS.imageQuery),
  meta: z.unknown().transform(toMetaRecord),
  presentation: ScenePresentationSchema.catch(() => ({
    layout: undefined, mood: 'calm' as const, motif: 'flow' as const, density: 'balanced' as const, palette: freshPalette(),
  })),
  spotlight: SceneSpotlightSchema.optional().catch(undefined).transform(s =>
    s == null || s.label === '' ? undefined : s,
  ),
  modules: z.array(z.unknown()).transform(list =>
    parseEach(SceneModuleSchema, list).slice(0, LIMITS.maxModules),
  ),
  followups: z.unknown().transform(v => {
    const list = textList(v, LIMITS.followup, LIMITS.maxFollowups);
    return list.length > 0 ? list : undefined;
  }),
  sources: z.array(z.unknown()).optional().catch(undefined).transform(list => {
    if (list == null) return undefined;
    const sources = parseEach(SceneSourceSchema, list)
      .filter(s => s.url !== '')
      .slice(0, LIMITS.maxSources);
    return sources.length > 0 ? sources : undefined;
  }),
}).transform((s): Scene => {
  const answer = s.answer;
  if (answer.headline === '') answer.headline = (s.subtitle || s.summary).slice(0, LIMITS.answerHeadline);
  const scene: Scene = {
    version: SCENE_VERSION,
    intent: s.intent,
    type: s.type,
    title: s.title,
    subtitle: s.subtitle,
    answer,
    summary: s.summary,
    image_url: s.image_url,
    image_query: s.image_query,
    meta: s.meta,
    presentation: { ...s.presentation, layout: s.presentation.layout ?? LAYOUT_BY_INTENT[s.intent] },
    modules: s.modules,
  };
  if (s.spotlight) scene.spotlight = s.spotlight;
  if (s.followups) scene.followups = s.followups;
  if (s.sources) scene.sources = s.sources;
  return scene;
});

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

export interface ScenePreface {
  intent: SceneIntent;
  title: string;
  layout: SceneLayout;
  mood: SceneMood;
  palette: ScenePalette;
  plan: string[];
}

const PrefaceSchema = z.object({
  intent: intentSchema,
  title: text(LIMITS.title),
  layout: z.enum(SCENE_LAYOUTS).optional().catch(undefined),
  mood: z.enum(SCENE_MOODS).catch('calm'),
  palette: ScenePaletteSchema.catch(freshPalette),
  plan: z.unknown().transform(v => textList(v, LIMITS.planStep, LIMITS.maxPlan)),
}).transform((p): ScenePreface => ({ ...p, layout: p.layout ?? LAYOUT_BY_INTENT[p.intent] }));

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/** Validates and normalises untrusted model output; throws CortexError on structural failure. */
export function validateScene(raw: unknown): Scene {
  const result = SceneSchema.safeParse(raw);
  if (!result.success) {
    throw new CortexError(`Scene validation failed: ${result.error.message}`, 'VALIDATION_ERROR');
  }
  return result.data;
}

/** Normalises an untrusted preface; returns null when it is not an object. Never throws. */
export function validatePreface(raw: unknown): ScenePreface | null {
  if (!isObject(raw)) return null;
  const result = PrefaceSchema.safeParse(raw);
  return result.success ? result.data : null;
}
