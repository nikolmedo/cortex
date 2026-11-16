# Design system

Direction: a surveillance-terminal HUD with soft edges. Kept: near-monochrome void, dot grid, hairlines, mono readouts, condensed display type, inverted tags, one signal hue per scene, a node-graph field behind the content. Changed: frames are rounded with one tight corner (`--r-tab`, top-left, where the tag docks), a lit gradient ring replaces corner brackets, surfaces have depth (sheen, shadow, one blur), things respond to the pointer, and fills use the signal gradient. Evoke the style only: never use the name "ctOS", the Watch Dogs logo or game assets in the product (UI, copy, assets).
Files: tokens `src/presentation/styles/tokens.css`; reset, keyframes, reduced motion `src/presentation/styles/global.css`; per-turn scope `src/presentation/scene/` ; card shell `src/presentation/components/modules/ModuleCard.module.css`. Components use CSS Modules and `var(--token)`; no CSS framework.

## Rules
1. Colour is information. Neutrals carry structure. Only the scene primary keeps its hue (`--signal`); `--danger`, `--warn`, `--ok` mark valence.
2. Allowed, within limits. Radius: only the tokens (`--frame`, `--frame-sm`, `--r-*`); one tight corner per frame. Blur: only `backdrop-filter: var(--blur)`, on floating or glass surfaces (command bar frame, top bar, settings menu, image viewer, `data-surface='glass'` card); never on an ordinary card. Shadows: `--sheen`, `--shadow-raise`, `--shadow-lift` (downward offset, negative spread), the tinted drop shadow on a `lead` card and on the focused command bar, inset track shadows, and solid 3-4 px rings (`0 0 0 Npx` in `--signal-soft` or 14-20% `--m`) round live dots and timeline nodes. Gradients: `--signal-grad` fills, the 135deg lit ring, tab-corner washes, hairline fades, `repeating-linear-gradient` tick tracks. Still forbidden: glow halos (a zero-offset blurred shadow), `text-shadow`, `filter: drop-shadow`, gradient text, raw model colours (rule 3), radius literals where a token exists.
3. Never write a raw model colour into CSS. Model colours reach CSS only as validated hex (`isHex`/`hexOr`) through `sceneCssVars` (`--scene-*`, `--signal`) or `ModuleCard` (`--m-raw`). Model enums reach CSS only as `data-*` attributes or table lookups.
4. Labels are inverted pill tags (`--paper` background, `--paper-ink` text, `--r-pill`, uppercase, condensed, tracked).
5. Every interactive element has `:focus-visible { outline: 2px solid color-mix(in srgb, var(--signal) 70%, var(--paper)); outline-offset: 3px }` (global; the applet host uses `2px solid var(--signal)`). Touch targets aim at `--hit` (44 px); the applet toolbar buttons grow to it on `(pointer: coarse)`.
6. Add a token before adding a literal. A literal that repeats twice should become a token.

## Tokens (`tokens.css`, on `:root`)

### Ink and lines
| Token | Value | Role |
|---|---|---|
| `--ink-0` | `#06080a` | page background; also the inverted card fill and applet `--bg` |
| `--ink-1` | `#0b0e11` | chart point fills and strokes, hero placeholder fill |
| `--surface` | `rgb(12 15 18 / 0.82)` | default card fill |
| `--surface-strong` | `#0e1215` | lead card fill; applet `--surface` |
| `--surface-raised` | `#161b1f` | `solid` surface fill; applet `--raised` |
| `--line` | `rgb(216 228 234 / 0.14)` | default hairline |
| `--line-strong` | `rgb(216 228 234 / 0.34)` | emphasised hairline, scrollbar thumb, track borders |

### Text and tag
| Token | Value | Role |
|---|---|---|
| `--text-hi` | `#f3f6f7` | titles, values, results |
| `--text` | `#c2cbd0` | body |
| `--text-dim` | `#8a959c` | captions, hints, units |
| `--text-faint` | `#5b666d` | defined, not referenced anywhere |
| `--paper` | `#eef2f3` | inverted tag background; selection background; segmented thumb |
| `--paper-ink` | `#07090b` | text on `--paper` |

