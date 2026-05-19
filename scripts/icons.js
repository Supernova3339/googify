import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';

const src = 'public/assets/goog.webp';

if (!existsSync(src)) {
  console.warn('icons: public/assets/goog.webp not found, skipping icon generation');
  process.exit(0);
}

mkdirSync('public/icons', { recursive: true });

for (const size of [16, 48, 128]) {
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(`public/icons/icon${size}.png`);
}

console.log('icons: generated 16, 48, 128px');
