# Recipes, commands, gotchas

Run commands from the repository root. Windows is a first-class platform here (the author develops on it).

## Commands

| Goal | Command | Notes |
|---|---|---|
| Dev (server + client) | `npm run dev` | opens two terminal windows (`scripts/dev.mjs`); server `:3001`, client `:5173`; client proxies `/api` to `:3001`. Needs `.env` with `GEMINI_API_KEY` (never read `.env`; see `.env.example`) |
| Dev, fixture mode (no key, no model calls) | server: `NODE_ENV=development CORTEX_FIXTURES=1 npm run dev:server`; client: `npm run dev:client` | PowerShell: `$env:NODE_ENV='development'; $env:CORTEX_FIXTURES='1'; npm run dev:server`. Without `NODE_ENV=development` the mode is refused and logged. `GET /api/health` reports `fixtures: true` |
| Capture real answers as fixtures | `NODE_ENV=development CORTEX_CAPTURE_DIR=server/fixtures npm run dev:server` | needs a real key; writes `<slug>.json` per query |
| Tests | `npx vitest run` (or `npm test`) | collects `src/**/*.test.ts` and `server/**/*.test.ts` only, `environment: 'node'` (`vitest.config.ts`). One file: `npx vitest run server/application/applet.test.ts` |
| Typecheck | `npm run typecheck` | `tsc --noEmit -p tsconfig.app.json && tsc --noEmit -p server/tsconfig.json`. It rewrites the tracked `tsconfig.app.tsbuildinfo` (composite project): `git checkout -- tsconfig.app.tsbuildinfo` before committing |
| Contract drift | `npx tsx scripts/drift-check.mts` | exit 1 on drift; run after any edit of either `Scene.ts` |
| Build | `npm run build` | `tsc -p server/tsconfig.json` (to `server/dist`, gitignored) then `vite build` (to `dist`) |
| Screenshots | `npx tsx scripts/shots.mts [flags]` (or `npm run shots`) | see below |

CI (`.github/workflows/ci.yml`, job name `typecheck, test and build`, on pull requests and pushes to `main`): Node 24, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. CI does not run the drift check or the screenshot script; run the drift check yourself (the parity test in `npm test` covers most of it).

### `scripts/shots.mts`
Starts the API with `NODE_ENV=development CORTEX_FIXTURES=1` (port 3001) and Vite (port 5173), drives Chromium (Playwright), and writes PNGs. For each size it captures landing, searching, streaming, then one final shot per fixture, and checks for horizontal page overflow (exit code 1 on overflow).
| Flag | Default | Effect |
|---|---|---|
| `--sizes=390,768,1440` | all three | widths to capture (heights 844, 1024, 900) |
| `--only=kyoto,postgres` | all fixtures | keeps fixtures whose short name contains one of the values. When `--only` is given, the landing, searching and streaming shots are skipped; they appear only when it is omitted |
| `--out=<dir>` | `docs/screenshots` | output directory |
| `--fixtures-dir=<dir>` | `server/fixtures` | replay source |
| `--no-servers` | off | reuse servers you already started |
| `--freeze=<ms>` | off | extra `-f<ms>` frame with animations frozen at that time |
| `--motion=auto\|reduced` | `auto` | sets `cortex.settings.motion`; files get a `-reduced` suffix |
| `--viewer` | off | extra `-viewer` frame of the image dialog when a hero image loaded |
Fixture short name = first 4 slug words (+ `-es`). The script waits for `[data-status="done"]` and then for the pending applet frame (`section[data-state="pending"]`) to detach. Writing into `docs/screenshots` changes tracked files; use `--out` to a scratch dir for experiments.

## Recipe: add a module kind

