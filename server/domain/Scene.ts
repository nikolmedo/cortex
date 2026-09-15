import { z } from 'genkit';
import { VALID_TYPES } from './GraphData.js';
import { CortexError } from './errors.js';

// ---------------------------------------------------------------------------
// Constants
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

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// ---------------------------------------------------------------------------
// Sanitizing helpers (shared by the strict schema; mirrored on the client)
// ---------------------------------------------------------------------------

/** Strips control characters, neutralises angle brackets and collapses whitespace. */
export function sanitizeText(input: string): string {
  return input
    .replace(CONTROL_RE, '')
    .replace(/</g, '\u2039')
    .replace(/>/g, '\u203A')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Returns the URL untouched when it is a well-formed https URL, otherwise ''. */
export function safeHttpsUrl(input: string): string {
  if (typeof input !== 'string') return '';
  const s = input.trim();
  if (s === '' || s.length > LIMITS.url || /\s/.test(s)) return '';
  try {
    return new URL(s).protocol === 'https:' ? s : '';
  } catch {
    return '';
  }
}

function toText(value: unknown, max: number): string {
  if (typeof value === 'string') return sanitizeText(value).slice(0, max);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, max);
  return '';
}

/** Never-failing bounded string: non-strings become ''. */
const text = (max: number) => z.unknown().transform(v => toText(v, max));

/** Never-failing optional bounded string: empty results collapse to undefined. */
const optionalText = (max: number) =>
  z.unknown().transform(v => {
    const s = toText(v, max);
    return s === '' ? undefined : s;
  });

const hex = (fallback: string) => z.string().regex(HEX_RE).catch(fallback);

const httpsUrl = z.unknown().transform(v => (typeof v === 'string' ? safeHttpsUrl(v) : ''));

// ---------------------------------------------------------------------------
// A. Wire schema: handed to Gemini as `output.schema`.
// OpenAPI 3.0 subset only: no regex, no min/max, no record, no union, no
// catch/default/literal/nullable/trim. Descriptions are the model's guidance.
// ---------------------------------------------------------------------------

const WireItemSchema = z.object({
  label: z.string().describe('Primary text of the item. Meaning depends on the category kind (see items).'),
  value: z.string().optional().describe('Secondary short text: a date, a number with unit, a rank, a display value.'),
  detail: z.string().optional().describe('One-sentence supporting detail or attribution. Optional.'),
  weight: z.number().optional().describe('Relative magnitude 0-100. Used by stats, ranking and progress kinds.'),
  side: z.enum(ITEM_SIDES).optional().describe('Only for comparison kind: "a" or "b", the side this item belongs to.'),
});

const WireCategorySchema = z.object({
  category: z.string().describe('Short category name, at most 40 characters, e.g. "Key dates" or "By the numbers".'),
  color: z.string().describe('Accent color for this category as a 6-digit hex string, e.g. "#00D4FF".'),
  image_query: z.string().describe('Two to four English keywords for a stock image that represents this category.'),
  kind: z.enum(FACT_KINDS).describe(
    'How the facts of this category are structured. list: plain facts. timeline: dated events. '
    + 'stats: numeric metrics. comparison: two sides contrasted. quote: notable quotes. '
    + 'ranking: ordered by rank or score. progress: percentages toward a goal. '
    + 'keyvalue: attribute/value pairs. tags: short keywords.',
  ),
  headline: z.string().optional().describe('Optional one-line takeaway for the category, at most 140 characters.'),
  facts: z.array(z.string()).describe(
    'Always required: 3 to 6 plain one-line facts (at most 160 characters each). '
    + 'This is the fallback text when items cannot be rendered.',
  ),
  items: z.array(WireItemSchema).optional().describe(
    'Structured items matching the kind. Per kind: '
    + 'timeline: value=date or year, label=event. '
    + 'stats: label=metric name, value=number with unit, weight=0-100 relative magnitude. '
    + 'comparison: side="a" or "b", label=aspect, value=that side\'s value. '
    + 'quote: label=quote text, detail=attribution. '
    + 'ranking: label=name, value=rank or score, weight=0-100. '
    + 'progress: label=what is measured, weight=0-100 percent, value=display value. '
    + 'keyvalue: label=key, value=value. '
    + 'tags: label only. '
    + 'list: label only. '
    + 'Provide 3 to 6 items (up to 12 for tags).',
  ),
});

