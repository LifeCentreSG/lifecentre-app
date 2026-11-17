// Where the app is published: the built site (scripts/build-site.mjs) opened in a real browser at the root of a domain and under a
// repository path, the way GitHub Pages serves https://app.lifecentre.sg/ and https://lifecentresg.github.io/lifecentre-app/.
// Run with the browser tests: npm run test:browser (the emulators must be running; the app is opened with ?emulator).
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { serve } from '../../scripts/serve.mjs';
import { buildSite } from '../../scripts/build-site.mjs';

const BROWSERS = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean);
const executablePath = BROWSERS.find((p) => existsSync(p));
const REPO = new URL('../../', import.meta.url);
const repoFile = (path) => readFileSync(new URL(path, REPO), 'utf8');

const LAYOUTS = [
  { name: 'the root of a domain (https://app.lifecentre.sg/)', prefix: '' },
  { name: 'a repository path (https://lifecentresg.github.io/lifecentre-app/)', prefix: '/lifecentre-app' },
];

let out, browser;
const servers = [];
before(async () => {
  assert.ok(executablePath, 'No Edge or Chrome found: set BROWSER_PATH');
  out = buildSite(mkdtempSync(join(tmpdir(), 'lc-site-')));
  for (const layout of LAYOUTS) {
    const server = await serve(0, { root: out, prefix: layout.prefix });
    servers.push(server);
    layout.site = `http://localhost:${server.address().port}${layout.prefix}/`;
  }
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-first-run'] });
});
after(async () => {
  await browser?.close();
  servers.forEach((s) => s.close());
  if (out) rmSync(out, { recursive: true, force: true });
});

const homeTitle = (page) => page.waitForSelector('#page-title').then(() => page.$eval('#page-title', (e) => e.textContent));

