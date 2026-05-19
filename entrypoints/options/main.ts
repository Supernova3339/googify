import { load, save } from '../../utils/storage';

const googImg   = document.getElementById('googImg')   as HTMLImageElement;
const evilImg   = document.getElementById('evilImg')   as HTMLImageElement;
const googTags  = document.getElementById('googTags')!;
const evilTags  = document.getElementById('evilTags')!;
const googInput = document.getElementById('googInput') as HTMLInputElement;
const evilInput = document.getElementById('evilInput') as HTMLInputElement;
const googAdd   = document.getElementById('googAdd')!;
const evilAdd   = document.getElementById('evilAdd')!;
const enabledCb     = document.getElementById('enabled')     as HTMLInputElement;
const bareWordCb    = document.getElementById('bareWord')    as HTMLInputElement;
const maximumGoogCb = document.getElementById('maximumGoog') as HTMLInputElement;
const statusEl   = document.getElementById('status')!;

let statusTimer: ReturnType<typeof setTimeout> | null = null;

function renderTags(container: HTMLElement, aliases: string[], key: 'goog' | 'evil') {
  if (!aliases.length) {
    container.innerHTML = '<span class="none">none</span>';
    return;
  }
  container.innerHTML = aliases.map((a, i) =>
    `<span class="tag">:${a}:<button data-key="${key}" data-i="${i}">✕</button></span>`
  ).join('');
}

async function init() {
  const s = await load();

  googImg.src = chrome.runtime.getURL('assets/goog.png');
  evilImg.src = chrome.runtime.getURL('assets/evilgoog.png');
  enabledCb.checked     = s.enabled;
  bareWordCb.checked    = s.bareWordMode;
  maximumGoogCb.checked = s.maximumGoog;
  renderTags(googTags, s.googAliases, 'goog');
  renderTags(evilTags, s.evilgoogAliases, 'evil');
}

// remove alias
document.addEventListener('click', async e => {
  const btn = (e.target as Element).closest('[data-key][data-i]') as HTMLElement | null;
  if (!btn) return;
  const s = await load();
  const i = Number(btn.dataset.i);
  if (btn.dataset.key === 'goog') {
    const [removed] = s.googAliases.splice(i, 1);
    renderTags(googTags, s.googAliases, 'goog');
    toast(`removed :${removed}:`);
  } else {
    const [removed] = s.evilgoogAliases.splice(i, 1);
    renderTags(evilTags, s.evilgoogAliases, 'evil');
    toast(`removed :${removed}:`);
  }
  await save(s);
});

// add alias
async function addAlias(key: 'goog' | 'evil', input: HTMLInputElement) {
  const alias = input.value.trim().toLowerCase().replace(/^:+|:+$/g, '');
  if (!alias || !/^[a-z0-9_-]+$/.test(alias)) return;

  const s = await load();
  const taken = ['goog', 'evilgoog', ...s.googAliases, ...s.evilgoogAliases];
  if (taken.includes(alias)) { toast('already taken'); return; }

  if (key === 'goog') {
    s.googAliases.push(alias);
    renderTags(googTags, s.googAliases, 'goog');
  } else {
    s.evilgoogAliases.push(alias);
    renderTags(evilTags, s.evilgoogAliases, 'evil');
  }
  await save(s);
  input.value = '';
  toast(`added :${alias}:`);
}

googAdd.addEventListener('click', () => addAlias('goog', googInput));
evilAdd.addEventListener('click', () => addAlias('evil', evilInput));
googInput.addEventListener('keydown', e => { if (e.key === 'Enter') addAlias('goog', googInput); });
evilInput.addEventListener('keydown', e => { if (e.key === 'Enter') addAlias('evil', evilInput); });

enabledCb.addEventListener('change', async () => {
  const s = await load();
  s.enabled = enabledCb.checked;
  await save(s);
});

bareWordCb.addEventListener('change', async () => {
  const s = await load();
  s.bareWordMode = bareWordCb.checked;
  await save(s);
});

maximumGoogCb.addEventListener('change', async () => {
  const s = await load();
  s.maximumGoog = maximumGoogCb.checked;
  await save(s);
});

function toast(msg: string) {
  statusEl.textContent = msg;
  statusEl.classList.add('show');
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusEl.classList.remove('show'), 1800);
}

init();
