# Generated interfaces ("applets")

A generated interface is a single self-contained HTML fragment, written by a model for one question, shown above the answer in a sandboxed iframe. It is the only place model-written markup exists. Rule 1: it never enters the app DOM.

## Files
| Concern | Path |
|---|---|
| Constants, limits, `AppletBrief`, `appletBrief`, `sanitizeAppletHtml`, `APPLET_THEME_VARS`, `APPLET_STATUSES` | `server/domain/Scene.ts` and `src/domain/Scene.ts` (mirrored) |
| Router instruction (when to ask for one) | `buildPrefacePrompt` in `server/application/prompt.ts`; wire field in `PrefaceWireSchema` (`server/domain/Scene.ts`) |
| Generation call, rejection rules | `server/application/applet.ts` |
| Applet system prompt + request | `server/application/appletPrompt.ts` |
| Stream events, fixture replay | `server/application/cortexStream.ts` |
| Client event sanitizer | `sanitizeAppletEvent` in `src/domain/Scene.ts`; wiring in `src/application/cortexService.ts`, `useCortex.ts` |
| Document builder, CSP, theme values | `src/presentation/components/applet/appletDocument.ts` |
| Sandbox attributes, message guard, height clamp | `src/presentation/components/applet/appletSandbox.ts` |
| Component and states | `AppletFrame.tsx`, `AppletFrame.module.css` (same folder) |
| Tests | `server/application/applet.test.ts`, `appletDocument.test.ts`, `appletSandbox.test.ts`, `server/domain/Scene.parity.test.ts`, `server/application/cortexStream.test.ts` |

`appletSandbox.ts` is a separate file from `AppletFrame.tsx` on purpose: on Windows two modules whose names differ only by case break `tsc`. Keep the lower-case name for the pure helpers.

## Why the HTML travels outside the Scene JSON
Inside the Scene, a 6-10 KB escaped string would stall the partial parser (strings are dropped until settled, `partial.ts`), raise the odds of a schema failure that regenerates the whole answer, and share the 75 s main-call budget. So it has its own model call, its own event (`applet`), its own timeout, and its own failure state.

## When the router asks for one
`preface.applet = {title, brief}` is set by the fast router model, not by code. The preface prompt says to include it whenever a bespoke interface would serve the user better than text, standard charts and lists. It is not a fixed catalogue; the prompt lists categories as examples only: something to operate (picker, calculator, converter, generator, timer, planner, editor, playground), explore (simulation, interactive diagram, spatial layout, reference board), play or practise (quiz, flashcards, small game, trainer), or a custom visualisation a standard module cannot draw. It must omit the field when prose, a standard chart, list, table or comparison covers the answer; a time series is a chart module, never an applet. Examples in the prompt: CSS colour picker (include), binary search stepper (include), European capitals quiz (include), Tesla stock history (omit).

`brief` fields are normalised by `appletBrief`: both `title` (<= 80) and `brief` (<= 400) must be non-empty after `sanitizeText`, else the preface reads as having no applet. When it is present, the main call's user turn gets an `INTERACTIVE INTERFACE` note: keep the answer short, do not rebuild the tool, 2-3 reference modules.

The `applet` field description inside `PrefaceWireSchema` (`server/domain/Scene.ts`) is schema guidance Gemini also reads. It states the same rule as the router prompt; change both together.

## Generation call (`generateApplet`)
- Model: the main model (`resolveModelRef()`, env `GEMINI_MODEL`), temperature 0.4, max 16384 output tokens, thinking LOW (dropped process-wide after a 400 mentioning "thinking"), plain text, no schema. Timeout 45 s (`CORTEX_APPLET_TIMEOUT_MS`).
- System prompt (`buildAppletPrompt(lang)`): return only the fragment that goes inside `<body>`; any form of interface; complete working logic; no invented figures; inline `<style>` and one `<script>` only; no external resources, network, storage, dialogs, navigation or forms; at most `LIMITS.appletHtml` characters; works from 320 px; keyboard operable with labels and `aria-live`; copy buttons use `navigator.clipboard.writeText` then fall back to select + `document.execCommand('copy')`; style with the host theme variables, square corners, hairline borders, no shadows, no gradients except content, no glow, no blur. Language: every visible string in the turn language; identifiers in English.
- User turn: `QUESTION`, `TOOL` (title), `WHAT IT MUST DO` (brief).
- `THEME_ROLES` in `appletPrompt.ts` is `Record<AppletThemeVar, string>`: adding a theme variable fails to compile until the prompt explains it.

