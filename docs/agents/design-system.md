# Design system

Direction: a surveillance-terminal HUD. Near-monochrome void, hairline frames, square corners, inverted label tags, one signal colour per scene. Evoke the style only: never use the name "ctOS", the Watch Dogs logo or game assets in the product (UI, copy, assets).
Files: tokens `src/presentation/styles/tokens.css`; reset, keyframes, reduced motion `src/presentation/styles/global.css`; per-turn scope `src/presentation/scene/` ; card shell `src/presentation/components/modules/ModuleCard.module.css`. Components use CSS Modules and `var(--token)`; no CSS framework.

## Rules
1. Colour is information. Neutrals carry structure. Only the scene primary keeps its hue (`--signal`); `--danger`, `--warn`, `--ok` mark valence.
2. Forbidden: border-radius (everything is `0`), gradient washes, glow, blur, backdrop-filter, shadows, text-shadow. Gradients exist only as hairlines: corner brackets (8 one-pixel `linear-gradient` strokes), hatch fills (`repeating-linear-gradient` 1 px lines), tick tracks.
3. Never write a raw model colour into CSS. Model colours reach CSS only as validated hex (`isHex`/`hexOr`) through `sceneCssVars` (`--scene-*`, `--signal`) or `ModuleCard` (`--m-raw`). Model enums reach CSS only as `data-*` attributes or table lookups.
4. Labels are inverted tags (`--paper` background, `--paper-ink` text, uppercase, condensed, tracked).
5. Every interactive element has `:focus-visible { outline: 1px solid var(--paper); outline-offset: 3px }` (global). Touch targets aim at `--hit` (44 px); the applet toolbar buttons grow to it on `(pointer: coarse)`.
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
| `--text-faint` | `#5b666d` | defined, not referenced anywhere yet |
| `--paper` | `#eef2f3` | inverted tag background; focus ring; selection background |
| `--paper-ink` | `#07090b` | text on `--paper` |

### Valence and signal
| Token | Value | Role |
|---|---|---|
| `--danger` | `#ff5f45` | `critical` tone, errors |
| `--warn` | `#f0b849` | `caution` tone |
| `--ok` | `#8fe3b0` | `positive` tone, success |
| `--scene-primary` | `#6fc3ff` default | scene primary; registered with `@property` so palette changes crossfade |
| `--scene-secondary` | `#b4c0c6` default | muted secondary (30% hue mixed into steel by `sceneCssVars`) |
| `--scene-accent` | `#e6ecee` default | muted accent (22% hue mixed into paper) |
| `--signal` | `var(--scene-primary)` | the one accent: live/selected state, brackets, fills |

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

### Space, shape, layers, motion
| Token | Value | Role |
|---|---|---|
| `--sp-1`..`--sp-7` | 4, 8, 12, 16, 24, 32, 48 px | spacing scale |
| `--gutter` | clamp(16px, 4vw, 40px) | page side padding |
| `--content-max` / `--reading-max` | 1240px / 68ch | content widths |
| `--top-h` / `--hit` | 48px / 44px | top bar height; minimum touch target |
| `--r-sm`/`--r-md`/`--r-lg`/`--r-pill`, `--blur` | `0px` / `none` | kept so nothing needs renaming; not referenced by any rule today |
| `--tick` | 9px | corner bracket arm length (16px on a lead card) |
| `--cut` | 12px | diagonal cut of a notched frame |
| `--ease`, `--dur-fast/base/slow` | fallbacks | replaced per turn from mood tables by `sceneCssVars` (`motionFor`) |
| `--ease-step` | `steps(4, jump-none)` | stepped easing for scan-like motion |
| `--z-ambient` 0, `--z-content` 1, `--z-dock` 40, `--z-top` 45, `--z-overlay` 60 | | layers |

