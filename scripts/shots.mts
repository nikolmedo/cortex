// Screenshot pass against the dev fixtures (no model calls).
// Starts the API with CORTEX_FIXTURES=1 and the Vite client, then captures the
// landing screen, the thinking state, a mid-stream state (partials arriving,
// final scene not in yet) and the final state of every fixture at 390x844,
// 768x1024 and 1440x900. Each capture also asserts there is no horizontal page
// scroll and lists elements whose content overflows their box.
//
// Whole-page captures grow the viewport to the document height instead of using
// `fullPage`: the ambient canvas and the page background are fixed layers, and
// a fullPage shot of a taller document paints them only down to the original
// viewport height, which looks like a hard edge that does not exist when
// scrolling for real.
//
// Run: npx tsx scripts/shots.mts [--sizes=390,768,1440] [--only=kyoto,postgres]
//      [--fixtures-dir=server/fixtures] [--out=docs/screenshots] [--no-servers]
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium, type Browser, type Page } from 'playwright';

const args = new Map(
  process.argv.slice(2).map(a => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v] as const;
  }),
);

const ROOT = process.cwd();
const API_PORT = 3001;
const WEB_PORT = 5173;
const WEB = `http://localhost:${WEB_PORT}`;
const OUT = path.resolve(ROOT, args.get('out') ?? 'docs/screenshots');
const FIXTURES_DIR = path.resolve(ROOT, args.get('fixtures-dir') ?? 'server/fixtures');
const ONLY = args.get('only')?.split(',').filter(Boolean) ?? [];
const SIZES = [
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
].filter(s => !args.has('sizes') || args.get('sizes')!.split(',').includes(String(s.w)));
const SEARCH_QUERY = 'A train leaves at 3pm at 80 km/h and another at 4pm at 100 km/h from the same station on the same track; when and where does the second catch up? Show the reasoning.';

interface Fixture {
  name: string;
  query: string;
  lang: 'en' | 'es';
}

interface CaptureReport {
  file: string;
  pageOverflowPx: number;
  offenders: Array<{ el: string; text: string; scrollWidth: number; clientWidth: number }>;
}

const reports: CaptureReport[] = [];
const children: ChildProcess[] = [];

function shortName(file: string): string {
  const slug = file.replace(/\.json$/, '');
  const lang = slug.endsWith('.es') ? '-es' : '';
  const words = slug.replace(/\.es$/, '').split('-').slice(0, 4).join('-');
  return `${words}${lang}`;
}

async function loadFixtures(): Promise<Fixture[]> {
  const files = (await readdir(FIXTURES_DIR)).filter(f => f.endsWith('.json')).sort();
  const out: Fixture[] = [];
  for (const file of files) {
    const data = JSON.parse(await readFile(path.join(FIXTURES_DIR, file), 'utf8')) as { query: string; lang: 'en' | 'es' };
    const name = shortName(file);
    if (ONLY.length > 0 && !ONLY.some(o => name.includes(o))) continue;
    out.push({ name, query: data.query, lang: data.lang });
  }
  return out;
}

function start(name: string, argv: string[], env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(process.execPath, argv, { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', d => process.env.SHOTS_VERBOSE && process.stdout.write(`[${name}] ${d}`));
  child.stderr?.on('data', d => process.stderr.write(`[${name}] ${d}`));
  children.push(child);
  return child;
}

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function settle(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.race([
      Promise.all(
        Array.from(document.images).map(img => (img.complete ? null : new Promise(r => {
          img.addEventListener('load', r, { once: true });
          img.addEventListener('error', r, { once: true });
        }))),
      ),
      new Promise(r => setTimeout(r, 8000)),
    ]);
  });
}

async function audit(page: Page, file: string): Promise<void> {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const offenders: Array<{ el: string; text: string; scrollWidth: number; clientWidth: number }> = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      if (el.clientWidth === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible' || cs.display === 'inline' || cs.display === 'contents') continue;
      if (el.closest('svg') || el.closest('.visually-hidden')) continue;
      if (el.scrollWidth > el.clientWidth + 1) {
        const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
        offenders.push({
          el: `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`,
          text: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 70),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        });
      }
    }
    return { pageOverflowPx: Math.max(0, doc.scrollWidth - window.innerWidth), offenders };
  });
  reports.push({ file, ...result });
}

const MAX_CAPTURE_HEIGHT = 7000;

