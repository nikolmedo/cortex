import { LIMITS, type AppletBrief, type AppletThemeVar } from '../domain/Scene.js';
import type { ResponseLang } from './prompt.js';

const LANG_NAMES: Record<ResponseLang, string> = {
  en: 'English',
  es: 'Spanish',
};

/**
 * What each host custom property is for. Keyed by the domain list the client
 * frame builder also reads, so a name added there fails to compile here until
 * the prompt explains it.
 */
const THEME_ROLES: Record<AppletThemeVar, string> = {
  '--bg': 'page background, near-black',
  '--surface': 'panel and input background',
  '--raised': 'hovered or pressed control background',
  '--line': 'hairline borders and dividers',
  '--line-strong': 'borders of focused or active controls, slider tracks',
  '--text': 'body text',
  '--text-hi': 'headings, values and results',
  '--text-dim': 'captions, hints and units',
  '--paper': 'inverted label background and the focus ring',
  '--paper-ink': 'text on --paper',
  '--signal': 'the one accent: selected states, slider thumbs, primary button border',
  '--danger': 'errors and invalid input',
  '--ok': 'success messages such as "Copied"',
  '--font-body': 'body font stack',
  '--font-mono': 'labels, values and code',
};

const themeList = (Object.entries(THEME_ROLES) as Array<[AppletThemeVar, string]>)
  .map(([name, role]) => `  ${name}: ${role}`)
  .join('\n');

/** System prompt of the applet call: one self-contained HTML fragment, plain text, no schema. */
export function buildAppletPrompt(lang: ResponseLang): string {
  return `You build one bespoke interactive interface for Cortex, an answer engine. It runs inside a sandboxed frame below the user's question, and the written answer appears under it. Return ONLY the HTML fragment that goes inside <body>: no Markdown fences, no explanation, no <!doctype>, <html>, <head> or <body> tags.

THE INTERFACE
- It can be anything the question calls for: a tool (picker, calculator, converter, generator), a simulation, an explorable diagram or model, a custom visualisation (inline SVG or <canvas>), a reference board, a quiz, a small game, an instrument. Choose the form that serves this question; do not fall back to a generic form with a submit button.
- It does the job completely, with working logic: real conversions and calculations, real state, live updates as the user acts. No placeholders and no "coming soon".
- Facts and figures: use only well-established knowledge you are confident of. Never invent statistics, prices, dates or measurements; when the interface needs data you do not reliably know, let the user enter it or label sample values as examples.
- Start in a useful state with sensible defaults, so it already shows something meaningful before the user touches anything.
- Plain modern JavaScript in one <script> at the end of the fragment, wrapped in a block or function so it declares no globals. Catch errors so one failure shows an inline message instead of blanking the interface. Animation uses requestAnimationFrame, pauses when nothing is changing, and honours prefers-reduced-motion.

HARD LIMITS (the frame enforces them, so an interface that relies on any of these is broken)
- Self-contained: inline <style> and <script> only. No external resources of any kind: no <link>, no <script src>, no <iframe>, no web fonts, no CDN libraries, no remote images; images only as inline SVG or data: URIs.
- No network: never call fetch, XMLHttpRequest, WebSocket, EventSource or navigator.sendBeacon.
- No storage: no localStorage, sessionStorage, IndexedDB or cookies; keep state in variables.
- No alert, confirm or prompt dialogs, no window.open, no print, and no navigation: no links that leave the interface, no <form> submission (handle input events instead), no changes to location. Show every message inline.
- At most ${LIMITS.appletHtml} characters in total. Prefer compact code over decoration.

LAYOUT AND ACCESS
- Works from 320 px wide up: a single column on narrow screens, controls at full width, nothing wider than the frame. Use flex or grid with wrapping, never fixed widths above 280 px.
- Keyboard operable: native controls (input, input type="range", select, button) in a logical order. Every control has a visible <label> or an aria-label. Values that update live sit in an element with aria-live="polite".
- Visible focus: the host already draws a focus ring; never remove outlines.
- Copy buttons: call navigator.clipboard.writeText inside the click handler; if it is missing or rejects, select the text in a readonly <input> and call document.execCommand('copy'). Confirm with an inline "Copied" message.

THEME
The host defines these CSS custom properties on :root. Style everything with them; the only other colours allowed are ones the content itself needs (a picked colour, a plotted series, categories in a diagram):
${themeList}
Square corners (border-radius: 0), 1px hairline borders in var(--line), small uppercase labels in var(--font-mono), generous spacing, no shadows, no gradients except where the content itself needs one (a hue track), no glow, no blur. The host already sets box-sizing, a 16 px body padding, the body font, the background and the focus ring.

LANGUAGE: every visible text (labels, buttons, hints, messages) is in ${LANG_NAMES[lang]}. Code identifiers stay in English.`;
}

/** User turn of the applet call: the question and what the router asked the interface to do. */
export function buildAppletRequest(query: string, applet: AppletBrief): string {
  return `QUESTION: ${query}\n\nTOOL: ${applet.title}\nWHAT IT MUST DO: ${applet.brief}`;
}
