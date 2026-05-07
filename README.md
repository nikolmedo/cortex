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
| Framework | React 18 + Vite |
| Rendering | SVG + absolute-positioned HTML (no canvas, no D3) |
| AI | Google Gemini API (`generativelanguage.googleapis.com`) |
| Search grounding | `google_search` tool (built-in Gemini tool) |
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
VITE_GEMINI_API_KEY=AIza...
VITE_GEMINI_MODEL=gemini-2.0-flash
```

Get an API key at [aistudio.google.com](https://aistudio.google.com).

**3. Run**

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Switching models

Change `VITE_GEMINI_MODEL` in `.env` and restart the dev server. Any Gemini model that supports the `google_search` grounding tool works:

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
├── src/
│   ├── Cortex.jsx     # Entire application — all components, hooks, API logic
│   └── main.jsx       # React root mount
├── index.html         # Google Fonts link, body background
├── vite.config.js
├── package.json
├── .env               # Your API key (gitignored)
└── .env.example       # Template
```

All application logic lives in a single `Cortex.jsx`. No external component libraries are used.

---

## Notes

- The Gemini API key is embedded in the browser bundle at build time — fine for local use and demos, not for public deployment without a backend proxy.
- Images come from Unsplash (category nodes + gallery strip) and from direct URLs returned by the model (center node). If an image fails, it falls back to the subject's initials or a colored gradient.
- `React.StrictMode` is intentionally omitted to prevent the `requestAnimationFrame` animation loop from double-mounting in development.