### Valence and signal
| Token | Value | Role |
|---|---|---|
| `--danger` | `#ff5f45` | `critical` tone, errors |
| `--warn` | `#f0b849` | `caution` tone |
| `--ok` | `#8fe3b0` | `positive` tone, success |
| `--scene-primary` | `#6fc3ff` default | scene primary; registered with `@property` so palette changes crossfade |
| `--scene-secondary` | `#b4c0c6` default | secondary (55% hue mixed into steel by `sceneCssVars`) |
| `--scene-accent` | `#e6ecee` default | accent (60% hue mixed into paper); second stop of `--signal-grad` |
| `--signal` | `var(--scene-primary)` | the one accent: live/selected state, lit rings, fills |
| `--signal-soft` | `color-mix(in srgb, var(--signal) 14%, transparent)` | ring round a live dot (`0 0 0 3px`) |
| `--signal-grad` | `linear-gradient(90deg, var(--signal), color-mix(in oklab, var(--signal) 45%, var(--scene-accent)))` | the scene's two hues as one fill: bars, the active row edge |

### Typography
| Token | Value | Role |
|---|---|---|
| `--font-body` | Barlow, system sans | body text |
| `--font-display` | Saira, Barlow, system sans | titles, tags, figures; width axis 75-125, weights 300-600 |
| `--font-mono` | JetBrains Mono, ui-monospace | readouts, numerals, code, applet toolbar |
| `--fs-micro` | 0.6875rem | smallest mono labels |
| `--fs-caption` | clamp(0.75rem..0.8125rem) | tags, axis labels |
| `--fs-small` | clamp(0.8125rem..0.875rem) | secondary text, headlines inside cards |
| `--fs-body` | clamp(0.96875rem..1.0625rem) | body |
| `--fs-lead` | clamp(1.125rem..1.375rem) | numerals, lead text |
| `--fs-h3` | clamp(1.0625rem..1.1875rem) | headings (scene type scale overrides) |
| `--fs-title` | clamp(1.75rem..2.875rem) | turn title (overridden by type scale) |
| `--fs-display` | clamp(2.25rem..4rem) | landing display |
| `--fs-figure` | clamp(1.875rem..3rem) | big figures (overridden by type scale) |
| `--lh-body` | 1.58 | body line height |
| `--tag-stretch` / `--tag-tracking` | 82% / 0.09em | tag voice (condensed, tracked) |
| `--readout-tracking` | 0.06em | mono readouts |

Fonts load from Google Fonts in `index.html` (Barlow 400/500/600, JetBrains Mono 400/500, Saira wdth 75..125 wght 300..600). The applet frame cannot load web fonts (CSP) and uses system stacks.

### Space, shape, depth, layers, motion
| Token | Value | Role |
|---|---|---|
| `--sp-1`..`--sp-7` | 4, 8, 12, 16, 24, 32, 48 px | spacing scale |
| `--gutter` | clamp(16px, 4vw, 40px) | page side padding |
| `--content-max` / `--reading-max` | 1240px / 68ch | content widths |
| `--top-h` / `--hit` | 48px / 44px | top bar height; minimum touch target |
| `--r-tab` | `5px` | the tight corner (top-left of a frame, where the tag docks) |
| `--r-sm` / `--r-md` / `--r-lg` | `8px` / `14px` / `22px` | inputs and icon tiles / panels, code, rows / card corners |
| `--r-pill` | `999px` | tags, buttons, tracks, segmented controls, scrollbar thumb |
| `--frame` | `var(--r-tab) var(--r-lg) var(--r-lg) var(--r-lg)` | frame radius: cards, applet, command bar, notices |
| `--frame-sm` | `var(--r-tab) var(--r-md) var(--r-md) var(--r-md)` | same recipe for small frames (caveats) |
| `--blur` | `blur(16px) saturate(1.25)` | the one `backdrop-filter` value (rule 2 lists where) |
| `--sheen` | `inset 0 1px 0 rgb(255 255 255 / 0.05)` | lit top edge on raised surfaces |
| `--shadow-raise` | `0 18px 44px -28px rgb(0 0 0 / 0.9)` | resting depth: solid and glass cards, floating panels |
| `--shadow-lift` | `0 26px 60px -30px rgb(0 0 0 / 0.95)` | hover and focus depth |
| `--ease-spring` | `cubic-bezier(0.34, 1.4, 0.5, 1)` | overshoot easing: thumbs, nodes, row edges |
| `--beam` | `@property`, `<angle>`, initial `0deg`, not inherited (registered in `tokens.css`) | angle of the travelling light; animated by `beam` |
| `--tick` / `--cut` | 9px / 12px | leftovers of the bracket and notch frames; no stylesheet reads them |
| `--ease`, `--dur-fast/base/slow` | fallbacks | replaced per turn from mood tables by `sceneCssVars` (`motionFor`) |
| `--ease-step` | `steps(4, jump-none)` | stepped easing; unused now |
| `--z-ambient` 0, `--z-content` 1, `--z-dock` 40, `--z-top` 45, `--z-overlay` 60 | | layers |

