import puppeteer from 'puppeteer';
import path from 'path';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extPath   = path.resolve(__dirname, '../.output/chrome-mv3');
const outDir    = path.resolve(__dirname, '../store-screenshots');
mkdirSync(outDir, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Launch ────────────────────────────────────────────────────────────────────

const browser = await puppeteer.launch({
  headless: false,
  args: [
    `--load-extension=${extPath}`,
    `--disable-extensions-except=${extPath}`,
    '--window-size=1280,900',
    '--no-first-run',
    '--no-default-browser-check',
  ],
  defaultViewport: null,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getExtId() {
  const p = await browser.newPage();
  await p.goto('chrome://extensions', { waitUntil: 'load' });
  await sleep(600);
  const id = await p.evaluate(() => {
    const mgr  = document.querySelector('extensions-manager');
    const list = mgr?.shadowRoot?.querySelector('extensions-item-list');
    for (const item of list?.shadowRoot?.querySelectorAll('extensions-item') ?? []) {
      if (item.shadowRoot?.querySelector('#name')?.textContent?.includes('Googify'))
        return item.id;
    }
    return null;
  });
  await p.close();
  if (!id) throw new Error('Extension not found — run `npm run build` first');
  return id;
}

async function setStorage(extId, patch) {
  const p = await browser.newPage();
  await p.goto(`chrome-extension://${extId}/popup.html`, { waitUntil: 'load' });
  await p.evaluate(v => new Promise(resolve => {
    chrome.storage.sync.get('settings', ({ settings }) => {
      chrome.storage.sync.set({ settings: { ...settings, ...v } }, resolve);
    });
  }), patch);
  await p.close();
}

async function caption(page, text, googUrl, evilUrl) {
  // contentEditable="true" makes isContentEditable true for all children →
  // isSafeTarget() skips every text node inside, so max-goog can't touch them.
  // :goog:/:evilgoog: are swapped for <img data-googify="1"> which replaceImages() skips.
  await page.evaluate((t, gUrl, eUrl) => {
    document.querySelectorAll('#__goog_caption').forEach(el => el.remove());

    const mkImg = src =>
      `<img src="${src}" data-googify="1" style="height:1.1em;width:auto;vertical-align:-0.2em;display:inline;margin:0 3px;">`;

    const html = t
      .replace(/:evilgoog:/g, mkImg(eUrl))
      .replace(/:goog:/g,     mkImg(gUrl));

    const bar = document.createElement('div');
    bar.id = '__goog_caption';
    bar.contentEditable = 'true';
    bar.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0',
      'padding:13px 28px',
      'background:rgba(10,12,16,0.85)',
      'backdrop-filter:blur(14px)',
      '-webkit-backdrop-filter:blur(14px)',
      'color:#e6edf3',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'font-size:13px',
      'letter-spacing:0.015em',
      'z-index:2147483647',
      'border-top:1px solid rgba(255,255,255,0.08)',
      'outline:none',
      'caret-color:transparent',
      'pointer-events:none',
    ].join(';');

    bar.innerHTML = html;
    document.body.appendChild(bar);
  }, text, googUrl, evilUrl);
}

async function shot(page, name) {
  await page.screenshot({
    path: path.join(outDir, `${name}.png`),
    clip: { x: 0, y: 0, width: 1280, height: 800 },
  });
  console.log(`  ✓  ${name}.png`);
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('Finding extension…');
const extId   = await getExtId();
const googUrl = `chrome-extension://${extId}/assets/goog.png`;
const evilUrl = `chrome-extension://${extId}/assets/evilgoog.png`;
console.log(`Extension ID: ${extId}\n`);

await setStorage(extId, { enabled: true, maximumGoog: false, bareWordMode: false });

// 1. GitHub issue — inject :goog: shortcodes into the comment thread ───────────
console.log('1/4  github');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto('https://github.com/nicehash/NiceHashQuickMiner/issues/1', { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await sleep(800);

  // Inject a fake comment with shortcodes into the timeline
  await p.evaluate(() => {
    const anchor = document.querySelector('.js-discussion, .js-timeline-item, .comment-body, .markdown-body');
    if (!anchor) return;
    const box = document.createElement('div');
    box.style.cssText = [
      'margin:16px', 'padding:14px 18px',
      'background:#161b22', 'border:1px solid #30363d',
      'border-radius:8px', 'color:#e6edf3',
      'font-family:-apple-system,sans-serif', 'font-size:14px',
      'line-height:1.7',
    ].join(';');
    box.innerHTML = `
      <span style="font-weight:600;color:#58a6ff">nova</span>
      <span style="color:#7d8590;font-size:12px;margin-left:8px">just now</span><br>
      shipped the fix :goog: everything's green. the :evilgoog: from last week is finally gone :goog:
    `;
    anchor.prepend(box);
  });

  await sleep(1200); // let extension replace the shortcodes
  await caption(p, 'Googify replacing :goog: and :evilgoog: shortcodes live on GitHub', googUrl, evilUrl);
  await shot(p, '1-github');
  await p.close();
}

// 2. google.com — maximum goog ─────────────────────────────────────────────────
console.log('2/4  google + max goog');
{
  await setStorage(extId, { maximumGoog: true });
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await sleep(2000);
  await caption(p, 'Maximum :goog: — every word, image, SVG and button on the page', googUrl, evilUrl);
  await shot(p, '2-google-max-goog');
  await p.close();
  await setStorage(extId, { maximumGoog: false });
}

// 3. Hacker News — maximum goog ───────────────────────────────────────────────
console.log('3/4  hn + max goog');
{
  await setStorage(extId, { maximumGoog: true });
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto('https://news.ycombinator.com', { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await sleep(2000);
  await caption(p, 'Maximum :goog: in action on Hacker News', googUrl, evilUrl);
  await shot(p, '3-hn-max-goog');
  await p.close();
  await setStorage(extId, { maximumGoog: false });
}

// 4. Options page ─────────────────────────────────────────────────────────────
console.log('4/4  options');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto(`chrome-extension://${extId}/options.html`, { waitUntil: 'load' });
  await sleep(500);
  await caption(p, 'Options — add custom aliases for :goog: and :evilgoog:', googUrl, evilUrl);
  await shot(p, '4-options');
  await p.close();
}

await browser.close();
console.log(`\nDone → ${outDir}`);