export const SceneWireSchema = z.object({
  type: z.enum(VALID_TYPES).describe('Entity type of the subject.'),
  title: z.string().describe('Canonical name of the subject, at most 120 characters.'),
  subtitle: z.string().describe('One-line qualifier, at most 160 characters.'),
  summary: z.string().describe('Two to four sentence summary, at most 900 characters.'),
  image_url: z.string().describe('Direct https image URL of the subject, or an empty string if unknown.'),
  image_query: z.string().describe('Two to four English keywords for a stock image of the subject.'),
  meta: z.array(z.object({
    key: z.string().describe('Short attribute name, e.g. "Founded".'),
    value: z.string().describe('Short attribute value, e.g. "1998".'),
  })).describe('Up to 8 key facts shown as a compact attribute strip.'),
  presentation: z.object({
    archetype: z.enum(SCENE_ARCHETYPES).describe(
      'Spatial layout of the result. constellation: free scatter. orbital: rings around the subject. '
      + 'spine: vertical chronology. mosaic: dense grid. spiral: unfolding sequence.',
    ),
    mood: z.enum(SCENE_MOODS).describe('Motion and tone: calm, kinetic, archival or volatile.'),
    motif: z.enum(SCENE_MOTIFS).describe('Background pattern: hex, lattice, wave, rings or none.'),
    density: z.enum(SCENE_DENSITIES).describe('How much information is shown at once: sparse, balanced or dense.'),
    palette: z.object({
      primary: z.string().describe('Main accent color as 6-digit hex, e.g. "#00D4FF".'),
      secondary: z.string().describe('Secondary color as 6-digit hex.'),
      accent: z.string().describe('Highlight color as 6-digit hex.'),
    }).describe('Colors that fit the subject. Must be readable on a dark background.'),
  }).describe('How the result should be presented.'),
  spotlight: z.object({
    kind: z.enum(SPOTLIGHT_KINDS).describe('stat: a headline number. quote: a memorable quote. callout: a key sentence.'),
    label: z.string().describe('The spotlight text: metric name, quote text or callout sentence.'),
    value: z.string().optional().describe('For stat: the number with unit. Otherwise omit.'),
    source: z.string().optional().describe('Attribution or source of the spotlight, if any.'),
  }).optional().describe('One standout element shown prominently. Optional.'),
  graph: z.array(WireCategorySchema).describe('3 to 8 categories of facts about the subject.'),
});

export type SceneWire = z.infer<typeof SceneWireSchema>;

// ---------------------------------------------------------------------------
// B. Strict domain schema: validates and normalises untrusted output.
// Only `title` (missing/empty) and `graph` (not an array) fail the parse;
// every other field falls back to a safe value.
// ---------------------------------------------------------------------------

export const ScenePaletteSchema = z.object({
  primary: hex('#00D4FF'),
  secondary: hex('#7B2FBE'),
  accent: hex('#FF3C6E'),
});
export type ScenePalette = z.infer<typeof ScenePaletteSchema>;

export const DEFAULT_PALETTE: Readonly<ScenePalette> = Object.freeze({
  primary: '#00D4FF',
  secondary: '#7B2FBE',
  accent: '#FF3C6E',
});

export const DEFAULT_PRESENTATION: Readonly<{
  archetype: SceneArchetype;
  mood: SceneMood;
  motif: SceneMotif;
  density: SceneDensity;
  palette: Readonly<ScenePalette>;
}> = Object.freeze({
  archetype: 'constellation',
  mood: 'calm',
  motif: 'hex',
  density: 'balanced',
  palette: DEFAULT_PALETTE,
});

/** Fresh, mutable copy of the default presentation (never share the frozen constant). */
function freshPresentation(): ScenePresentation {
  return { ...DEFAULT_PRESENTATION, palette: { ...DEFAULT_PALETTE } };
}

