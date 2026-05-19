export interface Settings {
  enabled: boolean;
  bareWordMode: boolean;
  maximumGoog: boolean;
  googAliases: string[];
  evilgoogAliases: string[];
}

export const defaults: Settings = {
  enabled: true,
  bareWordMode: false,
  maximumGoog: false,
  googAliases: [],
  evilgoogAliases: [],
};

export async function load(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...defaults, ...settings };
}

export async function save(s: Settings): Promise<void> {
  await chrome.storage.local.set({ settings: s });
}

export function onChange(cb: (s: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
      cb({ ...defaults, ...changes.settings.newValue });
    }
  });
}
