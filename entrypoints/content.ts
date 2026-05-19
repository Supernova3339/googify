import { load, onChange, type Settings } from '../utils/storage';

// Never touch text inside these raw elements
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT']);

// isContentEditable is the browser's own check — it walks all ancestors and
// returns true for contenteditable divs, CodeMirror, ProseMirror, everything.
function isSafeTarget(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;
  if (SKIP.has(parent.tagName)) return false;
  if (parent.isContentEditable) return false;
  return true;
}

let settings: Settings;
let urls: { goog: string; evilgoog: string };

export default defineContentScript({
  matches:   ['<all_urls>'],
  allFrames: true,
  runAt:     'document_idle',

  async main() {
    settings = await load();
    urls = {
      goog:     chrome.runtime.getURL('assets/goog.png'),
      evilgoog: chrome.runtime.getURL('assets/evilgoog.png'),
    };

    onChange(s => {
      const wasMaximum = settings?.maximumGoog;
      settings = s;
      cacheKey = '';

      // Replacements are destructive — can't un-goog a page, so reload to restore it
      if (wasMaximum && !s.maximumGoog) {
        window.location.reload();
        return;
      }

      walk(document.body);
      if (s.maximumGoog) {
        replaceImages(document.body);
        replaceAnchors(document.body);
        replaceButtonInputs(document.body);
      }
    });

    // Replace in everything already on the page
    walk(document.body);
    if (settings.maximumGoog) {
      replaceImages(document.body);
      replaceAnchors(document.body);
      replaceButtonInputs(document.body);
    }

    // Watch for newly inserted nodes (dynamic content, SPAs, GitHub Turbo, etc.)
    // We defer processing to rAF so frameworks finish setting up the DOM
    // (e.g. setting contenteditable on a parent) before we check isSafeTarget.
    let rafId: number | null = null;
    const pending: Node[] = [];

    new MutationObserver(muts => {
      if (!settings?.enabled) return;
      for (const mut of muts) {
        for (const node of mut.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE || node instanceof Element) {
            pending.push(node);
          }
        }
      }
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          const batch = pending.splice(0);
          for (const node of batch) {
            if (node.nodeType === Node.TEXT_NODE) replaceIn(node as Text);
            else if (node instanceof Element) {
              walk(node);
              if (settings?.maximumGoog) {
                replaceImages(node);
                replaceAnchors(node);
                replaceButtonInputs(node);
              }
            }
          }
        });
      }
    }).observe(document.body, {
      subtree:   true,
      childList: true,
    });
  },
});

// ── Walk all text nodes under a root element ──────────────────────────────────

function walk(root: Element) {
  if (!settings?.enabled) return;

  const nodes: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (isSafeTarget(node as Text)) nodes.push(node as Text);
  }

  for (const n of nodes) replaceIn(n);
}

// ── Replace all images under a root element (maximum goog only) ───────────────

function replaceImages(root: Element) {
  if (!settings?.maximumGoog) return;

  const targets: Element[] = root.tagName === 'IMG' || root.tagName === 'SVG'
    ? [root]
    : Array.from(root.querySelectorAll('img, svg'));

  for (const el of targets) {
    if ((el as HTMLElement).dataset?.googify) continue;

    if (el.tagName === 'IMG') {
      (el as HTMLImageElement).src = urls.goog;
    } else {
      // Swap the whole SVG element for an <img>
      const img = makeImg(urls.goog, ':goog:');
      // Try to match the SVG's rendered size
      const rect = el.getBoundingClientRect();
      if (rect.width  > 0) img.style.width  = rect.width  + 'px';
      if (rect.height > 0) img.style.height = rect.height + 'px';
      img.style.verticalAlign = 'middle';
      el.parentNode?.replaceChild(img, el);
    }
  }
}

// ── Replace button/submit inputs with a goog background (maximum goog only) ───
// Can't put <img> inside <input>, so we use a background-image instead.
// Criteria: type=submit, type=button, type=reset — visible labeled controls only.

function replaceButtonInputs(root: Element) {
  if (!settings?.maximumGoog) return;
  const sel = 'input[type="submit"], input[type="button"], input[type="reset"]';
  const inputs: HTMLInputElement[] = root.matches(sel)
    ? [root as HTMLInputElement]
    : Array.from(root.querySelectorAll<HTMLInputElement>(sel));
  for (const input of inputs) {
    if (input.dataset.googify) continue;
    input.dataset.googify = '1';
    const url = Math.random() < 0.01 ? urls.evilgoog : urls.goog;
    input.style.cssText += [
      `background-image:url(${url})`,
      'background-size:contain',
      'background-repeat:no-repeat',
      'background-position:center',
      'color:transparent',
      'min-width:2em',
    ].join(';');
  }
}

// ── Replace anchor contents with goog (maximum goog only) ────────────────────
// Clears whatever is inside the <a> and drops a goog image in,
// while leaving href/target/etc intact so links still work.

