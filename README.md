# Googify

Chrome extension that replaces `:goog:` and `:evilgoog:` shortcodes with their images, anywhere on the web.

## Shortcodes

| Shortcode | Image |
|-----------|-------|
| `:goog:` | goog |
| `:evilgoog:` | evil goog |

Custom aliases for either can be added in the options page.

## Settings

- **Bare-word mode** — also replaces `goog` and `evilgoog` without colons
- **Maximum :goog:** — replaces every word, image, and SVG on the page with goog

## Install

1. Run `npm run build`
2. Go to `chrome://extensions`
3. Enable Developer mode
4. Load unpacked → select `.output/chrome-mv3`

## Assets

Drop your `goog.png` and `evilgoog.png` into `public/assets/` before building.
