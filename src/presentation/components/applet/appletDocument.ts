import type { AppletThemeVar } from '../../../domain/Scene';
import type { Locale } from '../../../i18n/translations';

/*
 * Builds the whole srcdoc of an applet frame. The frame is sandboxed with
 * `allow-scripts` only (see appletFrame.ts), so the document runs in an opaque
 * origin; this policy then closes everything the sandbox leaves open except
 * inline code and data: media. Nothing here is ever inserted into the app DOM.
 */

/** Injected as a meta tag ahead of the applet markup. No network of any kind. */
export const APPLET_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  'media-src data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

/** `type` of the one message a frame may send its host. */
export const APPLET_SIZE_MESSAGE = 'cortex-applet-size';

/**
 * Host values for the variables the applet prompt names. They mirror
 * src/presentation/styles/tokens.css by hand: the frame cannot read the host's
 * stylesheet, and the policy blocks the web fonts, so the font stacks are
 * system-only.
 */
export const APPLET_THEME: Readonly<Record<AppletThemeVar, string>> = {
  '--bg': '#06080a',
  '--surface': '#0e1215',
  '--raised': '#161b1f',
  '--line': 'rgb(216 228 234 / 0.14)',
  '--line-strong': 'rgb(216 228 234 / 0.34)',
  '--text': '#c2cbd0',
  '--text-hi': '#f3f6f7',
  '--text-dim': '#8a959c',
  '--paper': '#eef2f3',
  '--paper-ink': '#07090b',
  '--signal': '#6fc3ff',
  '--danger': '#ff5f45',
  '--ok': '#8fe3b0',
  '--font-body': "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  '--font-mono': "ui-monospace, 'Cascadia Mono', Consolas, Menlo, monospace",
};

const themeRules = (Object.entries(APPLET_THEME) as Array<[AppletThemeVar, string]>)
  .map(([name, value]) => `${name}:${value};`)
  .join('');

const HOST_STYLE = [
  `:root{color-scheme:dark;${themeRules}}`,
  '*,*::before,*::after{box-sizing:border-box}',
  'html{background:var(--bg)}',
  'body{margin:0;padding:16px;background:var(--bg);color:var(--text);font:15px/1.5 var(--font-body);overflow-wrap:anywhere}',
  'h1,h2,h3,h4{color:var(--text-hi);line-height:1.2}',
  'button,input,select,textarea{font:inherit;color:inherit;border-radius:8px}',
  'button{border-radius:999px;padding:6px 14px;cursor:pointer}',
  'button,input,select,textarea,fieldset{border:1px solid var(--line-strong);background:var(--surface)}',
  'img,svg,canvas,video{max-width:100%}',
  ':focus-visible{outline:2px solid var(--signal);outline-offset:3px}',
].join('');

/*
 * Reports the content height so the host can size the frame without scrolling.
 * It observes <html>, whose height follows its content (nothing here sets it to
 * 100%), so the frame shrinks as well as grows. It sits in <head>, ahead of
 * the applet, so an unclosed <script>, <style> or comment in the applet cannot
 * swallow it.
 */
const HOST_SCRIPT = `(()=>{const root=document.documentElement;let last=0;`
  + `const send=()=>{const height=Math.ceil(root.getBoundingClientRect().height);`
  + `if(height!==last){last=height;parent.postMessage({type:'${APPLET_SIZE_MESSAGE}',height},'*');}};`
  + `new ResizeObserver(send).observe(root);addEventListener('load',send);})();`;

/** The full srcdoc for one applet: policy, viewport, host theme, size reporter, then the markup verbatim. */
export function buildAppletDocument(html: string, lang: Locale): string {
  return '<!doctype html>'
    + `<html lang="${lang}"><head><meta charset="utf-8">`
    // A srcdoc document takes the host page URL as its base, so href="#" would
    // be a navigation to the host and trip the stopped state. This has to come
    // before the policy: its base-uri 'none' rejects every later <base>.
    + '<base href="about:srcdoc">'
    + `<meta http-equiv="Content-Security-Policy" content="${APPLET_CSP}">`
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + `<style>${HOST_STYLE}</style>`
    + `<script>${HOST_SCRIPT}</script>`
    + `</head><body>${html}</body></html>`;
}