### Per-turn properties set by `SceneTheme` (inline style from `sceneCssVars`)
`--scene-primary`, `--signal`, `--scene-secondary`, `--scene-accent`, then from `motionFor(presentation)`: `--dur-fast --dur-base --dur-slow --ease --enter --enter-scan --enter-lock --rise --enter-scale --stagger --cascade`. `SceneTheme.module.css` also sets by `data-mood` (`--card-radius`, `--card-border`, `--hairline-mix`, `--hairline-inset`; `--card-radius` and `--hairline-inset` are not read by anything), by `data-density` (`--module-gap`, `--card-pad`: sparse 24px / clamp(20..32), dense 12px / clamp(12..18)), and by `data-type-scale` (below).

### Declared on `:root`, redeclared per turn
A `var()` in a `:root` declaration resolves at `:root`, so a token derived from `--signal` keeps the default hue unless it is declared again inside the scene. Redeclared: `--signal` (inline, `sceneCssVars`), `--signal-soft` and `--signal-grad` (`.root` in `SceneTheme.module.css`). The `:root` copies are the fallback outside a scene. A new token built from `--signal` or `--scene-*` must be added to that `.root` block.

## Palette rule
- `sceneCssVars` (`src/presentation/scene/sceneTokens.ts`): `--scene-primary` and `--signal` = validated primary hex; `--scene-secondary` = `color-mix(secondary 55%, #b4c0c6)`; `--scene-accent` = `color-mix(accent 60%, #e6ecee)`. Enough hue stays in both to pair with the signal in `--signal-grad`. Do not drop the `--signal` line.
- `ModuleCard.module.css`: `--m: color-mix(in srgb, var(--m-raw, var(--scene-primary)) 62%, #b4c0c6)`. The raw module colour (`--m-raw`, set inline only when `isHex`) never paints a card. `--tone` defaults to `--m` and is swapped by `data-tone`.
- New CSS must take colours from `--signal`, `--m`, `--tone`, the neutrals, or valence tokens. Do not read `--m-raw` outside `ModuleCard.module.css`.
- Page background (`global.css` `body`): the dot grid under two `fixed` radial washes of `--signal` (13% top right, 8% bottom left) over `--ink-0`.

## Recipes (minimal CSS, as used in the code)

Soft frame with a tab corner (ModuleCard `.card`; the radius is a custom property so `data-corner` can swap it):
```css
.card { --radius: var(--frame); border: 1px solid var(--card-border, var(--line)); border-radius: var(--radius);
  background: linear-gradient(180deg, color-mix(in srgb, var(--m) 7%, transparent), transparent 130px), var(--surface);
  box-shadow: var(--sheen); }
```

Lit ring (`.card::before`; same idea in AppletFrame `.applet::before`, CommandBar `.frame::before`). A 1px gradient painted in the border box only, brightest at the tab corner:
```css
.card::before {
  --b: color-mix(in srgb, var(--tone) var(--hairline-mix, 75%), transparent);
  content: ''; position: absolute; inset: -1px; padding: 1px; border-radius: inherit; pointer-events: none;
  background: linear-gradient(135deg, var(--b), transparent 30%, transparent 72%, color-mix(in srgb, var(--tone) 28%, transparent));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
}
```

