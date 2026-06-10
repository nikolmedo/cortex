# CORTEX

A futuristic AI-powered knowledge graph visualizer. Type any query — a person, place, film, company, concept — and watch the information render as an animated, interactive node graph in real time.

---

## What it does

- Submits your query to a Gemini model with Google Search grounding
- Parses the response into a structured knowledge graph
- Renders the full constellation at once — subject at center, categories orbiting, every fact card visible with zero overlap, laid out by a force simulation (`d3-force` + rectangle collision)
- Pan, zoom (wheel / trackpad pinch / touch pinch) and auto fit-to-view for any graph size
- Glassmorphism nodes over a gradient nebula background with grain, hex grid and drifting data particles
- Dossier panel: a translucent research sidebar with the hero image, summary, metadata and every fact — selectable and copyable
- Immersive mode (`i` key or toggle): hides all chrome, leaving only the full-screen graph; category details open in a glass bottom sheet
- Click any image to open it in a lightbox; failed images fall back to an animated monogram
- Settings menu: default view mode (panel / immersive) and language (EN / ES) — the language also drives the language Gemini answers in
- Mobile (<768px): an ordered futuristic layout — hero card, summary, metadata and category accordions

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + TypeScript (strict) |
| Layout engine | `d3-force` (settled synchronously) + custom rectangle collision |
| Styling | CSS Modules + design tokens (`tokens.css`) — no CSS framework |
| i18n | Typed in-house module (`src/i18n/translations.ts`), EN default + ES |
| Backend | Node.js + Express |
| AI runtime | Genkit + `@genkit-ai/google-genai` |
| AI model | Google Gemini (configurable via `GEMINI_MODEL`) |
| Search grounding | `googleSearch` tool (built-in Gemini grounding) |
| Rendering | SVG edges + absolute-positioned HTML nodes on a pan/zoom stage |
| Fonts | Orbitron + Space Mono (Google Fonts) |
| Icons | lucide-react |

---

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Create `.env`**

```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.0-flash
PORT=3001
```

Get an API key at [aistudio.google.com](https://aistudio.google.com).

**3. Run**

```bash
npm run dev
```

This opens the backend (API on port 3001) and the frontend in **two separate
terminal windows**. Wait for `Cortex server running on http://localhost:3001`
in the SERVER window, then open [http://localhost:5173](http://localhost:5173).

> Why two windows? `tsx watch` needs its own console (TTY). Running both
> processes through `concurrently` in one pane is unreliable on Windows — the
> server's watch child fails to keep the port bound and the client gets
> `ECONNREFUSED`. Separate windows sidestep that.

Prefer a single pane? `npm run dev:concurrent` still uses `concurrently`, or run
each side yourself: `npm run dev:server` and `npm run dev:client`.

---

## Switching models

Change `GEMINI_MODEL` in `.env` and restart the dev server. Any Gemini model that supports the `google_search` grounding tool works:

| Model | Notes |
|---|---|
| `gemini-2.0-flash` | Default — fast, good quality |
| `gemini-3-flash-preview` | Faster, slightly lighter |
| `gemini-2.5-pro` | Best quality, slower |

---

## Graph structure

The AI returns a JSON schema that drives the entire visualization:

```
title / subtitle / summary
├── CATEGORY A  ──  fact · fact · fact
├── CATEGORY B  ──  fact · fact
├── CATEGORY C  ──  fact · fact · fact · fact
└── ...
```

The model returns 4–8 categories and 2–5 facts per category depending on how information-rich the subject is. Each category also includes a color and an `image_query` used to fetch contextual images.

The request body is `{ query: string, lang?: 'en' | 'es' }`. Human-readable values come back in the requested language; JSON field names and `image_query` always stay in English.

### The no-overlap guarantee

Fact cards have variable heights (text is never truncated), so the layout is solved, not positioned:

1. Each card's height is measured with a canvas (same font metrics as the CSS, gated on `document.fonts.ready`)
2. A `d3-force` simulation (link + charge + radial orbit + circle collision + a custom rectangle-separation pass) is settled synchronously with a fixed tick count — deterministic per dataset
3. The union bounding box is fitted to the viewport (`fitView`), and refitted on resize, dossier toggle and immersive toggle

`npx tsx scripts/layout-check.mts` asserts zero rectangle intersections on synthetic 4×2, 6×4 and 8×5 datasets.

---

## Interactions

| Action | Effect |
|---|---|
| Type query + Enter | Submits search, plays the staggered graph reveal |
| Drag / wheel / pinch | Pan and zoom the graph |
| Double-click background | Re-fit the whole graph |
| Click category node | Focus mode — camera zooms to that subtree, the rest dims (Esc to exit) |
| Click category node (immersive) | Opens the category detail sheet |
| Click center image / hero image | Opens the lightbox |
| `i` | Toggle immersive mode |
| Click query chip | Re-runs a previous query |
| Gear icon | Settings: default view mode + language |
| NEW QUERY | Returns to the input screen |

---

## Project structure

```
cortex/
├── server/                    # Node.js/Express backend
│   ├── index.ts               # Entry point — loads dotenv, starts Express
│   ├── application/
│   │   ├── cortexFlow.ts      # Genkit flow — calls Gemini with grounding
│   │   └── prompt.ts          # System prompt + language instruction
│   ├── domain/
│   │   └── GraphData.ts       # Graph data types
│   ├── infrastructure/
│   │   ├── geminiClient.ts    # Genkit + googleAI plugin setup
│   │   └── parseGraphData.ts  # JSON extraction + validation
│   └── presentation/
│       └── cortexRouter.ts    # POST /api/cortex route
├── src/                       # React frontend
│   ├── main.tsx               # React root mount + global CSS imports
│   ├── Cortex.tsx             # Root: providers + desktop/mobile branch
│   ├── application/           # useCortex hook + API client
│   ├── domain/                # Shared domain types + type colors
│   ├── i18n/                  # translations.ts (all UI strings) + context
│   ├── infrastructure/        # Color constants + image URL presets
│   ├── layout/                # Force layout, measurement, fit-to-view
│   └── presentation/
│       ├── styles/            # tokens.css + global.css
│       ├── hooks/             # panZoom, settings, ui state, breakpoint…
│       └── components/
│           ├── graph/         # GraphStage, EdgeLayer, nodes
│           ├── dossier/       # Research panel + shared sections
│           ├── overlay/       # Lightbox, NodeDetailSheet
│           ├── settings/      # SettingsMenu
│           ├── mobile/        # MobileExplorer, HeroCard
│           └── background/    # Nebula, Particles
├── scripts/layout-check.mts   # No-overlap assertion on synthetic datasets
├── index.html
├── vite.config.ts
└── .env                       # Your API key (gitignored)
```

---

## Notes

- The Gemini API key lives server-side only — it is never exposed to the browser.
- Images cascade: direct URL from the model → keyword fallback (loremflickr) → animated monogram. Nothing ever renders broken.
- All user-visible UI strings live in `src/i18n/translations.ts` — components never hardcode visible text.
- Settings persist in `localStorage` under `cortex.settings`.
- `prefers-reduced-motion` disables the float loop, particles and entrance animations.
