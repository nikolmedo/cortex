import {
  moduleVariant, VARIANTS_BY_KIND,
  type ModuleCorner, type ModuleHeader, type ModulePattern, type ModuleSurface, type ModuleVariant,
  type SceneModule, type SceneMood, type ScenePresentation, type SceneTypeScale,
} from '../../domain/Scene';
import { chartReadsAsLine, hasContent, moduleItems } from '../components/modules/items';
import { hash, random } from './seed';

/*
 * Card grammar for modules the model left plain. Everything is drawn from a
 * hash of a seed that holds for the whole turn, and module i only ever reads
 * modules 0..i, so a card keeps its look when later ones stream in after it.
 * Sizing is left to layout balancing.
 */

interface MoodGrammar {
  /** Rotated per scene, so neighbours differ. */
  surfaces: readonly ModuleSurface[];
  /** Weighted: repeats raise the odds. */
  corners: readonly ModuleCorner[];
  headers: readonly ModuleHeader[];
  patterns: readonly Exclude<ModulePattern, 'none'>[];
  /** The lead card takes the first of these it is allowed. */
  lead: readonly ModuleSurface[];
  leadCorner: ModuleCorner;
  typeScales: readonly SceneTypeScale[];
}

const GRAMMAR: Record<SceneMood, MoodGrammar> = {
  archival: {
    surfaces: ['outline', 'bare', 'solid'],
    corners: ['square'],
    headers: ['rule', 'numeral', 'none'],
    patterns: ['grid', 'scan', 'stripes'],
    lead: ['solid', 'outline'],
    leadCorner: 'square',
    typeScales: ['editorial', 'technical'],
  },
  volatile: {
    surfaces: ['glass', 'inverted', 'solid', 'outline'],
    corners: ['notch', 'notch', 'square'],
    headers: ['icon', 'numeral', 'rule'],
    patterns: ['scan', 'stripes', 'grid'],
    lead: ['inverted', 'glass', 'solid'],
    leadCorner: 'notch',
    typeScales: ['technical', 'monumental'],
  },
  calm: {
    surfaces: ['solid', 'bleed', 'outline', 'glass'],
    corners: ['round', 'round', 'round', 'square'],
    headers: ['icon', 'rule', 'none', 'numeral'],
    patterns: ['contour', 'dots'],
    lead: ['bleed', 'solid'],
    leadCorner: 'round',
    typeScales: ['editorial', 'editorial', 'technical'],
  },
  kinetic: {
    surfaces: ['solid', 'glass', 'bleed', 'outline', 'inverted', 'bare'],
    corners: ['round', 'square', 'notch'],
    headers: ['icon', 'numeral', 'rule', 'none'],
    patterns: ['contour', 'grid', 'dots', 'stripes', 'scan'],
    lead: ['inverted', 'bleed', 'glass'],
    leadCorner: 'notch',
    typeScales: ['monumental', 'technical', 'editorial'],
  },
};

/** How a card with no grammar is drawn, so a neighbour can be told apart from it. */
const DEFAULT_SURFACE: ModuleSurface = 'solid';
const DEFAULT_HEADER: ModuleHeader = 'icon';
const PATTERN_ODDS = 0.25;
const LEAD_PATTERN_ODDS = 0.5;

function pick<T>(list: readonly T[], next: () => number): T {
  return list[Math.floor(next() * list.length)];
}

/** Fisher-Yates over a copy, driven by the seeded generator. */
function shuffled<T>(list: readonly T[], next: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The list read from `start`, wrapping round. */
function rotated<T>(list: readonly T[], start: number): T[] {
  const at = start % list.length;
  return [...list.slice(at), ...list.slice(0, at)];
}

/**
 * A line or area only reads with enough short-labelled points, so a pick the
 * chart's data cannot carry is drawn as bars. Substituted rather than filtered
 * out, so the pick itself stays put while points stream in and only flips at
 * the same threshold ChartModule's own guess does.
 */
function readable(module: SceneModule, variant: ModuleVariant): ModuleVariant {
  if (module.kind !== 'chart' || (variant !== 'line' && variant !== 'area')) return variant;
  return chartReadsAsLine(moduleItems(module)) ? variant : 'bars';
}

/** The model set at least one grammar field, so the card is left as it is. */
function isStyled(module: SceneModule): boolean {
  return module.surface !== undefined
    || module.corner !== undefined
    || module.header !== undefined
    || module.pattern !== undefined
    || module.variant !== undefined;
}

/**
 * Fills surface, corner, header, pattern and variant on every module that has
 * none of them. Modules the model styled come back as the same object.
 */
export function fillCardGrammar(modules: readonly SceneModule[], mood: SceneMood, seed: string): SceneModule[] {
  const grammar = GRAMMAR[mood];
  const order = random(hash(`${seed}|${mood}|order`));
  const surfaces = shuffled(grammar.surfaces, order);
  const headers = shuffled(grammar.headers, order);

  let filled = 0;
  let inverted = false;
  let prevSurface: ModuleSurface | undefined;
  let prevHeader: ModuleHeader | undefined;

  return modules.map((module, index) => {
    // A card with nothing to draw is never shown, so it takes no part in the sequence.
    if (!hasContent(module)) return module;
    if (isStyled(module)) {
      if (module.surface === 'inverted') inverted = true;
      prevSurface = module.surface ?? DEFAULT_SURFACE;
      prevHeader = module.header ?? DEFAULT_HEADER;
      return module;
    }

    const next = random(hash(`${seed}|${index}|${module.kind}`));
    const lead = module.emphasis === 'lead';
    const allowed = (s: ModuleSurface) => s !== prevSurface && !(s === 'inverted' && inverted);
    const candidates = lead ? [...grammar.lead, ...rotated(surfaces, filled)] : rotated(surfaces, filled);
    const surface = candidates.find(allowed) ?? candidates.find(s => s !== 'inverted') ?? DEFAULT_SURFACE;
    const header = rotated(headers, filled).find(h => h !== prevHeader) ?? DEFAULT_HEADER;
    const corner = lead ? grammar.leadCorner : pick(grammar.corners, next);
    const patterned = next() < (lead ? LEAD_PATTERN_ODDS : PATTERN_ODDS);
    const choices = VARIANTS_BY_KIND[module.kind];
    const variant = choices
      ? moduleVariant(module.kind, lead && module.kind === 'stats' ? 'hero' : readable(module, pick(choices, next)))
      : undefined;

    filled += 1;
    if (surface === 'inverted') inverted = true;
    prevSurface = surface;
    prevHeader = header;

    const out: SceneModule = { ...module, surface, corner, header };
    if (patterned) out.pattern = pick(grammar.patterns, next);
    if (variant !== undefined) out.variant = variant;
    return out;
  });
}

/**
 * Adds a type scale when the scene has none. `mood` should be the turn's
 * earliest one (the preface's), so the typography does not switch while the
 * scene's own presentation is still settling.
 */
export function fillTypeScale(presentation: ScenePresentation, mood: SceneMood, seed: string): ScenePresentation {
  if (presentation.typeScale !== undefined) return presentation;
  const scales = GRAMMAR[mood].typeScales;
  return { ...presentation, typeScale: scales[hash(`${seed}|${mood}|type`) % scales.length] };
}
