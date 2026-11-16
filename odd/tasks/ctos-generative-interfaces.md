# ctOS generative interfaces

Objective: restyle Cortex with a ctOS-inspired surveillance-HUD aesthetic and let any query generate its own interface, including interactive tools.
Branch: `feat/ctos-generative-interfaces`. Delivery strategy: `ask-on-risk`, chain strategy `feature-branch-chain` (chosen by the user 2026-11-15; forecast well over 400 lines).
Test runner: `npm test` (vitest), `npm run typecheck`, `npx tsx scripts/drift-check.mts`, `npm run build`.

## Specs

- **S1** "mejorarlo con estetica de ctOS (Watch Dogs)". The whole shell and every module read as one ctOS-inspired system: near-monochrome void, hairline frames, square corners, inverted label tags, one signal colour. Assumption: evoke the style only; no ctOS name, logo or game assets in the UI.
- **S2** "que tenga interfaces autogeneradas para mostrar contenido dinamico segun el tipo de consulta que se haga, por ejemplo si se quiere ver la evolución de una stock en el tiempo muestra un grafico, pero si se pide un selector de colores css, debe ser capaz de generarlo y así con cualquier consulta que se haga."
  - S2a A time-evolution query renders a chart. Assumption: the chart accepts a real time series (up to 60 points) fed by grounded research; no market-data provider is added and no price is invented.
  - S2b Any query whose content a standard module cannot express well (a tool such as a CSS colour picker, a simulation, an explorable diagram, a quiz, a custom visualisation: the colour picker is only an example) produces a working interactive interface generated from scratch for that query. There is no fixed catalogue of widgets.
  - S2c Assumption: generated markup never enters the app DOM. It runs in an `iframe` with `sandbox="allow-scripts"` only, `srcdoc`, and an injected CSP that blocks all network access; it is produced by its own model call, streamed on its own event, and fails on its own without breaking the answer.
- **S3** "Haz una renovación en la funcionalidad y en la UI/UX." Landing, command bar, top bar, turn view, loading states and module cards are redesigned, responsive at 390/768/1440, with visible keyboard focus and reduced motion respected.
- **S4** Existing behaviour holds: every current fixture still validates and renders, the server/client Scene mirrors stay in sync, existing tests pass.
- **S5** "Todo lo que hagas e investigues debe quedar documentado para ahorrar tokens en futuras request y que no requieran este nivel de investigación en el futuro, toda documentación debe estar optimizada para agentes que lo vayan a leer". Agent-facing docs in the repo cover the architecture map, the design system, the generation pipeline, the interface sandbox, how to add a module kind, and the dev/test commands, each with file paths, so a future agent does not need to re-explore.

## Tasks

- [ ] T1 (S1, S3) Design tokens, global styles, card shell, scene palette constraint. Route: inline (design decisions belong to the parent).
- [ ] T2 (S1, S3) Restyle shell and module CSS against the T1 tokens. Route: delegated, parallel unit with T3 (disjoint surfaces, several hundred lines each).
- [ ] T3 (S2b, S2c) Interface pipeline: preface tool brief, separate generation call, `interface` stream event, sandboxed frame, fixtures and tests. Route: delegated, parallel unit with T2. Risk: item 2 (sandbox).
- [ ] T4 (S2a) Chart time series: higher point cap, time axis. Route: delegated with T3 (same contract files).
- [ ] T5 (S4) Seam check: typecheck, tests, drift-check, build, screenshots at three widths, README. Route: inline plus test-runner.
- [ ] T6 (S5) Agent docs: root `CLAUDE.md` index plus `docs/agents/*.md`. Route: delegated to doc-writer once the code is final, parent supplies the verified facts.

## Log

- L1 (2026-11-15) User request, verbatim: "Podrías analizar el diseño actual y mejorarlo con estetica de ctOS (Watch Dogs) y que tenga interfaces autogeneradas para mostrar contenido dinamico segun el tipo de consulta que se haga, por ejemplo si se quiere ver la evolución de una stock en el tiempo muestra un grafico, pero si se pide un selector de colores css, debe ser capaz de generarlo y así con cualquier consulta que se haga. Haz una renovación en la funcionalidad y en la UI/UX. Utiliza los modelos y agentes que creas mejor para cada tarea, selecciona tambien su nivel de esfuerzo, eres el orquestrador, pero puedes usar haiku, sonnet y opus para ahorrar tokens en las tareas que creas ideal para cada modelo"
- L2 Analysis of the current design: blue-black radial background with holographic glow, every module in the same rounded card shell, Saira/Hanken type, per-scene three-colour palette. Module kinds are a closed registry (16 kinds), so a tool such as a colour picker cannot be expressed today.
- L3 Decision: generated HTML travels outside the Scene JSON. Inside it, a 6-10 KB escaped string would stall the partial parser (strings are dropped until settled, `server/application/partial.ts:51`), raise the odds of a schema failure that regenerates the whole answer, and share the 75 s budget.
- L5 (2026-11-15) User correction, verbatim: "Todo lo que hagas e investigues debe quedar documentado para ahorrar tokens en futuras request y que no requieran este nivel de investigación en el futuro, toda documentación debe estar optimizada para agentes que lo vayan a leer". Added S5 and T6.
- L6 (2026-11-15) User correction, verbatim: "Lo del selector css es un ejemplo, debe poder generar dinamicamente cualquier tipo de contenido". S2b rewritten; the router rule and the applet prompt no longer restrict the interface to tools. T3 reopened for that prompt change only.
- L4 Decision: this deliberately relaxes the earlier "the model writes no markup" rule, bounded by the sandbox in S2c. The app DOM rule is unchanged.