function replaceAnchors(root: Element) {
  if (!settings?.maximumGoog) return;
  const anchors: HTMLAnchorElement[] = root.tagName === 'A'
    ? [root as HTMLAnchorElement]
    : Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
  for (const a of anchors) {
    if (a.dataset.googify) continue;
    a.dataset.googify = '1';
    a.replaceChildren(makeImg(
      Math.random() < 0.01 ? urls.evilgoog : urls.goog,
      ':goog:',
    ));
  }
}

// ── Replace all matches inside a single text node ─────────────────────────────

function replaceIn(node: Text) {
  if (!settings?.enabled) return;
  if (!isSafeTarget(node)) return;

  const text = node.nodeValue ?? '';
  const pattern = buildPattern();
  if (!pattern) return;

  pattern.lastIndex = 0;

  let match: RegExpExecArray | null;
  let last = 0;
  let matched = false;
  const frag = document.createDocumentFragment();

  while ((match = pattern.exec(text)) !== null) {
    matched = true;

    if (match.index > last) {
      frag.appendChild(document.createTextNode(text.slice(last, match.index)));
    }

    let { url, alt } = resolve(match[0])!;
    if (settings.maximumGoog && Math.random() < 0.01) { url = urls.evilgoog; alt = ':evilgoog:'; }
    frag.appendChild(makeImg(url, alt));

    last = match.index + match[0].length;
  }

  if (!matched) return;
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

  const parent = node.parentNode;
  parent?.replaceChild(frag, node);
  if (settings.maximumGoog && parent instanceof Element) stripTextClasses(parent);
}

// ── Build regex + lookup map from current settings ────────────────────────────

// Cache so we don't rebuild on every text node
let cachedPattern: RegExp | null = null;
let cachedMap: Map<string, { url: string; alt: string }> | null = null;
let cacheKey = '';

function buildPattern(): RegExp | null {
  if (!settings || !urls) return null;

  const key = JSON.stringify([settings.googAliases, settings.evilgoogAliases, settings.bareWordMode, settings.maximumGoog]);
  if (key === cacheKey && cachedPattern) return cachedPattern;

  cacheKey = key;
  cachedMap = new Map();
  const parts: string[] = [];

  const add = (trigger: string, url: string, alt: string) => {
    cachedMap!.set(trigger, { url, alt });
    parts.push(esc(trigger));
  };

  // Colon form always on
  add(':goog:',     urls.goog,     ':goog:');
  add(':evilgoog:', urls.evilgoog, ':evilgoog:');
  for (const a of settings.googAliases)     add(`:${a}:`, urls.goog,     ':goog:');
  for (const a of settings.evilgoogAliases) add(`:${a}:`, urls.evilgoog, ':evilgoog:');

  if (settings.bareWordMode) {
    // Bare-word: match standalone goog/evilgoog (and aliases) not adjacent to word chars.
    // evilgoog must come before goog so the longer token wins.
    const bareAdd = (word: string, url: string, alt: string) => {
      cachedMap!.set(word, { url, alt });
      parts.push(`(?<![\\w:])${esc(word)}(?![\\w:])`);
    };
    bareAdd('evilgoog', urls.evilgoog, ':evilgoog:');
    bareAdd('goog',     urls.goog,     ':goog:');
    for (const a of settings.evilgoogAliases) bareAdd(a, urls.evilgoog, ':evilgoog:');
    for (const a of settings.googAliases)     bareAdd(a, urls.goog,     ':goog:');
  }

  if (settings.maximumGoog) {
    // Every sequence of word characters becomes :goog:
    cachedMap!.set('__maximumGoog__', { url: urls.goog, alt: ':goog:' });
    cachedPattern = new RegExp('\\b\\w+\\b', 'g');
    return cachedPattern;
  }

  if (parts.length === 0) return (cachedPattern = null);
  cachedPattern = new RegExp(parts.join('|'), 'g');
  return cachedPattern;
}

function resolve(matched: string): { url: string; alt: string } | undefined {
  return cachedMap?.get(matched) ?? cachedMap?.get('__maximumGoog__');
}

// ── Strip text-display classes from an element (maximum goog only) ───────────
// After replacing text content with a goog image, the parent element may still
// carry CSS classes that constrain sizing, add pseudo-element text, or apply
// font/color rules that look wrong on an image. We strip those, but leave
// anything that looks structural or sensitive (errors, a11y, layout).

const TEXT_CLASS = /text|label|caption|heading|headline|title|font|type/i;
const SENSITIVE_CLASS = /error|warn|valid|invalid|help|hint|sr[-_]only|visually.hidden|screen.reader|alert|status/i;

function stripTextClasses(el: Element) {
  for (const cls of Array.from(el.classList)) {
    if (SENSITIVE_CLASS.test(cls)) continue;
    if (TEXT_CLASS.test(cls)) el.classList.remove(cls);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeImg(src: string, alt: string): HTMLImageElement {
  const img = document.createElement('img');
  img.src   = src;
  img.alt   = alt;
  img.title = alt;
  img.dataset.googify = '1'; // marks it as ours so replaceImages skips it
  img.style.cssText = 'height:1.25em;width:auto;vertical-align:-0.25em;display:inline;cursor:default;border:none;background:none;max-width:none;';
  return img;
}

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