Compile-time guards: `MODULE_RENDERERS` and `KIND_ICON` are `Record<FactKind, ...>`, so a kind missing there fails `tsc`.
1. Contract, both mirrors: add to `FACT_KINDS` in `server/domain/Scene.ts` and `src/domain/Scene.ts` (identical text). If it has variants, add values to `MODULE_VARIANTS` and an entry in `VARIANTS_BY_KIND`. If items use `weight`/`side`/`shape` or a different cap, update `itemCap`, `kindUsesWeight`, `kindUsesSide`, `kindUsesShape` (mirrored block). If it carries `body`/`value` like code or prose, update `SceneModuleSchema` transform (server) and `toModule` (client) the same way.
2. Wire schema: update the `kind` and `items` descriptions in `WireModuleSchema` (`server/domain/Scene.ts`).
3. Prompt: `server/application/prompt.ts`: the intent module list, `ITEMS PER KIND`, the variant list in CARD GRAMMAR, and the COMPOSITION rules (reveal/slot/size) if relevant.
4. Renderer: new component in `src/presentation/components/modules/` (props `ModuleRendererProps`), register it in `registry.tsx`, add an icon to `kindIcons.ts`, add `scene.kind.<kind>` to both locales in `src/i18n/translations.ts`.
5. Layout hints in `src/presentation/components/modules/items.ts`: `COMPACT_KINDS`, `DESKTOP_WIDE_KINDS`, `KIND_REVEAL`, `ROW_PX` (height estimate) as the kind needs.
6. Styles: `kinds.module.css` (or a new module) with tokens only; follow `docs/agents/design-system.md`.
7. Verify: add the kind to the payloads in `scripts/drift-check.mts` and `server/domain/Scene.parity.test.ts` (tables list + a module with an invalid value), run drift check, `npx vitest run`, typecheck, and view a fixture containing it with `shots.mts`.

## Recipe: add a field to the Scene or the preface
1. `server/domain/Scene.ts`: constant/type, wire schema (`SceneWireSchema` / `WireModuleSchema` / `PrefaceWireSchema`, OpenAPI-3.0 subset only: no regex, min/max, union, nullable, default), strict schema (`SceneSchema` / `SceneModuleSchema` / `PrefaceSchema`) with a lenient fallback, and the `Scene`/`SceneModule`/`ScenePreface` interface.
2. `src/domain/Scene.ts`: the same constant, the interface, and the normalizer (`toModule`, `toPresentation`, `sanitizeScene`, `sanitizePreface`). Output key order must match the server (spread optional keys in the same position).
3. Add new constants to `CONSTANTS` in `scripts/drift-check.mts` and to `tables` in `Scene.parity.test.ts`; add the field, valid and invalid, to the drift-check payload and the parity payload (preface fields: the key-by-key loop).
4. Prompt (`prompt.ts`): JSON SHAPE block, language note if human-readable, rules. Preface fields also go in `buildPrefacePrompt`.
5. Consumers: server (`cortexStream.ts` if it is an event field), client (`cortexService.ts`, `useCortex.ts`, components).
6. If the value reaches CSS, only through a `data-*` attribute, a lookup table or `isHex`.
7. Run: drift check, `npx vitest run`, typecheck. Update `docs/agents/architecture.md`.

## Recipe: add or re-capture a fixture
1. Live: capture mode (above), ask the query, commit the new `server/fixtures/<slug>.json`. Applet fixtures: `docs/agents/generated-interfaces.md`.
2. File must have `scene`; `query`, `lang` (`en` or `es`), `preface`, `timing` expected. `server/application/cortexStream.test.ts` validates every fixture in the directory.
3. Name = `slugify(query, lang)`; `pickFixture` matches by shared slug words (>2 chars), so keep distinctive words in the query.
4. Check it: fixture mode + `npx tsx scripts/shots.mts --only=<name> --sizes=1440 --out=<scratch dir>`.

## Recipe: restyle a component
1. Read `docs/agents/design-system.md` rules and the component's `*.module.css`.
2. Use tokens (`var(--...)`), no radius, no gradient wash, no glow/blur/shadow; model colours only through `--signal`, `--m`, `--tone`.
3. A class used in the `.tsx` must exist in the stylesheet. In CSS Modules a missing class is just `undefined` and `tsc` does not catch it: grep both sides.
4. Add reduced-motion behaviour for any animation; keep `:focus-visible` visible.
5. Check at 390, 768 and 1440 px: `npx tsx scripts/shots.mts --only=<fixture> --out=<scratch dir>` (overflow audit included).
6. If the change affects an applet twin token (list in `generated-interfaces.md`), update `appletDocument.ts` and its test.

## Recipe: add an i18n string
1. Add the key to `en` in `src/i18n/translations.ts`; `es` is typed `Translations = Record<TranslationKey, string>`, so a missing key fails `tsc`. Add it to `es` too.
2. Use `const { t } = useI18n(); t('key', { param })` (`{param}` interpolation). Never hardcode visible text. Sentence case.
3. Keys used for errors must be `error.*` to satisfy `CortexErrorKey`.