/** Grows the viewport until the document fits, so fixed layers cover the whole capture. */
async function captureDocument(page: Page, w: number, h: number, file: string): Promise<void> {
  // The newest turn is at least one viewport tall so a fresh answer fills the
  // screen; in a whole-page capture that rule would just add empty space.
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('main *'))) {
      const min = getComputedStyle(el).minHeight;
      if (min.endsWith('px') && parseFloat(min) > 100) el.style.minHeight = '0px';
    }
  });
  let height = h;
  for (let round = 0; round < 4; round += 1) {
    const needed = await page.evaluate(() => document.documentElement.scrollHeight);
    const next = Math.min(MAX_CAPTURE_HEIGHT, Math.max(h, needed));
    if (next <= height) break;
    height = next;
    await page.setViewportSize({ width: w, height });
    await page.waitForTimeout(250);
  }
  await page.screenshot({ path: path.join(OUT, file) });
  if (height !== h) await page.setViewportSize({ width: w, height: h });
}

async function submit(page: Page, query: string): Promise<void> {
  const box = page.locator('textarea').first();
  await box.fill(query);
  await box.press('Enter');
}

async function newPage(browser: Browser, w: number, h: number, lang: 'en' | 'es'): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 1024 });
  await context.addInitScript(locale => {
    localStorage.setItem('cortex.settings', JSON.stringify({ locale, motion: 'auto' }));
  }, lang);
  const page = await context.newPage();
  page.on('pageerror', err => console.error(`[page] ${err.message}`));
  await page.goto(WEB, { waitUntil: 'networkidle' });
  return page;
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const fixtures = await loadFixtures();

  if (!args.has('no-servers')) {
    start('api', ['--import', 'tsx', 'server/index.ts'], {
      ...process.env,
      // Fixture replay is refused unless the environment is explicitly development.
      NODE_ENV: 'development',
      CORTEX_FIXTURES: '1',
      CORTEX_FIXTURES_DIR: FIXTURES_DIR,
      PORT: String(API_PORT),
    });
    start('web', ['node_modules/vite/bin/vite.js', '--port', String(WEB_PORT), '--strictPort'], process.env);
    await waitFor(`http://localhost:${API_PORT}/api/health`, 30_000);
    await waitFor(WEB, 30_000);
  }

  const browser = await chromium.launch();
  try {
    for (const { w, h } of SIZES) {
      if (ONLY.length === 0) {
        const landing = await newPage(browser, w, h, 'en');
        await settle(landing, 1200);
        const landingFile = `landing-${w}.png`;
        await audit(landing, landingFile);
        await landing.screenshot({ path: path.join(OUT, landingFile) });

        await submit(landing, SEARCH_QUERY);
        await landing.waitForSelector('[data-status="streaming"]', { timeout: 15_000 });
        await landing.waitForTimeout(900);
        const searchFile = `searching-${w}.png`;
        await audit(landing, searchFile);
        await landing.screenshot({ path: path.join(OUT, searchFile) });

        // Mid-stream: partial scenes are rendering, the final one has not landed.
        await landing.waitForSelector('[data-status="streaming"] article', { timeout: 20_000 });
        await landing.waitForTimeout(1200);
        const streamFile = `streaming-${w}.png`;
        await audit(landing, streamFile);
        await landing.screenshot({ path: path.join(OUT, streamFile) });
        console.log(`captured ${streamFile} (status=${await landing.getAttribute('[data-status]', 'data-status')})`);
        await landing.context().close();
      }

      for (const fx of fixtures) {
        const page = await newPage(browser, w, h, fx.lang);
        await submit(page, fx.query);
        await page.waitForSelector('[data-status="done"]', { timeout: 20_000 });
        await settle(page, 1600);
        const file = `${fx.name}-${w}.png`;
        await audit(page, file);
        // The dock is fixed over the viewport; in a whole-page capture it belongs at the end.
        await page.evaluate(() => {
          const dock = document.querySelector<HTMLElement>('[data-dock]');
          if (dock) Object.assign(dock.style, { position: 'static', transform: 'none', background: 'none' });
        });
        await captureDocument(page, w, h, file);
        await page.context().close();
        console.log(`captured ${file}`);
      }
    }
  } finally {
    await browser.close();
  }

  let failures = 0;
  for (const r of reports) {
    const status = r.pageOverflowPx > 0 ? `FAIL page overflow ${r.pageOverflowPx}px` : 'ok';
    if (r.pageOverflowPx > 0) failures += 1;
    console.log(`${r.file}: ${status}; overflowing elements: ${r.offenders.length}`);
    for (const o of r.offenders.slice(0, 12)) {
      console.log(`    ${o.el} ${o.scrollWidth}>${o.clientWidth} "${o.text}"`);
    }
  }
  if (failures > 0) process.exitCode = 1;
}

function stopChildren(): void {
  for (const child of children) {
    if (child.exitCode === null) child.kill();
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(stopChildren);