### Per-turn properties set by `SceneTheme` (inline style from `sceneCssVars`)
`--scene-primary`, `--signal`, `--scene-secondary`, `--scene-accent`, then from `motionFor(presentation)`: `--dur-fast --dur-base --dur-slow --ease --enter --enter-scan --enter-lock --rise --enter-scale --stagger --cascade`. `SceneTheme.module.css` also sets by `data-mood` (`--card-radius`, `--card-border`, `--hairline-mix`, `--hairline-inset`; `--card-radius` and `--hairline-inset` are not read by anything), by `data-density` (`--module-gap`, `--card-pad`: sparse 24px / clamp(20..32), dense 12px / clamp(12..18)), and by `data-type-scale` (below).

## Palette rule
- `sceneCssVars` (`src/presentation/scene/sceneTokens.ts`): `--scene-primary` and `--signal` = validated primary hex; `--scene-secondary` = `color-mix(secondary 30%, #b4c0c6)`; `--scene-accent` = `color-mix(accent 22%, #e6ecee)`. A `var()` declared on `:root` resolves there, so `--signal` is redeclared per turn; do not drop that line.
- `ModuleCard.module.css`: `--m: color-mix(in srgb, var(--m-raw, var(--scene-primary)) 40%, #b4c0c6)`. The raw module colour (`--m-raw`, set inline only when `isHex`) never paints a card. `--tone` defaults to `--m` and is swapped by `data-tone`.
- New CSS must take colours from `--signal`, `--m`, `--tone`, the neutrals, or valence tokens. Do not read `--m-raw` outside `ModuleCard.module.css`.

## Recipes (minimal CSS, as used in the code)

Hairline frame (ModuleCard `.card`):
```css
.card { border: 1px solid var(--card-border, var(--line)); background: var(--surface); }
```

Corner brackets (eight strokes, `.card::before`; same in AppletFrame, CommandBar, hero):
```css
.card::before {
  --b: color-mix(in srgb, var(--tone) var(--hairline-mix, 70%), var(--line-strong));
  content: ''; position: absolute; inset: -1px; pointer-events: none;
  background:
    linear-gradient(var(--b), var(--b)) top left / var(--tick) 1px,
    linear-gradient(var(--b), var(--b)) top left / 1px var(--tick),
    /* ...same pair for top right, bottom left, bottom right */;
  background-repeat: no-repeat;
}
```

Inverted tag (`.title` in ModuleCard; `.eyebrow` in blocks):
```css
.title {
  padding: 3px 8px; background: var(--paper); color: var(--paper-ink);
  font-family: var(--font-display); font-stretch: var(--tag-stretch);
  font-size: var(--fs-caption); font-weight: 600; letter-spacing: var(--tag-tracking);
  text-transform: uppercase; box-decoration-break: clone; /* each wrapped line is its own tag */
}
```

Mono readout (`.numeral`, chart readouts, landing row index):
```css
.readout { font-family: var(--font-mono); font-size: var(--fs-caption);
  letter-spacing: var(--readout-tracking); font-variant-numeric: tabular-nums; color: var(--text-dim); }
```

Hatch fill (`surface: glass`; a hatched field means "overlay"):
```css
.card[data-surface='glass'] {
  background: repeating-linear-gradient(135deg, rgb(216 228 234 / 0.035) 0 1px, transparent 1px 7px), var(--surface);
}
```

Signal bar (`surface: bleed` edge, and the 3x28 px edge bar on a toned card, which keeps valence readable in greyscale):
```css
.card[data-surface='bleed'] { border-left: 3px solid var(--tone); }
.card[data-tone]:not([data-tone='neutral'])::after { content:''; position:absolute; left:-1px; top:var(--pad); width:3px; height:28px; background:var(--tone); }
```

Square progress track (`.track`/`.fill` in `kinds.module.css`): hairline box, a tick every tenth, solid `--tone` fill scaled with `transform: scaleX(var(--w))`.

Row list that inverts on hover (Landing `.row`):
```css
.row:hover, .row:focus-visible { background: var(--paper); color: var(--paper-ink); }
.row:hover :is(.rowIndex, .rowArrow) { color: inherit; }
.row:focus-visible { outline-offset: -4px; outline-color: var(--paper-ink); }
```

Notch (`corner: notch`): `clip-path: polygon(0 0, calc(100% - var(--cut)) 0, 100% var(--cut), 100% 100%, var(--cut) 100%, 0 calc(100% - var(--cut)))` plus two `.notch` spans that redraw the clipped border diagonals.

