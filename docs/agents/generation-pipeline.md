# Generation pipeline

Source of truth: `server/application/cortexStream.ts` (events), `cortexFlow.ts`, `preface.ts`, `research.ts`, `applet.ts`, `partial.ts`, `server/infrastructure/fixtures.ts`, `src/application/cortexService.ts`, `src/application/useCortex.ts`.

## Stream events (`POST /api/cortex/stream`, SSE, `StreamEvent` type)

Wire format per frame: `event: <name>\ndata: <JSON>\n\n`. Idle comment `: ping` every 15 s (`HEARTBEAT_MS` in `cortexRouter.ts`). Invalid input returns JSON 400 `{error, code: 'INVALID_INPUT'}` before the stream opens.

| # | Event | Emitted by | Payload | Rule |
|---|---|---|---|---|
| 1 | `preface` | `runLive` once `generatePreface` resolves non-null | `ScenePreface` `{intent, title, layout, mood, palette, plan[], applet?}` | at most once; client ignores it if a scene already arrived or a preface was seen |
| 2 | `applet` `pending` | `startApplet` right after the preface, only when `preface.applet` exists | `{status:'pending', title}` | not emitted if the stream is closing or aborted |
| 3 | `research` | after `runResearch` returns non-null | `{sources: number, searches: number}` | optional |
| 4 | `partial` | `onPartial` of `generateScene`, throttled | Scene-shaped object with only settled fields | zero or more; each supersedes the previous |
| 5 | `scene` | after `generateScene` | validated `Scene` | authoritative; the client stops accepting partials after it |
| 5' | `error` | catch around research/scene | `{code: ErrorCode \| 'INTERNAL_ERROR'}` | replaces `scene`; `done` still follows |
| * | `applet` `ready` / `failed` | when `generateApplet` settles | `{status:'ready', title, html}` or `{status:'failed', title}` | any time after `pending` and before `done` (before, between or after partials and scene); exactly one of the two |
| 6 | `done` | always last | `StreamTiming {prefaceMs, researchMs, firstPartialMs, sceneMs, sources}` (null where a stage did not run) | `done` waits for the applet task (`closing = true`, then `await appletTask`) |

A stream with no applet is unchanged event for event. A failed applet never becomes an `error` event. Nothing is emitted after the client disconnects (`signal.aborted`).

Router failure path: an exception escaping `runCortexStream` emits `error {code:'INTERNAL_ERROR'}` then `done` with all-null timings.

Error codes and HTTP statuses (`/api/cortex` only; the stream returns 200 and sends `error` events): INVALID_INPUT 400, PARSE_FAILURE 422, VALIDATION_ERROR 422, GEMINI_ERROR 502, ABORTED 499.

## Model calls

All via the Genkit instance `ai` in `server/infrastructure/geminiClient.ts`. Model ids are constants there; each is overridable by env. Model refs are memoised (registering one name twice from concurrent requests failed with "fetch failed").

| Call | File | Model (default const, env) | temp | max output tokens | timeout (env) | Structured output | Thinking |
|---|---|---|---|---|---|---|---|
| Preface (router) | `preface.ts` | `gemini-3.5-flash-lite` (`DEFAULT_PREFACE_MODEL`, `GEMINI_PREFACE_MODEL`) | 0.2 | 1024 | 8000 ms (`CORTEX_PREFACE_TIMEOUT_MS`) | yes, `PrefaceWireSchema` | MINIMAL, degrades to LOW then model default on a 400 mentioning "thinking" (once per process) |
| Research | `research.ts` | `gemini-3.5-flash-lite` (`DEFAULT_RESEARCH_MODEL`, `GEMINI_RESEARCH_MODEL`) | 0.2 | 2048 | 15000 ms (`CORTEX_RESEARCH_TIMEOUT_MS`) | no, plain text, `googleSearch: {}` | MINIMAL |
| Main (scene) | `cortexFlow.ts` | `gemini-3.8-flash` (`DEFAULT_MODEL`, `GEMINI_MODEL`) | 0.6 | 16384 | 75000 ms (`GEMINI_TIMEOUT_MS`) | yes, `SceneWireSchema`, streamed | LOW; MEDIUM when `preface.intent === 'problem'` |
| Applet | `applet.ts` | same as main (`resolveModelRef()`, so `GEMINI_MODEL`; no applet-specific model var) | 0.4 | 16384 | 45000 ms (`CORTEX_APPLET_TIMEOUT_MS`) | no, plain text | LOW; turned off for the process after a 400 mentioning "thinking" |
| Trending (landing chips, not part of a turn) | `trendingModel.ts` | preface model (`resolvePrefaceModelRef()`) | 0.7 | 1024 | 10000 ms (constant) | yes, `TrendingWireSchema` | MINIMAL, degrades like the preface |

Each of preface, research and applet never throws: any failure, timeout or abort resolves to `null`. Timeouts come from `linkedSignal(signal, ms)` (`AbortSignal.any` of client abort + timeout).

