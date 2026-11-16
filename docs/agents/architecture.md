# Architecture

Facts checked against the code at branch `feat/ctos-generative-interfaces`. Paths are repository-relative.

## Layers

Dependencies point inward: presentation -> application -> domain. `infrastructure` implements ports for `application`.

| Layer | Path | Holds |
|---|---|---|
| Server domain | `server/domain` | `Scene.ts` (constants, `LIMITS`, sanitizers, wire schemas, strict zod schemas, `validateScene`, `validatePreface`), `errors.ts` (`CortexError`, `ErrorCode`) |
| Server application | `server/application` | `cortexStream.ts` (SSE orchestration + fixture replay), `preface.ts`, `research.ts`, `cortexFlow.ts` (main call, `linkedSignal`, fallbacks), `applet.ts` + `appletPrompt.ts`, `prompt.ts` (all text prompts), `partial.ts`, `trending*.ts` |
| Server infrastructure | `server/infrastructure` | `geminiClient.ts` (Genkit `ai`, model ids), `fixtures.ts`, `grounding.ts`, `verifyImage.ts`, `parseScene.ts` (`extractJSON`), `googleTrends.ts` |
| Server presentation | `server/presentation` | `cortexRouter.ts` (`POST /api/cortex`, `POST /api/cortex/stream`, `GET /api/health`), `trendingRouter.ts`; entry `server/index.ts` |
| Client domain | `src/domain/Scene.ts` | Mirror of the contract + `sanitizeScene`, `sanitizePreface`, `sanitizeAppletEvent`, `DEFAULT_PRESENTATION` |
| Client application | `src/application` | `cortexService.ts` (`streamCortex`, SSE parser, timeouts), `useCortex.ts` (turns state), `trendingService.ts` |
| Client presentation | `src/presentation` | `components/*`, `scene/*` (per-turn theme, motion, card grammar), `canvas/*`, `hooks/*`, `styles/*` |
| i18n | `src/i18n` | `translations.ts` (single source of UI strings), `I18nContext.tsx` |

Entry points: `src/main.tsx` -> `src/Cortex.tsx`. The Vite dev server proxies `/api` to `http://localhost:3001` (`vite.config.ts`). The Express server does not serve the built client (no static route in `server/index.ts`).

## Request flow (one question)

1. `CommandBar` (docked) or `Landing` calls `onSubmit`; `Cortex.tsx` `ask()` trims, stores it in recent queries, calls `useCortex().submit`.
2. `submit` appends a `Turn` (`status: 'thinking'`) and calls `streamCortex(query, locale, callbacks)` (`src/application/cortexService.ts`): `POST /api/cortex/stream` `{query, lang}`.
3. `server/presentation/cortexRouter.ts` validates (non-empty string, max `MAX_QUERY_LENGTH` = 2000; `lang` is `'es'` or else `'en'`), opens an SSE response, and calls `runCortexStream` (`server/application/cortexStream.ts`) with an abort signal tied to client disconnect.
4. `runCortexStream` picks `runFixture` when `CORTEX_FIXTURES=1` and `NODE_ENV=development`, otherwise `runLive`. Event order and payloads: `docs/agents/generation-pipeline.md`.
5. The client parses frames, re-sanitizes each payload with the mirror (`sanitizePreface`, `sanitizeScene`, `sanitizeAppletEvent`), and fires callbacks; `useCortex` updates the `Turn` (`preface`, `research`, `scene` partial then final, `applet`).
6. `Cortex.tsx` renders `SessionStream` -> `TurnView` per turn. `TurnView` wraps everything in `SceneTheme` (CSS custom properties from the presentation), shows the thinking core/plan while staged, then `AppletFrame` (if `turn.applet`), then `Composition` (header, answer, spotlight, meta, hero, modules, sources, follow-ups). `Composition` renders each module through `ModuleCard` -> `MODULE_RENDERERS[kind]`.
7. Before render, `TurnView` fills what the model left plain: `fillCardGrammar` (surface/corner/header/pattern/variant) and `fillTypeScale`, both seeded from the query so they are stable across partials.

`POST /api/cortex` (non-streamed) runs research then `generateScene`; it has no preface and no applet.

## Scene contract

`SCENE_VERSION = 3`. Defined in `server/domain/Scene.ts`; mirrored in `src/domain/Scene.ts`.

Top-level fields: `intent`, `type`, `title`, `subtitle`, `presentation`, `answer {headline, body[], caveats?[]}`, `spotlight?`, `summary`, `image_url`, `image_query`, `meta{}`, `modules[]` (max 8), `followups?[]`, `sources?[]` (https only, from grounding). Only a missing/empty `title` or non-array `modules` fails validation; everything else falls back.