## Card grammar (`ModuleCard.tsx` attributes) and what each value renders now
Attributes on the `<section>`: `data-kind`, `data-emphasis` (default `normal`), `data-tone` (default `neutral`), `data-surface`, `data-corner`, `data-header` (default `icon`; `numeral` without an `ordinal` falls back to `icon`), `data-enter` (the module's `reveal` directive: rise, draw, count or fade; default `rise`). The model or `fillCardGrammar` sets them. Every stylesheet rule that reads one is scoped to `.card`, never to a bare `[data-kind]`.

| Attribute | Value | Renders |
|---|---|---|
| `data-surface` | (absent) | `--surface` fill, `--line` border |
| | `solid` | `--surface-raised` fill, `--line-strong` border |
| | `outline` | transparent fill, border mixed 45% from `--m` |
| | `bleed` | 3 px `--tone` left edge, `--surface` fill (no wash) |
| | `glass` | hatched field over `--surface`, `--line-strong` border |
| | `bare` | no border, no fill (no hover frame) |
| | `inverted` | `--ink-0` fill; header becomes a full-width `--paper` band with `--paper-ink` text; at most one per scene |
| `data-corner` | `round`, `square` | both the square frame (the system has no radius) |
| | `notch` | clipped top-right and bottom-left corners with redrawn diagonals |
| `data-header` | `icon` | 24 px bordered kind icon in `--tone` plus inverted-tag title |
| | `numeral` | zero-padded position in mono `--fs-lead` in `--tone`, plus title |
| | `rule` | title as plain tinted label that runs into a hairline |
| | `none` | title kept as `visually-hidden` `h3`; headline stays |
| `data-emphasis` | `lead` | `--tick` 16 px, `--line-strong` border, `--surface-strong` fill, larger tag |
| | `quiet` | transparent fill, 60% border, tag becomes dim plain text, brackets 45% opacity |
| | `normal` | none |
| `data-tone` | `positive` / `caution` / `critical` | `--tone` = `--ok` / `--warn` / `--danger` plus the edge bar |
| | `neutral` | `--tone` = `--m` |
Also: `pattern` renders `CardPattern` (contour, grid, dots, stripes, scan; low-opacity SVG, seeded by `patternSeed`); `size`/`slot`/`span` are layout, not shell. Hover on non-bare cards on fine pointers firms up the frame (`.glow`, a `--line-strong` border); there is no moving highlight (`usePointerGlow` in `ModuleCard.tsx` still writes `--px`/`--py`, but no stylesheet reads them).

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
- One signature entrance: `tagIn` (`global.css`), an inverted tag printing left to right with `steps(10, end)`, used for the turn intent tag (`.eyebrow` under `[data-reveal='true']`) and nowhere else by default.
- Entrance families (`ENTER_FAMILIES` in `scene/motionProfile.ts`, keyframes in `global.css`): `rise` (`materialize`), `wipe` (`wipeIn`), `unfold` (`unfoldIn`), `scan` (`scanIn` + `scanLine`), `lock` (`lockIn` + `lockTrace`). Each animates only opacity, transform and clip-path, eases out, `backwards` fill. `ENTER_TABLE[layout][mood]` picks the scene default; a module `reveal` maps to a family (`rise`->rise, `draw`->scan, `count`->lock, `fade`->no travel).
- Mood tempo (`MOOD_MOTION`): calm 200/400/700 ms, kinetic 150/300/520, archival 240/480/880, volatile 140/260/440 (fast/base/slow); durations clamped to 140-900 ms. Stagger per density: sparse 80, balanced 60, dense 40 ms (mosaic x0.7). Inner cascades stop at `CASCADE_CAP_MS` = 240.
- Hard on/off markers use `blink` (no fades). Status cursors use stepped easing.
- Reduced motion: `@media (prefers-reduced-motion: reduce)` and `:root[data-motion='reduced']` (the in-app setting, set by `Cortex.tsx`) force animation/transition durations to 0.01 ms. New animations must work under both and must not be the only carrier of information.
- Do not animate layout properties (width, height, top); use transform, opacity, clip-path.

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