### Order and concurrency (`runLive`)
1. t=0: `generatePreface` and `runResearch` start together. If the preface lands first and has `applet`, `startApplet` runs immediately and in parallel with everything else.
2. After research: if no preface yet, wait up to `PREFACE_GRACE_MS` = 700 ms (its intent picks the thinking level).
3. `generateScene` runs with `{preface, research, onPartial}`.
4. After the scene (or error): `closing = true`, await the applet task, optionally write a capture fixture, log timing, emit `done`.

### Preface router
Prompt: `buildPrefacePrompt(lang)` in `server/application/prompt.ts`: shared `ROUTING_RULES` (intent, layout, mood, palette) + fields. The `applet` field: include it "whenever such an interface would serve the user better than text, standard charts and lists", for any content (operate / explore / play-practise / custom visualisation); omit for prose, standard chart, list, table, comparison; "a time series is a chart module, never an applet". Palette fallback is logged when all three colours equal `DEFAULT_PALETTE`.

### Research
`buildResearchPrompt()`: dense factual brief <= 300 words (kept <= 6000 chars), "NO RESEARCH NEEDED" for pure arithmetic/logic, optional trailing `Image: <https url>` line for entity subjects (split out by `splitImage`, `safeHttpsUrl`-checked). It exists because the main model never invokes `google_search` once the full Scene prompt or schema is attached (measured; see `research.ts` comment). Sources come from grounding metadata (`sourcesFromGrounding`), https only, deduped, max 8. On failure the main call keeps `googleSearch: {}` as a nominal fallback (answer ungrounded, no sources). The research image URL is verified (`verifyImage`) in the background.
Time series come only from these grounded notes: no market-data provider exists; the main prompt tells the model to emit a `chart` (line/area) with up to `LIMITS.maxChartPoints` points and never invent figures.

### Main call
`buildSystemPrompt(lang)` + `buildMainPrompt(query, preface, brief)`. The user turn carries `QUESTION`, `ROUTER` (keep these unless contradicted) and, when `preface.applet` exists, an `INTERACTIVE INTERFACE` note telling the model to keep the answer short and not rebuild the tool, plus `RESEARCH NOTES` when grounded. Wire schema descriptions are the field-level guidance. Output goes through `validateScene` (strict, lenient fallbacks).
- Request shape profile (`profile` in `cortexFlow.ts`, process-wide): starts `{structuredOutput: true, thinking: true}`. On a 400 (`isBadRequest`) it drops thinking if the message mentions it, else drops structured output if it mentions schema/json, retries once, and keeps the degraded profile for later requests.
- Retry on schema failure (`generateOnce`): when Genkit rejects the reply with "Schema validation failed", first try `recoverDataFromValidationError` (the lenient domain schema salvages the data embedded in the error). If nothing is recoverable, retry once as raw JSON with `structuredOutput: false` for that request only (the process profile is untouched). The retry regenerates the whole answer. A second failure throws `CortexError('PARSE_FAILURE')`.
- Final assembly: merge research sources with the call's own grounding, settle the hero image, `validateScene`.
- Errors: abort -> `ABORTED`; timeout -> `GEMINI_ERROR`; other -> `GEMINI_ERROR` with a redacted first line (`redactSecrets` strips `key=`).