Inverted pill tag (`.title` in ModuleCard; `.eyebrow` in blocks; `.tag` in AppletFrame):
```css
.title {
  padding: 4px 11px; border-radius: var(--r-pill); background: var(--paper); color: var(--paper-ink);
  font-family: var(--font-display); font-stretch: var(--tag-stretch);
  font-size: var(--fs-caption); font-weight: 600; letter-spacing: var(--tag-tracking);
  text-transform: uppercase; box-decoration-break: clone; /* each wrapped line is its own pill */
}
```

Pointer highlight and hover lift (ModuleCard; `usePointerGlow` writes `--px`/`--py` on the card once per frame; `.glow` is `display: block` only under `(hover: hover) and (pointer: fine)`):
```css
.glowSpot { position: absolute; left: 0; top: 0; width: 380px; height: 380px; margin: -190px 0 0 -190px; border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--m) 15%, transparent), transparent);
  transform: translate(var(--px, -500px), var(--py, -500px)); }
.card:not([data-surface='bare']):hover { transform: translateY(-3px); box-shadow: var(--sheen), var(--shadow-lift); }
```

Signal-gradient fill revealed by `clip-path` (`.track`/`.fill` in `kinds.module.css`). The fill is full width, so the gradient position tells the value as well as the length. A toned card sets `--fill` to a valence gradient (`--ok`/`--warn`/`--danger` to 55% white):
```css
.track { --fill: var(--signal-grad); height: 8px; border: 1px solid var(--line-strong); border-radius: var(--r-pill); overflow: hidden; }
.fill { position: absolute; inset: 0; background: var(--fill);
  clip-path: inset(0 calc(100% - var(--w, 0) * 100%) 0 0 round var(--r-pill)); animation: fillIn var(--dur-slow) var(--ease) ... both; }
@keyframes fillIn { from { clip-path: inset(0 100% 0 0 round var(--r-pill)); } }
```
`.fill::after` adds one `fillSheen` pass (transform only, plays once). The track also has a tick every tenth (`repeating-linear-gradient`).

Travelling `beam` border (CommandBar `.frame::after`; only visible while the bar has focus, so an idle page runs no animation):
```css
.frame::after { /* same mask ring as above, padding: 1.5px */
  background: conic-gradient(from var(--beam), transparent 0 52%, color-mix(in srgb, var(--signal) 20%, transparent) 64%, var(--signal) 84%,
    color-mix(in srgb, var(--signal) 55%, var(--paper)) 92%, transparent 100%); opacity: 0; }
.frame:focus-within::after { opacity: 1; animation: beam 3s linear infinite; }
```

Soft row with a signal edge (Landing `.row`; the whole row is the button; `li` enters with an `--i` stagger):
```css
.row { border-radius: var(--r-md); transition: background-color var(--dur-fast) linear, transform var(--dur-fast) var(--ease-spring); }
.row::before { content: ''; position: absolute; left: 0; top: 20%; bottom: 20%; width: 3px; border-radius: var(--r-pill);
  background: linear-gradient(180deg, var(--signal), color-mix(in oklab, var(--signal) 45%, var(--scene-accent)));
  transform: scaleY(0); transition: transform var(--dur-base) var(--ease-spring); }
.row:hover, .row:focus-visible { background: color-mix(in srgb, var(--signal) 7%, transparent); }
.row:hover::before, .row:focus-visible::before { transform: scaleY(1); }
```
On hover the index and arrow shift 3-4 px and take `--signal`, the text shifts 5 px.

Pill segmented control (SettingsMenu `.segment`; the mobile split tabs in `blocks.module.css` `.tabList` use a `--tab` index instead of `:has()`). The thumb is `::before`; the checked option sits on it in `--paper-ink`:
```css
.segment { position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 3px;
  border: 1px solid var(--line-strong); border-radius: var(--r-pill); background: var(--ink-0); box-shadow: inset 0 1px 2px rgb(0 0 0 / 0.5); }
.segment::before { content: ''; position: absolute; top: 3px; bottom: 3px; left: 3px; width: calc((100% - 6px) / 2);
  border-radius: var(--r-pill); background: var(--paper); transition: transform var(--dur-base) var(--ease-spring); }
.segment:has(.option:nth-child(2)[aria-checked='true'])::before { transform: translateX(100%); }
```

