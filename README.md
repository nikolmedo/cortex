# CORTEX

A futuristic AI-powered knowledge graph visualizer. Type any query — a person, place, film, company, concept — and watch the information render as an animated, interactive node graph in real time.

---

## What it does

- Submits your query to a Gemini model with Google Search grounding
- Parses the response into a structured knowledge graph
- Renders it as an animated SVG node graph — subject at center, categories orbiting outward, facts radiating from each category
- Every node floats independently with sinusoidal motion driven by `requestAnimationFrame`
- Traveling glow dots animate along every edge
- Image gallery strip shows contextual Unsplash photos per category

---

## Stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| AI runtime | Genkit + `@genkit-ai/google-genai` |
| AI model | Google Gemini (configurable via `GEMINI_MODEL`) |
| Search grounding | `googleSearch` tool (built-in Gemini grounding) |
| Rendering | SVG + absolute-positioned HTML (no canvas, no D3) |
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

---

## Interactions

| Action | Effect |
|---|---|
| Type query + Enter | Submits search, animates graph in |
| Click category node | Collapse / expand its fact nodes |
| Hover fact node | Highlights node + brightens edge + shows full text tooltip |
| Hover category node | Fact nodes scale up |
| Click query pill (top-right) | Re-runs a previous query |
| Click NEW QUERY | Returns to the input screen |

---

## Project structure

```
cortex/
├── server/                    # Node.js/Express backend
│   ├── index.ts               # Entry point — loads dotenv, starts Express
│   ├── application/
│   │   ├── cortexFlow.ts      # Genkit flow — calls Gemini with grounding
│   │   └── prompt.ts          # System prompt
│   ├── domain/
│   │   └── GraphData.ts       # Graph data types
│   ├── infrastructure/
│   │   ├── geminiClient.ts    # Genkit + googleAI plugin setup
│   │   └── parseGraphData.ts  # JSON extraction + validation
│   └── presentation/
│       └── cortexRouter.ts    # POST /api/cortex route
├── src/                       # React frontend
│   ├── main.tsx               # React root mount
│   ├── Cortex.tsx             # Root component
│   ├── application/           # Frontend use cases
│   ├── domain/                # Shared domain types
│   ├── infrastructure/        # API client
│   ├── layout/                # Graph layout computation
│   └── presentation/          # UI components
├── index.html
├── vite.config.ts
├── package.json
├── .env                       # Your API key (gitignored)
└── .env.example               # Template
```

---

## Notes

- The Gemini API key lives server-side only — it is never exposed to the browser.
- Images come from Unsplash (category nodes + gallery strip) and from direct URLs returned by the model (center node). If an image fails, it falls back to the subject's initials or a colored gradient.
- `React.StrictMode` is intentionally omitted to prevent the `requestAnimationFrame` animation loop from double-mounting in development.
