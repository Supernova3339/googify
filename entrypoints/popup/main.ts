import { load, save } from '../../utils/storage';

const enabledCb     = document.getElementById('enabled')     as HTMLInputElement;
const bareWordCb    = document.getElementById('bareWord')    as HTMLInputElement;
const maximumGoogCb = document.getElementById('maximumGoog') as HTMLInputElement;
const googImg       = document.getElementById('googImg')     as HTMLImageElement;
const evilImg       = document.getElementById('evilImg')     as HTMLImageElement;

load().then(settings => {
  enabledCb.checked     = settings.enabled;
  bareWordCb.checked    = settings.bareWordMode;
  maximumGoogCb.checked = settings.maximumGoog;
  document.body.classList.toggle('off', !settings.enabled);

  googImg.src = chrome.runtime.getURL('assets/goog.png');
  evilImg.src = chrome.runtime.getURL('assets/evilgoog.png');
});

enabledCb.addEventListener('change', async () => {
  const s = await load();
  s.enabled = enabledCb.checked;
  await save(s);
  document.body.classList.toggle('off', !s.enabled);
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

document.getElementById('settingsLink')!.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