Edge bar (toned card `::after`; error notice `[role='alert']::before`; keeps valence readable in greyscale): `left: -1px; top: calc(var(--pad) + 2px); width: 3px; height: 26px; border-radius: 0 var(--r-pill) var(--r-pill) 0; background: var(--tone)`.

Mono readout (`.numeral`, chart readouts, landing row index):
```css
.readout { font-family: var(--font-mono); font-size: var(--fs-caption);
  letter-spacing: var(--readout-tracking); font-variant-numeric: tabular-nums; color: var(--text-dim); }
```

Rule header (`data-header='rule'`): the tag drops its pill and runs into `.rule`, a 1px `linear-gradient(90deg, tone 55%, transparent)`.

Gone: corner brackets (`--tick` strokes), hatch fill on `glass`, the 3 px `bleed` border, the notch `clip-path`. The `.notch` spans are still rendered by `ModuleCard.tsx` and hidden with `display: none`.

## Card grammar (`ModuleCard.tsx` attributes) and what each value renders now
Attributes on the `<section>`: `data-kind`, `data-emphasis` (default `normal`), `data-tone` (default `neutral`), `data-surface`, `data-corner`, `data-header` (default `icon`; `numeral` without an `ordinal` falls back to `icon`), `data-enter` (the module's `reveal` directive: rise, draw, count or fade; default `rise`). The model or `fillCardGrammar` sets them. Every stylesheet rule that reads one is scoped to `.card`, never to a bare `[data-kind]`. `.card` is the container (`container-type: inline-size`) and defines `--radius`, `--m`, `--tone`, `--pad`. In the stylesheet, emphasis comes before surface so a named surface wins over `lead`/`quiet`.

| Attribute | Value | Renders |
|---|---|---|
| `data-surface` | (absent) | `--surface` fill with a 7% `--m` wash from the top, `--line` border, `--sheen` |
| | `solid` | `--surface-raised` fill, `--line-strong` border, `--sheen` + `--shadow-raise` |
| | `outline` | transparent fill, border mixed 42% from `--m`, no shadow |
| | `bleed` | 24% `--m` wash radiating from the tab corner over `--surface`, border 22% `--tone` |
| | `glass` | translucent pane (`rgb(22 27 31 / 0.5)` plus a white sheen gradient), `backdrop-filter: var(--blur)`, lit top edge, `--shadow-raise`; a scene carries at most a couple |
| | `bare` | no border, no fill, no ring, no hover lift |
| | `inverted` | `--ink-0` fill, `overflow: clip`; header becomes a full-width `--paper` band with `--paper-ink` text; at most one per scene |
| `data-corner` | (absent) | `--frame`: tight tab corner top-left, `--r-lg` elsewhere |
| | `round` | `--r-lg` on all four corners |
| | `square` | `--r-md` on all four corners (the system has no square frame) |
| | `notch` | a leaf: `--r-tab` and `30px` on alternating corners (`--r-tab 30px --r-tab 30px`) |
| `data-header` | `icon` | 28 px tinted icon tile (`--r-sm`) in `--tone` plus pill tag title |
| | `numeral` | zero-padded position in mono `--fs-lead` in `--tone`, plus title |
| | `rule` | title as plain tinted label that runs into a fading hairline |
| | `none` | title kept as `visually-hidden` `h3`; headline stays |
| `data-emphasis` | `lead` | border 26% `--tone`, 13% `--m` wash, `--surface-strong` fill, tinted drop shadow, larger tag |
| | `quiet` | transparent fill, 60% border, no shadow, tag becomes dim plain text, ring at 40% opacity |
| | `normal` | none |
| `data-tone` | `positive` / `caution` / `critical` | `--tone` = `--ok` / `--warn` / `--danger`; ring and edge bar take it; `.track` fills swap to the valence gradient |
| | `neutral` | `--tone` = `--m` |
Also: `pattern` renders `CardPattern` (contour, grid, dots, stripes, scan; low-opacity SVG, seeded by `patternSeed`); `size`/`slot`/`span` are layout, not shell.

`fillCardGrammar(modules, mood, seed)` (`scene/cardFallback.ts`) fills surface, corner, header, pattern and variant only for modules that set none of them, from per-mood tables (`GRAMMAR`), rotating so neighbours differ, no two adjacent identical surfaces, one `inverted` max. `fillTypeScale` picks a scale from the turn's first mood when the scene has none.

## Typography
| Use | Family |
|---|---|
| Body, answer text | Barlow (`--font-body`) |
| Turn title, tags, headings, figures | Saira (`--font-display`) with `font-stretch` and weight from the type-scale variables |
| Readouts, numerals, code, source view, applet toolbar | JetBrains Mono (`--font-mono`) |

Type scale tables (`SceneTheme.module.css`, selected by `data-type-scale`; absent = `tokens.css` values):
| | `--fs-title` | `--fs-figure` | `--fs-h3` | display stretch / weight / tracking | figure stretch / weight | heading weight / tracking |
|---|---|---|---|---|---|---|
| editorial | clamp(2rem, 1.5rem + 2.2vw, 3.25rem) | clamp(2rem, 1.6rem + 1.9vw, 3.25rem) | clamp(1.125rem, 1.05rem + 0.35vw, 1.3125rem) | 108% / 300 / -0.02em | 108% / 300 | 500 / - |
| technical | clamp(1.5rem, 1.2rem + 1.4vw, 2.375rem) | clamp(1.625rem, 1.35rem + 1.3vw, 2.5rem) | clamp(1rem, 0.96rem + 0.2vw, 1.0625rem) | 78% / 500 / 0.005em | 80% / 500 | 600 / 0.01em |
| monumental | clamp(2.5rem, 1.6rem + 4vw, 4.75rem) | clamp(2.5rem, 1.8rem + 3vw, 4.25rem) | clamp(1.1875rem, 1.1rem + 0.45vw, 1.4375rem) | 122% / 500 / -0.035em | 118% / 500 | 600 / -0.01em |

Figures inside cards use container query units (`cqi`) against the card, which is the container (`container-type: inline-size` on `.card`). Do not move that property.

## Motion
Keyframes (`global.css` unless noted) and where they are used:
| Keyframe | Use |
|---|---|
| `tagIn` | turn intent tag: `.eyebrow` under `[data-reveal='true']`, `420ms var(--ease) backwards`, a `clip-path` wipe left to right. The one signature entrance; nowhere else by default |
| `materialize`, `wipeIn`, `unfoldIn`, `scanIn` + `scanLine`, `lockIn` + `lockTrace` | entrance families (below); `materialize` also on the command bar, landing blocks and rows, notices, dialogs |
| `fadeIn` | tab panels, settings and viewer backdrops, landing list swap, chart marks |
| `skeletonOut`, `phraseIn` | skeleton exit; rich text phrases |
| `shimmer` | skeleton bars, pending applet `.scan`, one block in `blocks.module.css`: a soft band translating across (transform only) |
| `pulse` | live dots (top bar, landing, active plan step, applet status): 50% `opacity 0.45` and `scale(0.82)`, 1.6-2.4 s |
| `beam` | `--beam` 0 to 360deg; CommandBar `.frame::after` while focused, `3s linear infinite` |
| `orbit` | rotation helper |
| `blink` | defined (hard on/off); no stylesheet uses it now |
| `fillIn`, `fillSheen`, `railDraw`, `railDrawX`, `nodeIn`, `sweep` (`kinds.module.css`); `grow`, `wipe`, `markerIn` (`ChartModule.module.css`) | per-kind reveals inside a card: fills, timeline rails and nodes, gauge sweep, chart bars, lines, markers |

- Entrance families (`ENTER_FAMILIES` in `scene/motionProfile.ts`, keyframes in `global.css`): `rise` (`materialize`), `wipe` (`wipeIn`), `unfold` (`unfoldIn`), `scan` (`scanIn` + `scanLine`), `lock` (`lockIn` + `lockTrace`). Each animates only opacity, transform and clip-path, eases out, `backwards` fill. `ENTER_TABLE[layout][mood]` picks the scene default; a module `reveal` maps to a family (`rise`->rise, `draw`->scan, `count`->lock, `fade`->no travel; `[data-enter='fade']` also drops the inner reveals).
- A settled turn does not replay: `[data-reveal='false']` removes the inner animations in `kinds.module.css`.
- Mood tempo (`MOOD_MOTION`): calm 200/400/700 ms, kinetic 150/300/520, archival 240/480/880, volatile 140/260/440 (fast/base/slow); durations clamped to 140-900 ms. Stagger per density: sparse 80, balanced 60, dense 40 ms (mosaic x0.7). Inner cascades stop at `CASCADE_CAP_MS` = 240.
- Hover and press: cards lift `translateY(-3px)` with `--shadow-lift` and the pointer highlight (fine pointers only); the command bar lifts 2 px on `:focus-within`; rows tint 7% `--signal`, grow the edge and shift content 3-5 px; the settings close button rotates its icon 90deg on hover and `scale(0.94)` on `:active`. Springy parts (thumbs, nodes, row edges) use `--ease-spring`; colour changes use `linear` at `--dur-fast`.
- Reduced motion: `@media (prefers-reduced-motion: reduce)` and `:root[data-motion='reduced']` (the in-app setting, set by `Cortex.tsx`) force animation and transition durations to 0.01 ms (`global.css`). Also: the card lift and `.glowSpot` are removed, the command bar lift and `beam` are off (the light rests on its first angle), and applet `.scan` only animates under `prefers-reduced-motion: no-preference`. New animations must work under both and must not be the only carrier of information.
- Do not animate layout properties (width, height, top); use transform, opacity, clip-path. `--beam` is the one animated custom property (registered with `@property`).

## Where each shell component lives
| Component | Path |
|---|---|
| App shell | `src/Cortex.tsx` |
| Top bar, settings menu | `src/presentation/components/shell/TopBar.*`, `SettingsMenu.*` |
| Command bar (landing and docked) | `components/command/CommandBar.*` |
| Landing (examples, trending, recent) | `components/landing/Landing.*` |
| Session stream, turn view, skeleton | `components/session/SessionStream.*`, `TurnView.*`, `Skeleton.*` |
| Composition and blocks (header, answer, spotlight, meta, hero, sources, follow-ups, split tabs) | `components/compose/Composition.*`, `blocks.*` |
| Module card shell, renderers, chart, panel, pattern | `components/modules/ModuleCard.*`, `kinds.*`, `ChartModule.*`, `PanelModule.*`, `CardPattern.tsx` |
| Generated interface frame | `components/applet/AppletFrame.*` |
| Image viewer dialog | `components/overlay/ImageViewer.*` |
| Entrance wrapper | `components/motion/Materialize.*` |
| Inline text (`**bold**`, `` `code` ``) | `components/text/RichText.*` |
| Canvas (thinking core, ambient field) | `src/presentation/canvas/` |
| Per-turn theme, motion tables, card fallback | `src/presentation/scene/` |

## Gotchas
- A `var()` in a `:root` declaration resolves at `:root`. A token derived from `--signal` must also be redeclared in `.root` of `SceneTheme.module.css` (see Tokens).
- A class used in `.tsx` but absent from its stylesheet is `undefined` in CSS Modules and `tsc` does not catch it. Grep both sides after renaming (the `.notch` rule stays for this reason).
- SVG `rect` corners take the CSS `rx` property (`ChartModule.module.css`, for example `rx: 5px` on bars); no attribute is needed.
- The lit ring needs the `-webkit-mask` pair plus `-webkit-mask-composite: xor` and the standard `mask` with `exclude`, as in the recipe.
- `overflow: clip` on `inverted` cards and `.applet` is what rounds their inner content to the frame.
- The canvases follow the same direction. `ThinkingCore.tsx` draws four orbiting arcs, three concentric rings (one per plan step; every shape in it is circular), a signal arc on an inner track and a small round core with a faint radial tint, no halo. `AmbientField.tsx` draws a sparse node graph: round nodes drift, thin edges join near ones, one node in eight is signal-coloured, some breathe, a signal node sends out a slow ring, no glow. Restyle them in the canvas files, not in CSS.
- Applets cannot read `tokens.css`. Their shape rules live in `appletDocument.ts` (`HOST_STYLE`) and `server/application/appletPrompt.ts` (see `docs/agents/generated-interfaces.md`).
