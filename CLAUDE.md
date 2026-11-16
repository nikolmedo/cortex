# Cortex: agent index

Answer engine. A Gemini model returns a validated JSON `Scene` (answer + presentation spec); fixed React components render it as a streamed, per-question interface. Questions a standard module cannot express also get a generated interactive "applet", rendered only inside a sandboxed iframe.
Visual direction: surveillance-terminal HUD with soft edges (near-monochrome void, hairlines, rounded lit frames with one tight tab corner, inverted pill tags). Never use the name "ctOS", the Watch Dogs logo or game assets in the product.
Read these docs before exploring the tree. Update them in the same change whenever architecture, contracts, tokens, limits or commands change.

## Stack (constraints)
- React 19.3, Vite 8.3, TypeScript 6.x (keep it), Express 5, Node 24 in CI, vitest 5, CSS Modules + `src/presentation/styles/tokens.css` (no CSS framework).
- AI: Genkit 1.42 + `@genkit-ai/google-genai`. zod is v3 through `import { z } from 'genkit'`. Never install zod 4.
- Models: `gemini-3.8-flash` (answer, applet), `gemini-3.5-flash-lite` (preface, research). Details: `docs/agents/generation-pipeline.md`.

## Commands
- `npm run dev` opens server (:3001) and client (:5173) in two terminals. Fixture mode (no API key): `NODE_ENV=development CORTEX_FIXTURES=1 npm run dev:server` plus `npm run dev:client`.
- `npx vitest run` (or `npm test`): only `src/**/*.test.ts` and `server/**/*.test.ts`, node environment.
- `npm run typecheck` (rewrites tracked `tsconfig.app.tsbuildinfo`: restore it before committing), `npx tsx scripts/drift-check.mts`, `npm run build`, `npx tsx scripts/shots.mts`.
- All flags, CI and gotchas: `docs/agents/recipes.md`.

## Directory map
- `server/domain`: Scene contract, wire + strict schemas, sanitizers, `LIMITS` (mirrored in `src/domain`).
- `server/application`: stream orchestration, preface, research, main call, applet call, prompts, partial parsing, trending.
- `server/infrastructure`: Genkit client + model ids, fixtures, grounding, image check, JSON recovery, Google Trends.
- `server/presentation`: Express routers (`/api/cortex`, `/api/cortex/stream`, `/api/health`, `/api/trending`). `server/fixtures`: replayable captures.
- `src/domain`: client mirror of the contract + sanitizers. `src/application`: SSE client, `useCortex` session hook.
- `src/presentation`: `components/` (shell, command, landing, session, compose, modules, applet, overlay), `scene/` (per-turn theme, motion, card grammar), `canvas/`, `hooks/`, `styles/`. `src/i18n`: every UI string (en + es).
- `scripts`: `dev.mjs`, `drift-check.mts`, `shots.mts`. `odd/tasks`: feature logbooks.

## Hard rules
- Never `dangerouslySetInnerHTML`. Never put an unvalidated model string in `style`, `src` or `href`: only `safeHttpsUrl` output and `isHex` values.
- Model-generated markup exists only inside the applet iframe `srcDoc`. Never add `allow-same-origin` to its sandbox.
- `sanitizeText` rewrites `<` and `>`. Code bodies use `sanitizeCode`; applet HTML uses `sanitizeAppletHtml`.
- Extend variety by adding a kind to the registry and both schemas. Never loosen validation.
- `server/domain/Scene.ts` and `src/domain/Scene.ts` are mirrors; change both, then run the drift check and the parity test.
- UI text goes through `src/i18n/translations.ts` (both locales). Commits: Conventional Commits, no AI attribution lines.

## If you are doing X, read Y
| Task | Read |
|---|---|
| Understand layers, request flow, Scene contract, limits | `docs/agents/architecture.md` |
| Change the model calls, prompts, stream events, partials, fixtures, client streaming | `docs/agents/generation-pipeline.md` |
| Touch applets, the iframe, its CSP, message protocol, or its threat model | `docs/agents/generated-interfaces.md` |
| Restyle, add a token, change motion, card grammar, typography | `docs/agents/design-system.md` |
| Add a module kind, Scene field, fixture, i18n string; run or verify anything; known gotchas and gaps | `docs/agents/recipes.md` |