### Enumerations
| Constant | Values |
|---|---|
| `SCENE_INTENTS` | entity, explanation, problem, howto, comparison, analysis, current |
| `SCENE_LAYOUTS` | focus (reading column), dossier (hero media + attribute rail), split (two sides; A/B tabs on mobile), sequence (ordered steps/chronology), mosaic (dense grid) |
| `LAYOUT_BY_INTENT` (fallback) | entity->dossier, explanation->focus, problem->focus, howto->sequence, comparison->split, analysis->focus, current->sequence |
| `SCENE_MOODS` | calm, kinetic, archival, volatile (drive motion tempo and the card grammar defaults) |
| `SCENE_MOTIFS` | flow, rings, grid, none (ambient canvas field) |
| `SCENE_DENSITIES` | sparse, balanced, dense (spacing, stagger) |
| `SCENE_TYPE_SCALES` | editorial, technical, monumental (optional) |
| `VALID_TYPES` | person, place, product, film, series, company, event, concept, sports_team, album, book, unknown |
| `SPOTLIGHT_KINDS` | stat, quote, callout |
| `DEFAULT_PALETTE` | primary `#7FD8FF`, secondary `#8C9EFF`, accent `#5EF2C2` |

### Module kinds (`FACT_KINDS`, 16)
Renderers: `src/presentation/components/modules/registry.tsx` (`MODULE_RENDERERS`, typed `Record<FactKind, ...>`, so a missing kind fails `tsc`).

| Kind | Use | Item fields | Variants (`VARIANTS_BY_KIND`) |
|---|---|---|---|
| list | plain facts, examples | label | dots, numbered, cards, columns |
| timeline | dated events | value=date, label=event | rail, ribbon, stacked |
| stats | numeric metrics | label, value, weight 0-100 | tiles, gauges, hero, inline |
| comparison | two sides, aspect by aspect | side a/b, label=aspect, value | none |
| quote | notable quotes | label=quote, detail=attribution | pull, stack |
| ranking | ordered by score | label, value, weight | none |
| progress | percentages | label, weight=percent, value=display | none |
| keyvalue | attribute/value pairs | label=key, value | none |
| tags | short keywords (max 12) | label | none |
| steps | worked steps (max 8) | label, detail (<=480), value=result (never empty) | path, cards |
| formula | equations | label=expression (code-sanitized), detail | none |
| code | one snippet | `body` (<=2400), `value`=language; no items | none |
| prose | one passage | `body` (<=1600); no items | none |
| proscons | advantages vs disadvantages | side a=pro, b=con, label, detail | none |
| chart | numeric series (max 60 points) | label=x point, value=real number+unit, weight 0-100 | line, bars, area, dots |
| panel | self-composed card (max 8 parts) | `shape` per item: figure, bar, note, pair, tag, divider | none |

Per-kind item rules (`itemCap`, `kindUsesWeight`, `kindUsesSide`, `kindUsesShape` in the mirrored block): `weight` kept only for stats, ranking, progress, chart, panel; `side` only for comparison, proscons; `shape` only for panel. Item caps: tags 12, steps 8, chart 60, panel 8, others 6.

### Presentation fields on a module (all optional, enum-validated)
`slot` (rail|main), `span` (wide|compact; older hint, `size` wins), `size` (quarter|third|half|two-thirds|full = 3/4/6/8/12 of a 12-column row, `SIZE_COLUMNS` in `items.ts`), `emphasis` (lead|normal|quiet; one lead per scene), `tone` (neutral|positive|caution|critical; valence, never a colour), `reveal` (rise|draw|count|fade), `surface` (solid|outline|bleed|glass|bare|inverted), `corner` (round|square|notch), `header` (icon|numeral|rule|none), `pattern` (none|contour|grid|dots|stripes|scan), `variant` (checked against `VARIANTS_BY_KIND` via `moduleVariant`). Directives only seed the computed layout; `Composition` and `items.ts` (`balancedSpans`, `fillRows`, `capRail`, `partitionModules`) have the last word. Visual effect of each value: `docs/agents/design-system.md`.

### Preface and applet types
`ScenePreface {intent, title, layout, mood, palette, plan[<=3], applet?}`, `AppletBrief {title, brief}`, `AppletState {status: 'pending'|'ready'|'failed', title, html?}`. Applet details: `docs/agents/generated-interfaces.md`.

## Mirror rule

