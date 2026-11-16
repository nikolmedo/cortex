import { describe, expect, it, vi } from 'vitest';
import { APPLET_THEME_VARS, LIMITS, type ScenePreface } from '../domain/Scene.js';
import { extractAppletHtml, generateApplet, type AppletModel } from './applet.js';
import { buildAppletPrompt } from './appletPrompt.js';
import { buildMainPrompt } from './prompt.js';

const BRIEF = { title: 'CSS colour picker', brief: 'HSL and alpha sliders, a hex input, copyable hex, rgb() and hsl() output' };
const HTML = '<style>\n  .tool > label { font: 12px var(--font-mono); }\n</style>\n<div class="tool"><label>Hue <input type="range"></label></div>\n<script>if (1 < 2) {}</script>';

const PREFACE: ScenePreface = {
  intent: 'howto',
  title: 'Colour picker',
  layout: 'sequence',
  mood: 'kinetic',
  palette: { primary: '#7FD8FF', secondary: '#8C9EFF', accent: '#5EF2C2' },
  plan: ['a', 'b', 'c'],
};

function replying(text: string, finishReason = 'stop'): AppletModel {
  return vi.fn(async () => ({ text, finishReason }));
}

const input = { query: 'css color picker', lang: 'en' as const, applet: BRIEF };

describe('extractAppletHtml', () => {
  it('strips a Markdown fence with or without a language tag', () => {
    expect(extractAppletHtml('```html\n<p>a</p>\n```')).toBe('<p>a</p>');
    expect(extractAppletHtml('```\n<p>a</p>\n```\n')).toBe('<p>a</p>');
    expect(extractAppletHtml('```HTML\r\n<p>a</p>\r\n```')).toBe('<p>a</p>');
  });

  it('takes the fenced block out of prose around it', () => {
    expect(extractAppletHtml('Here is the tool:\n\n```html\n<p>a</p>\n```\n\nEnjoy.')).toBe('<p>a</p>');
  });

  it('leaves unfenced markup as it is, trimmed', () => {
    expect(extractAppletHtml('\n  <p>a < b</p>\n')).toBe('<p>a < b</p>');
  });

  it('keeps markup whole when a fence is part of its own content', () => {
    const editor = '<textarea id="md">```js\nlet a = 1;\n```</textarea>\n<div id="preview"></div>';
    expect(extractAppletHtml(editor)).toBe(editor);
  });
});

describe('generateApplet', () => {
  it('returns the model markup, unfenced and untouched otherwise', async () => {
    await expect(generateApplet(input, replying(`\`\`\`html\n${HTML}\n\`\`\``))).resolves.toBe(HTML);
  });

  it('sends the brief, the question and the response language', async () => {
    const model = replying(HTML);
    await generateApplet({ ...input, lang: 'es' }, model);
    const request = vi.mocked(model).mock.calls[0][0];
    expect(request.system).toBe(buildAppletPrompt('es'));
    expect(request.prompt).toContain('css color picker');
    expect(request.prompt).toContain(BRIEF.title);
    expect(request.prompt).toContain(BRIEF.brief);
    expect(request.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns null for a reply cut off by the token limit or blocked', async () => {
    await expect(generateApplet(input, replying(HTML, 'length'))).resolves.toBeNull();
    await expect(generateApplet(input, replying(HTML, 'blocked'))).resolves.toBeNull();
  });

  it('returns null for markup with an unclosed script or style', async () => {
    await expect(generateApplet(input, replying('<div></div><script>let a = 1;'))).resolves.toBeNull();
    await expect(generateApplet(input, replying('<style>p { color: red; }<p>x</p>'))).resolves.toBeNull();
  });

  it('returns null for empty or oversize markup instead of truncating it', async () => {
    await expect(generateApplet(input, replying('   '))).resolves.toBeNull();
    await expect(generateApplet(input, replying('```html\n```'))).resolves.toBeNull();
    await expect(generateApplet(input, replying(`<p>${'x'.repeat(LIMITS.appletHtml)}</p>`))).resolves.toBeNull();
  });

  it('never throws: a failing or aborted model call resolves to null', async () => {
    await expect(generateApplet(input, vi.fn(async () => { throw new Error('503'); }))).resolves.toBeNull();
    const controller = new AbortController();
    const hanging: AppletModel = ({ signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    const pending = generateApplet({ ...input, signal: controller.signal }, hanging);
    controller.abort();
    await expect(pending).resolves.toBeNull();
  });
});

describe('buildAppletPrompt', () => {
  it('names every custom property the host frame defines', () => {
    const prompt = buildAppletPrompt('en');
    for (const name of APPLET_THEME_VARS) expect(prompt).toContain(`${name}:`);
  });

  it('forbids network, storage, dialogs and navigation, and states the size cap', () => {
    const prompt = buildAppletPrompt('en');
    for (const rule of ['fetch', 'localStorage', 'alert', 'navigation', `${LIMITS.appletHtml}`]) expect(prompt).toContain(rule);
  });

  it('writes visible text in the response language', () => {
    expect(buildAppletPrompt('es')).toContain('Spanish');
    expect(buildAppletPrompt('en')).toContain('English');
  });
});

describe('buildMainPrompt with an applet in flight', () => {
  it('tells the scene that a tool is shown above it and the answer should stay short', () => {
    const prompt = buildMainPrompt('css color picker', { ...PREFACE, applet: BRIEF }, null);
    expect(prompt).toContain('INTERACTIVE TOOL');
    expect(prompt).toContain(`"${BRIEF.title}"`);
    expect(prompt).toMatch(/do not draw the tool/i);
  });

  it('is unchanged when the router asked for no tool', () => {
    const prompt = buildMainPrompt('why is the sky blue', PREFACE, 'notes');
    expect(prompt).not.toContain('INTERACTIVE TOOL');
    const parts = prompt.split('\n\n');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('QUESTION: why is the sky blue');
    expect(parts[1]).toMatch(/^ROUTER .*intent=howto, layout=sequence, mood=kinetic$/);
    expect(parts[2]).toMatch(/^RESEARCH NOTES/);
  });
});