Rejection rules (any one gives `null`, logged with `[cortex] applet rejected ...`):
1. `finishReason` in {`length`, `blocked`, `interrupted`}.
2. Unbalanced `<script>` / `<style>` (open count != close count): an unclosed one would swallow the rest of the frame.
3. `sanitizeAppletHtml` returns `null`: not a string, blank, or longer than 32000 characters (rejected, never truncated).
4. Any thrown error, timeout or abort (not logged as an error when the client aborted).
`extractAppletHtml` first unwraps the markup from a Markdown fence or surrounding prose; a reply already starting with `<` is kept whole (a fence inside it is the tool's own content).

Live path verified on 2026-11-15 against `gemini-3.8-flash`: five queries (binary search stepper, CSS colour picker, solar system orrery, capitals quiz, plus two with no applet) produced `ready` applets of 11-17 KB in 29-36 s. Re-verify after any change to `applet.ts` or the prompts with a real key; unit tests inject a fake `AppletModel`.

## `applet` stream event
`{status:'pending', title}` is sent right after the preface; then exactly one of `{status:'ready', title, html}` or `{status:'failed', title}`. Server type `AppletEvent` in `cortexStream.ts`; client type `AppletState {status, title, html?}` in `src/domain/Scene.ts`. Client rules: unparseable event ignored; `ready` with markup failing `sanitizeAppletHtml` becomes `failed`; a pending applet is shown as `failed` when its turn ends, errors or is cancelled (`settleApplet`). `done` waits for the applet, so the SSE stream can stay open after the `scene` event for up to the applet timeout; the turn is already `done` by then.

## Rendering
`TurnView` renders `<AppletFrame applet={turn.applet} lang={turn.lang} />` above the skeleton and the composition. `AppletFrame` states (`data-state`):
| State | When | Shows |
|---|---|---|
| pending | status pending | scan line, `applet.building` text and hint (i18n) |
| ready | status ready and html present | `Sandbox` iframe |
| failed | status failed or ready without html | `applet.failed` message; the answer below still covers the question |
| stopped | the frame loaded a second time (it navigated itself) | iframe removed, `applet.stopped` message; the Reload button remounts it |
Toolbar (only when html exists): title as inverted tag, `applet.kind` label, Reload (increments a `key`, remounting the iframe and its counters), Source (shows the HTML in a `<pre>` as a React text node). Strings: `applet.*` in `src/i18n/translations.ts` (both locales).

### Iframe attributes (`appletFrameAttributes`)
`sandbox="allow-scripts"`, `allow="clipboard-write"`, `referrerPolicy="no-referrer"`, `title`, `srcDoc`, inline `style={{height}}`. Nothing else.

### CSP (`APPLET_CSP`, a `<meta http-equiv>` in the srcdoc head, pinned by a test)
```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'
```

### Document (`buildAppletDocument(html, lang)`)
Order: `<!doctype html>`, `<html lang>`, `<head>`: charset meta, `<base href="about:srcdoc">`, CSP meta, viewport meta, host `<style>` (theme variables on `:root`, `color-scheme: dark`, border-box, body padding 16 px, square controls, `:focus-visible` outline `1px solid var(--paper)`), host `<script>` (size reporter), `</head>`, `<body>` + applet markup verbatim + `</body></html>`. The CSP and the reporter come before the applet so an unclosed tag cannot swallow them or disable the policy. The `<base>` must stay before the CSP meta: a srcdoc document inherits the host page URL as its base, so without it `href="#"` navigates the frame and trips the stopped state, and `base-uri 'none'` rejects any `<base>` placed after the policy.

### Message protocol and height
The frame may send one message: `parent.postMessage({type:'cortex-applet-size', height}, '*')` (`APPLET_SIZE_MESSAGE`). It observes `<html>` with a `ResizeObserver` plus `load`, so it grows and shrinks. The host listener calls `readAppletSize(event, frameRef.current?.contentWindow)`: accepted only if `event.source` is exactly that frame window (the sandboxed origin is opaque `"null"`, so identity is the guard), `data.type` matches, and `height` is a finite number; the result is clamped to 160-900 px (`APPLET_MIN_HEIGHT`, `APPLET_MAX_HEIGHT`). Initial height 360 (`APPLET_INITIAL_HEIGHT`). Any other message is ignored. The frame never receives host messages.

### Theme variables contract
`APPLET_THEME_VARS` (mirrored constant): `--bg --surface --raised --line --line-strong --text --text-hi --text-dim --paper --paper-ink --signal --danger --ok --font-body --font-mono`. Three places must agree, and each is enforced:
- `APPLET_THEME` in `appletDocument.ts` is `Readonly<Record<AppletThemeVar, string>>` with the host values (hand-copied from `src/presentation/styles/tokens.css`, because the frame cannot read the host stylesheet). Font stacks are system-only because the CSP blocks web fonts.
- `THEME_ROLES` in `appletPrompt.ts` (compile-time).
- Test `appletDocument.test.ts` "defines every theme variable the applet prompt lists, with the host values": key order equals `APPLET_THEME_VARS`, the document contains each `name:value;`, and it pins `--bg #06080a`, `--paper #eef2f3`, `--signal #6fc3ff`, `--line rgb(216 228 234 / 0.14)`.
If you change a token value in `tokens.css` that has an applet twin (`--ink-0`->`--bg`, `--surface-strong`->`--surface`, `--surface-raised`->`--raised`, `--line`, `--line-strong`, `--text`, `--text-hi`, `--text-dim`, `--paper`, `--paper-ink`, `--danger`, `--ok`), update `APPLET_THEME` and that test by hand. The applet's `--signal` is a fixed default `#6fc3ff`, not the per-turn scene colour.

## Threat model
Sandbox + CSP prevent:
- Reading or writing the app: no `allow-same-origin`, so the frame has an opaque origin; it cannot touch the parent DOM, cookies or `localStorage` (storage APIs fail in an opaque origin).
- Network: `connect-src 'none'`, `default-src 'none'`, `img-src data: blob:`, `form-action 'none'`, `base-uri 'none'` block fetch/XHR/WebSocket, remote images, scripts, fonts, form posts and `<base>` rewrites.
- Dialogs, popups, form submission, top navigation: the tokens `allow-modals`, `allow-popups`, `allow-forms`, `allow-top-navigation` are absent, so `alert`, `window.open`, `<form>` submission and navigating the parent are inert. Referrer is not sent.

They do NOT prevent:
- Self-navigation. The frame can still change its own location (or `meta refresh`); CSP has no navigation control. Navigation to a remote URL can emit one request before the host notices. Mitigation in place: `AppletFrame` counts `load` events; the second one means the frame left the srcdoc, so the iframe is removed (`stopped` state). Detection happens after the request.
- CPU-heavy or endless scripts; there is no CPU or memory budget and no worker isolation.
- Inheriting a host CSP. A `srcdoc` frame is also constrained by the embedding document's CSP. The server sets no CSP or other security headers for the app today. If a host CSP is ever added, it must still permit what the applet policy allows (inline script and style, `data:`/`blob:` media) or applets will silently break; test with the `css-color-picker` fixture.
- Clipboard reliability. `allow="clipboard-write"` did not make `navigator.clipboard.writeText` work in Chromium for this opaque-origin srcdoc frame; copying works through the `execCommand('copy')` fallback the prompt requires.
- Wrong or invented content. The prompt tells the model not to invent figures, but nothing verifies it.

## Rules for changing it
1. Never add `allow-same-origin` (with `allow-scripts` it lets the frame remove its own sandbox). Do not add `allow-top-navigation`, `allow-popups`, `allow-forms`, `allow-modals`.
2. Never render applet HTML anywhere except iframe `srcDoc`. The app DOM rule is unchanged: no `dangerouslySetInnerHTML`; the Source view prints it as text.
3. Loosening the CSP needs a threat-model update here and an updated pin in `appletDocument.test.ts`.
4. Any new host-to-frame or frame-to-host message needs a source-identity check like `readAppletSize` and a test in `appletSandbox.test.ts`.
5. Keep `sanitizeAppletHtml` and `LIMITS.appletHtml` identical in both mirrors (drift check + parity test cover them).
6. Keep the three theme places in sync (above). Keep the prompt's HARD LIMITS aligned with what the CSP actually blocks.
7. Applet failure must stay non-fatal for the answer: never turn it into an `error` event or block `scene`.

## Add a fixture with an applet
1. Live capture (needs `GEMINI_API_KEY`): `NODE_ENV=development CORTEX_CAPTURE_DIR=server/fixtures npm run dev:server`, run `npm run dev:client`, ask a query that makes the router set `applet`. The file `<slug>.json` includes `applet: {title, html}` once generation succeeded.
2. Hand-written: copy `server/fixtures/css-color-picker-hex-rgb-hsl.json` and set `query`, `lang`, `preface` (with `applet: {title, brief}`), `applet: {title, html}`, `scene`, `timing`. `html` must pass `sanitizeAppletHtml` (non-empty, <= 32000 chars, `<style>`/`<script>` balanced if you want it to also pass the live rule). Name the file `slugify(query, lang)` so `pickFixture` finds it by shared words.
3. Replay: `NODE_ENV=development CORTEX_FIXTURES=1 npm run dev:server` + `npm run dev:client`. The frame shows `pending` after ~0.7 s and `ready` at ~4.2-5 s.
4. `npx tsx scripts/shots.mts --only=<name>`: waits for `[data-status="done"]` and then for the `section[data-state="pending"]` frame to detach before shooting.


## Residual risks (verified 2026-11-15, Chromium 156)
- The meta CSP blocked fetch, XHR, WebSocket, EventSource, sendBeacon, images, stylesheets, fonts, media, nested frames and blob workers. It does **not** stop WebRTC: an applet `RTCPeerConnection` sent STUN packets, and the `webrtc 'block'` directive was ignored. Do not describe the sandbox as "no network"; say it blocks HTTP-family requests and external resources.
- What an applet could leak that way: only its own markup, the user's query and what the user types into the frame. It has an opaque origin: no cookies, storage or host DOM.
- Self-navigation: the frame can still navigate itself. The host shows `stopped` on the second `load`, which fires only once the new document finishes loading, so a destination that never finishes would stay displayed. No watchdog exists.
- CPU: an infinite loop in an applet did not freeze the host in Chromium (out-of-process sandboxed frame). Firefox and Safari are unverified.
- If `generateApplet` rejects, the stream emits `applet` `failed` (not only `done`).