### Hero image
`createHero` locks the first URL that `verifyImage` confirms really serves an image (research image first, then the model's `image_url`). Every partial and the final scene reuse the locked value, so the hero never changes after it appears.

### Partials (`server/application/partial.ts`, `partialScene`)
Input is Genkit's half-parsed `chunk.output`. Rules (`settle`):
- Object: every key but the last is settled; the last key is recursed into.
- Array: every element but the last is settled; the last is recursed into if an object, dropped if a scalar.
- Strings are dropped until settled, except under keys `body` and `summary` (prose mode), which are cut back to the last completed phrase (`PHRASE_END`, min 24 chars).
- Numbers are dropped until settled; booleans pass.
- Modules: the last module is held back until the key after `modules` has started (a half-written module renders as a broken card).
- Returns `null` unless `title` is non-empty and (headline or body or modules exist).
- `clean()` re-sanitizes every string: keys `body`/`label` use `sanitizeCode(LIMITS.code)`, `image_url`/`url` pass through (validated later by `safeHttpsUrl`), all others `sanitizeText(LIMITS.code)`.
- `extra` (research `sources`) is merged into every partial; `image_url` comes from the hero offer.
- Throttle `PARTIAL_THROTTLE_MS` = 130 ms and a partial identical to the previous payload is skipped.
- A big string inside a partial never settles, which is why applet HTML does not travel in the Scene (see `generated-interfaces.md`).

## Fixture mode and capture mode (`server/infrastructure/fixtures.ts`)

Both fail closed: they require `NODE_ENV=development` and log once why they were refused. `npm run dev` does not set it.

| Mode | Env | Behaviour |
|---|---|---|
| Replay | `CORTEX_FIXTURES=1`; optional `CORTEX_FIXTURES_DIR` (default `server/fixtures`, resolved from `process.cwd()`) | `/api/cortex/stream` replays a file; no `GEMINI_API_KEY` needed (`server/index.ts` skips the key check); `/api/trending` serves `FIXTURE_TRENDING` |
| Capture | `CORTEX_CAPTURE_DIR=<dir>` | After a successful live stream (scene present) writes `<dir>/<slug>.json` once the applet has settled; failure is logged, not fatal |

Fixture file shape (`FixtureFile`): `{ query, lang: 'en'|'es', preface, scene, applet?: {title, html}, timing? }`. `applet` is present only if the preface asked for one and it generated. `preface` and `scene` are re-validated on replay (`validatePreface`, `validateScene`); `applet.html` goes through `sanitizeAppletHtml` (invalid -> replays as `failed`; only a non-empty `title` is required).

File name: `slugify(query, lang)`: lowercase ASCII, accents stripped, non-alphanumerics -> `-`, max 60 chars, `.es` suffix for Spanish.

Picking (`pickFixture`): tokens = slug words longer than 2 chars; score = overlapping tokens, +0.5 when the fixture language matches (`.es` suffix iff `lang` is `es`); best score wins; with no overlap it cycles through the sorted file list. Returns `null` on a missing/invalid dir or file without `scene`. To make a query hit a fixture, make the query share words with its slug.

Replay timing (`runFixture`): preface at ~600-800 ms; applet `pending` right after the preface and `ready`/`failed` at ~4200-5000 ms from start (`FIXTURE_APPLET_MS` + up to 800 ms jitter); `research` at ~2400 ms (`searches` is 2 when the scene has sources, else 0); partials from `fixturePartials(scene)` every 220-340 ms (headline half, headline, paragraphs one by one, framing, then one module at a time); `scene` 420 ms after the last partial; then `done`. No fixture -> `error GEMINI_ERROR`.

Current fixtures: 17 files in `server/fixtures` (one added untracked by a parallel change when this was written); two carry an `applet`: `css-color-picker-hex-rgb-hsl.json` and `how-does-binary-search-work-let-me-step-through-it.json`. `norvane-robotics-stock-price-since-2023.json` carries a 36-point chart.

## Client side

### `streamCortex(query, lang, options)` (`src/application/cortexService.ts`)
`fetch('/api/cortex/stream', POST)`, reads the body as a stream, splits frames on blank lines, and dispatches:
- `preface` -> `sanitizePreface` -> `onPreface` (first only, ignored after a scene).
- `research` -> `onResearch({sources, searches})`.
- `partial` -> `sanitizeScene` -> `onPartial`; one that fails to sanitize is skipped; ignored after `scene`.
- `applet` -> `sanitizeAppletEvent` -> `onApplet`; a parse failure is ignored (the tool's failure, never the answer's). A `ready` event with markup that fails `sanitizeAppletHtml` becomes `failed`.
- `scene` -> `sanitizeScene` -> `onScene`. The returned promise resolves with the scene at `done`.
- `error` -> rejects `CortexApiError` with key from `CODE_KEYS` (INVALID_INPUT/VALIDATION_ERROR -> `error.validation`, PARSE_FAILURE -> `error.parse`, GEMINI_ERROR -> `error.upstream`, else `error.unknown`).
- `done` without a scene -> `error.unknown`.
Timeouts: `FIRST_EVENT_TIMEOUT_MS` 20 s to the first byte, `IDLE_TIMEOUT_MS` 45 s between chunks (heartbeats reset it) -> `error.timeout`. Once a scene arrived, any later failure resolves with that scene (it could only cost the applet).

### Turn state (`src/application/useCortex.ts`)
`TurnStatus`: `thinking` (sent, nothing received) -> `streaming` (preface/research/partial arrived) -> `done` (scene received; set in `onScene`, even while the applet is still `pending`) or `error`. `Turn` fields: `id, query, lang, status, preface?, research?, scene?, applet?, error?, startedAt`.
- At most one turn runs; `submit` aborts the previous (marks it `error.cancelled` if still in flight), `retry` resets a turn in place, `cancel`, `clearSession`.
- `isInterrupted(turn)` = `status === 'error' && scene != null`: the scene is a partial and must keep the streaming treatment.
- `settleApplet`: a `pending` applet is shown as `failed` when its run ends, errors or is aborted.
- Presentation while in flight: `turnPresentation(turn)` = scene presentation, else preface layout/mood/palette over defaults, else defaults.

### Tests that cover this
`server/application/cortexStream.test.ts`, `applet.test.ts`, `partial.test.ts`, `src/application/cortexService.test.ts`, `server/infrastructure/parseScene.test.ts`, `grounding.test.ts`.
