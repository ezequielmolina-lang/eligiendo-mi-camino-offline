// Generates square PWA icons from the (landscape) gallito mascot by centering it on a
// cream background. Produces "any" icons (small padding) and a maskable icon (safe-zone padding).
import sharp from 'sharp';
import fs from 'node:fs';

fs.mkdirSync('public/icons', { recursive: true });
const BG = { r: 0xfd, g: 0xfc, b: 0xfb, alpha: 1 }; // cream-50

async function make(size, padRatio, name) {
  const pad = Math.round(size * padRatio);
  const inner = size - pad * 2;
  const bird = await sharp('src/gallito.png')
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: bird, gravity: 'center' }])
    .png()
    .toFile(`public/icons/${name}`);
  console.log('  wrote public/icons/' + name);
}

await make(192, 0.1, 'icon-192.png');
await make(512, 0.1, 'icon-512.png');
await make(512, 0.2, 'icon-maskable-512.png'); // ~20% safe zone for maskable
console.log('Icons generated.');