describe('the built site', () => {
  it('has the app at the root, a /app/ page that goes to the root, and none of the tests', () => {
    assert.ok(existsSync(join(out, 'index.html')) && existsSync(join(out, 'sw.js')) && existsSync(join(out, 'manifest.webmanifest')));
    assert.ok(existsSync(join(out, '.nojekyll')));
    assert.ok(!existsSync(join(out, 'tests')), 'tests are not published');
    assert.ok(!readdirSync(out).some((f) => /\.dc\.html$/.test(f)), 'the design prototype pages are not part of the app');
    assert.match(readFileSync(join(out, 'app/index.html'), 'utf8'), /location\.replace\('\.\.\/' \+ location\.search \+ location\.hash\)/);
  });
  it('carries the CNAME file only when the repository has one, and then it names app.lifecentre.sg', () => {
    const inRepo = existsSync(new URL('CNAME', REPO));
    assert.equal(existsSync(join(out, 'CNAME')), inRepo);
    if (inRepo) assert.equal(readFileSync(join(out, 'CNAME'), 'utf8').trim(), 'app.lifecentre.sg');
  });
  it('names no address under the old repository path, and no root-relative link that would break under a path', () => {
    for (const file of ['index.html', 'sw.js', 'manifest.webmanifest', ...readdirSync(join(out, 'js'), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`), 'css/app.css', 'css/screens.css']) {
      const text = readFileSync(join(out, file), 'utf8');
      assert.doesNotMatch(text, /lifecentre-app-prototype\/app|icathia\.com\/lifecentre/, `${file} names the old address`);
      if (file.endsWith('.html') || file.endsWith('.webmanifest')) assert.doesNotMatch(text, /(?:href|src|start_url|scope)="\/[^/]/, `${file} has a root-relative path`);
    }
  });
  it('invites people to https://app.lifecentre.sg/ whatever address the app is opened at', () => {
    assert.match(readFileSync(join(out, 'js/profile.js'), 'utf8'), /APP_URL = 'https:\/\/app\.lifecentre\.sg\/'/);
    assert.match(readFileSync(join(out, 'index.html'), 'utf8'), /<meta property="og:url" content="https:\/\/app\.lifecentre\.sg\/">/);
  });
});

for (const layout of LAYOUTS) {
  describe(`served at ${layout.name}`, () => {
    const open = async (path = '', { sw = false, hash = '' } = {}) => {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      const bad = [];
      page.on('pageerror', (e) => bad.push(`error: ${e.message}`));
      page.on('response', (r) => { if (r.url().startsWith(layout.site.slice(0, layout.site.indexOf('/', 8))) && r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
      page.on('request', (r) => { if (/lifecentre-app-prototype/.test(r.url())) bad.push(`old path: ${r.url()}`); });
      await page.evaluateOnNewDocument(() => { Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true }); }); // the list of ways to share, not the phone's own sheet
      await page.setViewport({ width: 390, height: 844 });
      await page.goto(`${layout.site}${path}?emulator${sw ? '&sw' : ''}${hash}`);
      return { page, context, bad };
    };

    it('opens Home at the address itself, with every file found', async () => {
      const { page, context, bad } = await open();
      assert.match(await homeTitle(page), /^Good (morning|afternoon|evening)/);
      await page.$eval('a.tab[data-route=events]', (a) => a.click());
      await page.waitForFunction(() => document.querySelector('#page-title')?.textContent === 'Events');
      assert.deepEqual(bad, []);
      await context.close();
    });

    it('has a manifest whose start_url, scope and id are this address, and icons that load', async () => {
      const { page, context } = await open();
      const result = await page.evaluate(async () => {
        const url = document.querySelector('link[rel=manifest]').href;
        const m = await (await fetch(url)).json();
        const resolve = (p) => new URL(p, url).href;
        const icons = await Promise.all(m.icons.map(async (i) => (await fetch(resolve(i.src))).status));
        return { start: resolve(m.start_url), scope: resolve(m.scope), id: resolve(m.id), icons, touch: (await fetch(document.querySelector('link[rel=apple-touch-icon]').href)).status, favicon: (await fetch(document.querySelector('link[rel=icon]').href)).status };
      });
      assert.equal(result.start, layout.site);
      assert.equal(result.scope, layout.site);
      assert.equal(result.id, layout.site);
      assert.deepEqual([...result.icons, result.touch, result.favicon], [200, 200, 200, 200, 200]);
      await context.close();
    });

    it('registers the service worker for this address and saves every file in its list', async () => {
      const { page, context, bad } = await open('', { sw: true });
      await page.waitForSelector('#page-title');
      const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
      assert.equal(scope, layout.site);
      const shell = new Function(`return ${repoFile('app/sw.js').match(/const SHELL = (\[[\s\S]*?\]);/)[1]}`)();
      const saved = await page.evaluate(async () => {
        const out = [];
        for (const name of await caches.keys()) for (const r of await (await caches.open(name)).keys()) out.push(r.url);
        return out;
      });
      for (const file of shell) assert.ok(saved.includes(new URL(file, layout.site).href), `${file} is saved`);
      assert.ok(saved.every((u) => !/lifecentre-app-prototype/.test(u)));
      assert.deepEqual(bad, []);
      await context.close();
    });

    it('sends /app/ to the root, keeping the ?query and the #route', async () => {
      const { page, context } = await open('app/', { hash: '#/events' });
      await page.waitForFunction(() => document.querySelector('#page-title')?.textContent === 'Events', { timeout: 15000 });
      assert.equal(page.url(), `${layout.site}?emulator#/events`);
      await page.goto(`${layout.site}app/?emulator`);
      assert.match(await homeTitle(page), /^Good (morning|afternoon|evening)/);
      assert.equal(page.url(), `${layout.site}?emulator`);
      await context.close();
    });

    it('shows the invitation link as https://app.lifecentre.sg/ in the share sheet', async () => {
      const { page, context } = await open('', { hash: '#/profile' });
      await page.waitForSelector('.pf-share');
      await page.$eval('.pf-share', (b) => b.click());
      await page.waitForSelector('.share-sheet .sh-msg');
      assert.equal(await page.$eval('.share-sheet .sh-msg', (e) => e.textContent.trim().split(' ').pop()), 'https://app.lifecentre.sg/');
      await context.close();
    });
  });
}