export const ScenePresentationSchema = z.object({
  archetype: z.enum(SCENE_ARCHETYPES).catch(DEFAULT_PRESENTATION.archetype),
  mood: z.enum(SCENE_MOODS).catch(DEFAULT_PRESENTATION.mood),
  motif: z.enum(SCENE_MOTIFS).catch(DEFAULT_PRESENTATION.motif),
  density: z.enum(SCENE_DENSITIES).catch(DEFAULT_PRESENTATION.density),
  palette: ScenePaletteSchema.catch(() => ({ ...DEFAULT_PALETTE })),
});
export type ScenePresentation = z.infer<typeof ScenePresentationSchema>;

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

export const SceneItemSchema = z.object({
  label: text(LIMITS.label),
  value: optionalText(LIMITS.value),
  detail: optionalText(LIMITS.detail),
  weight: z.number().optional().catch(undefined).transform(w =>
    w == null || !Number.isFinite(w) ? undefined : Math.min(100, Math.max(0, w)),
  ),
  side: z.enum(ITEM_SIDES).optional().catch(undefined),
});
export type SceneItem = z.infer<typeof SceneItemSchema>;

function parseEach<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, list: unknown[]): T[] {
  const out: T[] = [];
  for (const el of list) {
    const r = schema.safeParse(el);
    if (r.success) out.push(r.data);
  }
  return out;
}

export function itemCap(kind: FactKind): number {
  return kind === 'tags' ? LIMITS.maxTags : LIMITS.maxItems;
}

export const SceneCategorySchema = z.object({
  category: text(LIMITS.categoryName),
  color: hex('#00D4FF'),
  image_query: text(LIMITS.imageQuery),
  kind: z.enum(FACT_KINDS).catch('list'),
  headline: optionalText(LIMITS.headline),
  facts: z.array(z.unknown()).catch([]).transform(list =>
    list.map(f => toText(f, LIMITS.fact)).filter(f => f !== ''),
  ),
  items: z.array(z.unknown()).optional().catch(undefined).transform(list =>
    list == null ? undefined : parseEach(SceneItemSchema, list).filter(it => it.label !== ''),
  ),
}).transform(c => {
  const cap = itemCap(c.kind);
  const items = c.items && c.items.length > 0 ? c.items.slice(0, cap) : undefined;
  return { ...c, facts: c.facts.slice(0, cap), items };
});
export type SceneCategory = z.infer<typeof SceneCategorySchema>;

const MetaWireSchema = z.array(z.object({ key: z.unknown(), value: z.unknown() }).catch({ key: '', value: '' }));
const MetaRecordSchema = z.record(z.unknown());

function toMetaRecord(raw: unknown): Record<string, string> {
  const pairs: Array<[unknown, unknown]> = Array.isArray(raw)
    ? raw.map(e => [e.key, e.value] as [unknown, unknown])
    : raw && typeof raw === 'object'
      ? Object.entries(raw as Record<string, unknown>)
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

export const SceneSchema = z.object({
  version: z.literal(SCENE_VERSION).catch(SCENE_VERSION),
  type: z.enum(VALID_TYPES).catch('unknown'),
  title: text(LIMITS.title).pipe(z.string().min(1, 'title is required')),
  subtitle: text(LIMITS.subtitle),
  summary: text(LIMITS.summary),
  image_url: httpsUrl,
  image_query: text(LIMITS.imageQuery),
  meta: z.union([MetaWireSchema, MetaRecordSchema]).optional().catch(undefined).transform(toMetaRecord),
  presentation: ScenePresentationSchema.catch(freshPresentation),
  spotlight: SceneSpotlightSchema.optional().catch(undefined).transform(s =>
    s == null || s.label === '' ? undefined : s,
  ),
  graph: z.array(z.unknown()).transform(list =>
    parseEach(SceneCategorySchema, list).slice(0, LIMITS.maxCategories),
  ),
  sources: z.array(z.unknown()).optional().catch(undefined).transform(list => {
    if (list == null) return undefined;
    const sources = parseEach(SceneSourceSchema, list)
      .filter(s => s.url !== '')
      .slice(0, LIMITS.maxSources);
    return sources.length > 0 ? sources : undefined;
  }),
});

export type Scene = z.infer<typeof SceneSchema>;

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
