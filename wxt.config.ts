import { defineConfig } from 'wxt';

export default defineConfig({
  extensionApi: 'chrome',
  manifest: {
    name: 'Googify',
    description: 'Type :goog: or :evilgoog: anywhere to drop a goog.',
    permissions: ['storage'],
    action: {
      default_title: 'Googify',
    },
    icons: {
      '16': '/icons/icon16.png',
      '48': '/icons/icon48.png',
      '128': '/icons/icon128.png',
    },
    web_accessible_resources: [
      {
        resources: ['assets/goog.png', 'assets/evilgoog.png'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