## Recipe: add a design token
1. Add to `:root` in `src/presentation/styles/tokens.css` with a role comment. If it must vary per turn, set it in `sceneCssVars`/`motionFor` or a `SceneTheme.module.css` table instead.
2. Use it as `var(--name)` with no inline literal duplicates.
3. If an applet should see it, add it to `APPLET_THEME_VARS` (both mirrors), `APPLET_THEME`, `THEME_ROLES` and update the pin test.
4. Add it to the tables in `docs/agents/design-system.md`.

## Gotchas
- The drift check compares the mirrored block as text, line endings included. This checkout uses CRLF in the working tree: a script that rewrites one `Scene.ts` with LF makes it report `DRIFT: mirrored source block text differs` although the code is identical. Restore the line endings.
- `scripts/shots.mts` starts its own servers on 3001 and 5173 with `--strictPort`. If `npm run dev` is already running, the web server fails to start and the script silently captures against the running (live, paid) instance. Stop the dev server first or pass `--no-servers` on purpose.
- `CORTEX_FIXTURES=1` without `NODE_ENV=development` is refused and the server answers live.
- Vitest runs in a node environment and only collects `*.test.ts` under `src/` and `server/`. React components are tested through pure helper modules (`items.ts`, `appletSandbox.ts`, `cardFallback.ts`, `motionProfile.ts`, `revealHold.ts`); put logic you want tested there.
- On Windows two modules whose names differ only by case break `tsc` (hence `appletSandbox.ts` beside `AppletFrame.tsx`).
- The drift check compares prefaces with `JSON.stringify`; key order in `validatePreface` and `sanitizePreface` must match.
- `sanitizeText` rewrites `<` `>`; use `sanitizeCode` for code and `sanitizeAppletHtml` for applet markup. Code bodies render only as React text.
- A `var()` declared on `:root` resolves there. That is why `--signal` is redeclared per turn in `sceneCssVars`.
- CSS Modules: a class referenced from `.tsx` but absent from the stylesheet is `undefined`; `tsc` does not catch it.
- Figures size with `cqi` against the card (`container-type: inline-size` on `.card`).
- Zod: `import { z } from 'genkit'` (zod 3). Installing zod 4 breaks schema conversion. TypeScript stays on 6.x.
- Wire schemas given to Gemini must stay an OpenAPI 3.0 subset; `facts` and `items` are required on the wire on purpose (Gemini omitted optional ones).
- Model ids: Gemini ids in `server/infrastructure/geminiClient.ts` are current in this repo; do not "fix" them from memory. `gemini-3.8-flash` ignores the search tool once the full Scene prompt/schema is attached, which is why research is a separate stage.
- Fixture/capture modes need `NODE_ENV=development`; `npm run dev` does not set it. `npm run shots` sets it itself.
- The applet model is the main model (`GEMINI_MODEL`); there is no separate env var for it.
- `FixtureFile.timing` is typed narrower than what capture writes (full `StreamTiming`); extra keys are harmless.
- `partialScene` drops numbers and unsettled strings; do not add numeric fields to the streamed Scene that must appear mid-stream.
- `/api/cortex` (non-streamed) has no preface and no applet.
- The Express server does not serve the built client; `npm start` runs only the API.
- `scripts/shots.mts` is run with `tsx`; it overwrites tracked PNGs under `docs/screenshots` unless `--out` is set.

## Known gaps (verified in the code; not fixed)
- The server sets no CSP or other security headers for the app itself (`server/index.ts` only uses `express.json({limit:'16kb'})` and the routers).
- No authentication and no rate limiting on any API route.
- The schema-validation retry (`generateOnce`) regenerates the whole answer.
- `src/presentation/components/compose/blocks.tsx` `HeroMedia` still renders a duplicate `<img className={styles.heroFill}>`; its stylesheet rule is `display: none`, but the element and its request remain.
- Unused tokens: `--r-sm/--r-md/--r-lg/--r-pill`, `--blur`, `--text-faint`; mood variables `--card-radius`, `--hairline-inset` are set but never read; `usePointerGlow` writes `--px`/`--py` that nothing reads.
- Tracked screenshots in `docs/screenshots/` show the previous (pre-HUD) design and are stale.
- Regenerate the screenshots with `npx tsx scripts/shots.mts` once the design settles.
