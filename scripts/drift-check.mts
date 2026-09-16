// Contract drift check: compares every exported constant and the shared
// sanitizers between server/domain/Scene.ts and src/domain/Scene.ts, and
// checks that the text of the mirrored blocks is byte-for-byte identical.
// Run: npx tsx scripts/drift-check.mts
import { readFileSync } from 'node:fs';
import * as server from '../server/domain/Scene.ts';
import * as client from '../src/domain/Scene.ts';

const CONSTANTS = [
  'VALID_TYPES', 'SCENE_INTENTS', 'SCENE_LAYOUTS', 'SCENE_MOODS', 'SCENE_MOTIFS', 'SCENE_DENSITIES',
  'FACT_KINDS', 'SPOTLIGHT_KINDS', 'ITEM_SIDES', 'SCENE_VERSION', 'LIMITS', 'LAYOUT_BY_INTENT', 'DEFAULT_PALETTE',
  'MODULE_SLOTS', 'MODULE_SPANS', 'MODULE_EMPHASES', 'MODULE_TONES', 'MODULE_REVEALS', 'ITEM_SHAPES',
] as const;

let failures = 0;
const fail = (msg: string) => { failures += 1; console.error(`DRIFT: ${msg}`); };

for (const name of CONSTANTS) {
  const a = JSON.stringify((server as Record<string, unknown>)[name]);
  const b = JSON.stringify((client as Record<string, unknown>)[name]);
  if (a === undefined || a !== b) fail(`${name} differs\n  server=${a}\n  client=${b}`);
}

const samples = ['  a <b>\n\tc\r\n', '\n\n  def f(x):\n\treturn x < 1\u0007  \n', 'x'.repeat(3000), ''];
for (const s of samples) {
  if (server.sanitizeText(s, 100) !== client.sanitizeText(s, 100)) fail('sanitizeText output differs');
  if (server.sanitizeCode(s, 2400) !== client.sanitizeCode(s, 2400)) fail('sanitizeCode output differs');
}

// Byte-for-byte text of the mirrored blocks (constants through itemCap).
const block = (path: string) => {
  const src = readFileSync(new URL(path, import.meta.url), 'utf8');
  const start = src.indexOf('export const VALID_TYPES');
  const end = src.indexOf('// ---', src.indexOf('export function itemCap'));
  return src.slice(start, end).replace(/src\/domain|server\/domain/g, '<mirror>');
};
if (block('../server/domain/Scene.ts') !== block('../src/domain/Scene.ts')) fail('mirrored source block text differs');

// Same payload must normalise identically on both sides.
const payload = {
  intent: 'problem', type: 'concept', title: 'Catch-up', subtitle: 'Kinematics',
  answer: { headline: 'At 8 pm, 400 km out', body: ['Para <1>', 'Para 2'], caveats: ['Same track'] },
  image_url: 'http://insecure', presentation: { layout: 'bogus', mood: 'calm', motif: 'grid', density: 'dense', palette: { primary: '#fff' } },
  modules: [
    { category: 'Steps', color: '#7FD8FF', kind: 'steps', items: [{ label: 'Head start', detail: '80 km/h x 1 h', value: '80 km', weight: 140 }] },
    { category: 'Formula', color: '#7FD8FF', kind: 'formula', items: [{ label: 't = d / (v2 - v1) <ok>' }] },
    { category: 'Code', color: 'red', kind: 'code', value: 'python', body: '\n  if a < b:\n\tpass  \n' },
    { category: 'Prose', color: '#7FD8FF', kind: 'prose', body: 'A\n\nB' },
    // ScenePresentation and SceneModule live outside the byte-for-byte block, so
    // the composition directives are only ever compared through this payload.
    // Every new field appears here, each with at least one invalid value, so a
    // mirror that forgot to drop one shows up as a diff rather than at runtime.
    {
      category: 'Panel', color: '#7FD8FF', kind: 'panel',
      slot: 'rail', span: 'compact', emphasis: 'lead', tone: 'chartreuse', reveal: 'draw',
      items: [
        { label: 'Capacity', value: '12 GW', weight: 140, shape: 'figure' },
        { label: 'Share', weight: 40, shape: 'bar' },
        { label: 'Unknown shape is dropped', shape: 'hologram' },
        { label: 'Break', shape: 'divider' },
      ],
    },
    // The regression this payload exists to pin: a module the model returned as
    // all shell and no body — every directive set, no items, no facts, no body.
    // Both mirrors must normalise it to the same content-less module (facts: [],
    // no items key) so the composition can recognise it and drop it rather than
    // render a header over an empty box.
    { category: 'Hollow steps', color: '#7FD8FF', kind: 'steps', span: 'wide', emphasis: 'lead', reveal: 'draw' },
    { category: 'Hollow chart', color: '#7FD8FF', kind: 'chart', tone: 'positive', reveal: 'draw', items: [] },
    // An invalid kind falls back to 'list' on both sides. The directives must
    // survive that fallback identically, since each mirror applies it at a
    // different point: a zod .catch() on one side, asEnum() on the other.
    {
      category: 'Bad kind', color: '#7FD8FF', kind: 'bogus',
      span: 'wide', emphasis: 'lead', reveal: 'draw',
      items: [{ label: 'still a list item', shape: 'figure' }],
    },
    // tags uses neither shape nor weight, so both must disappear on both sides.
    {
      category: 'Tags', color: '#7FD8FF', kind: 'tags',
      slot: 'sideways', span: 'wide', emphasis: 'enormous', tone: 'caution', reveal: 'somersault',
      items: [{ label: 'kept', shape: 'tag', weight: 50 }],
    },
    'junk',
  ],
  followups: ['Why?', 42, ''],
  meta: [{ key: 'k', value: 'v' }],
};
const a = JSON.stringify(server.validateScene(payload));
const b = JSON.stringify(client.sanitizeScene(payload));
if (a !== b) fail(`normalised scene differs\n  server=${a}\n  client=${b}`);

const preface = { intent: 'comparison', title: 'PG vs Mongo', layout: 'nope', mood: 'kinetic', palette: {}, plan: ['a', 'b', 'c', 'd'] };
if (JSON.stringify(server.validatePreface(preface)) !== JSON.stringify(client.sanitizePreface(preface))) fail('normalised preface differs');

// MAX_QUERY_LENGTH is duplicated in two modules that share nothing else, so it
// is compared as source text rather than by importing the server router.
// The \r is tolerated because core.autocrlf rewrites these files on checkout.
const queryLimit = (path: string) => /^export const MAX_QUERY_LENGTH = (\d+);\r?$/m
  .exec(readFileSync(new URL(path, import.meta.url), 'utf8'))?.[1];
const serverLimit = queryLimit('../server/presentation/cortexRouter.ts');
const clientLimit = queryLimit('../src/application/cortexService.ts');
if (serverLimit === undefined || serverLimit !== clientLimit) {
  fail(`MAX_QUERY_LENGTH differs\n  server=${serverLimit}\n  client=${clientLimit}`);
}

if (failures > 0) process.exit(1);
console.log(`No drift: ${CONSTANTS.length} constants, MAX_QUERY_LENGTH, sanitizers, mirrored block text, scene and preface normalisation match.`);