Two files hold the same contract: `server/domain/Scene.ts` (zod-based) and `src/domain/Scene.ts` (hand-written normalizers, no zod). Rules:
- Change both in one commit. Constants, `LIMITS`, `VARIANTS_BY_KIND`, `APPLET_*`, `truncateText`, `sanitizeText`, `sanitizeCode`, `safeHttpsUrl`, `isHex`, `normalizeHex`, `luminousHex`, `hexOr`, `itemCap`, `kindUses*`, `itemShape`, `moduleVariant`, `appletBrief`, `sanitizeAppletHtml` must be textually identical.
- `scripts/drift-check.mts` (`npx tsx scripts/drift-check.mts`): compares 29 exported constants via `JSON.stringify`; compares sanitizer outputs on samples; compares the source text from `export const VALID_TYPES` through the first `// ---` after `export function itemCap` (paths `src/domain`/`server/domain` normalized to `<mirror>`); runs one payload through `validateScene` vs `sanitizeScene` and compares serialized output (so object key order matters); compares `validatePreface` vs `sanitizePreface` including applet variants; compares `MAX_QUERY_LENGTH` in `server/presentation/cortexRouter.ts` and `src/application/cortexService.ts` as source text.
- `server/domain/Scene.parity.test.ts` (vitest): same checks as behaviour tests on tables, sanitizers, helpers and an entry-point payload. It lives under `server/` because `tsconfig.app.json` is a composite project that refuses files outside `src`.
- Key order: `validatePreface` and `sanitizePreface` build the preface key by key (`applet` last, only when present). Reordering one side fails the drift check.
- A new constant must be added to the `CONSTANTS` array in `drift-check.mts` and to `tables` in `Scene.parity.test.ts`.

## Sanitizers (trust boundary)

| Function | Does | Use for |
|---|---|---|
| `sanitizeText(s, max)` | strips control chars, `<`->`‹`, `>`->`›`, collapses whitespace, truncates at word boundary with `…` | every model text shown as React text |
| `sanitizeCode(s, max)` | normalizes newlines, strips control chars except `\n`/`\t`, keeps `<` `>` and indentation, trims, hard-slices | code bodies, formula labels. Render only as a React text node |
| `sanitizeAppletHtml(x)` | normalizes newlines, strips control chars except `\n`/`\t`, trims; returns `null` for non-string, blank, or longer than `LIMITS.appletHtml` (rejects, never truncates) | applet markup, only for an iframe `srcDoc` |
| `safeHttpsUrl(x)` | returns the string only for a well-formed `https:` URL, no whitespace, <= `LIMITS.url`; else `''` | `image_url`, source URLs |
| `isHex` / `hexOr` / `luminousHex` | `#RRGGBB` check; bare `RRGGBB` accepted; dark or washed colours lifted to lightness 0.58-0.82, saturation >= 0.45 (near-greys kept) | all palette and module colours |
| `appletBrief(raw)` | `{title, brief}` through `sanitizeText`, or `null` unless both non-empty | preface applet request |

## `LIMITS` (identical in both mirrors)

| Key | Value | Key | Value |
|---|---|---|---|
| title | 120 | maxModules | 8 |
| subtitle | 160 | maxItems | 6 |
| summary | 900 | maxPanel | 8 |
| answerHeadline | 220 | maxSteps | 8 |
| paragraph | 900 | maxChartPoints | 60 |
| maxParagraphs | 8 | maxMeta | 8 |
| caveat | 240 | maxSources | 8 |
| maxCaveats | 3 | maxTags | 12 |
| fact | 160 | followup | 160 |
| label | 160 | maxFollowups | 4 |
| value | 80 | planStep | 120 |
| detail | 240 | maxPlan | 3 |
| stepDetail | 480 | imageQuery | 80 |
| formula | 240 | url | 2048 |
| code | 2400 | appletTitle | 80 |
| prose | 1600 | appletBrief | 400 |
| headline | 140 | appletHtml | 32000 |
| categoryName | 40 | | |

Other limits: `MAX_QUERY_LENGTH` 2000 (router + client); `express.json({ limit: '16kb' })` in `server/index.ts`.

## Where things live (client)

`src/presentation/components/`: `shell/` (TopBar, SettingsMenu), `command/` (CommandBar), `landing/` (Landing), `session/` (SessionStream, TurnView, Skeleton), `compose/` (Composition, blocks: header, answer, spotlight, meta grid, hero, sources, follow-ups, split tabs; `revealHold.ts`), `modules/` (ModuleCard, kinds, ChartModule, PanelModule, CardPattern, registry, `items.ts` layout maths, `kindIcons.ts`), `applet/`, `overlay/` (ImageViewer), `motion/` (Materialize), `text/` (RichText: `**bold**` and `` `code` `` into React nodes). `src/presentation/scene/`: `SceneTheme`, `sceneTokens.ts`, `motionProfile.ts`, `cardFallback.ts`, `presentation.ts`, `MotionContext`, `seed.ts`. `src/presentation/canvas/`: `ThinkingCore`, `AmbientField`, `ticker.ts`, `color.ts`. Settings (`locale`, `motion`) persist in `localStorage` key `cortex.settings` (`useSettings.ts`). Breakpoints (`useBreakpoint.ts`): mobile < 768, tablet < 1280, desktop >= 1280.
