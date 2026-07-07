// Offline build: bundles the app (React inlined), compiles Tailwind, self-hosts fonts,
// and assembles a fully self-contained PWA in dist/ — no CDNs, no network needed at runtime.
import esbuild from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const DIST = 'dist';
const watch = process.argv.includes('--watch');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(`${DIST}/fonts`, { recursive: true });
fs.mkdirSync(`${DIST}/icons`, { recursive: true });

// 1) JS bundle (React + app, everything inlined)
const ctx = await esbuild.context({
  entryPoints: ['src/app.jsx'],
  bundle: true,
  outfile: `${DIST}/bundle.js`,
  format: 'iife',
  jsx: 'transform',
  loader: { '.js': 'jsx', '.png': 'dataurl', '.woff2': 'file', '.txt': 'text' },
  minify: !watch,
  sourcemap: watch,
  target: ['es2019'],
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
  logLevel: 'info',
});

async function buildCssAndStatic() {
  // 2) Tailwind CSS
  execSync('npx tailwindcss -i ./src/input.css -o ./dist/styles.css' + (watch ? '' : ' --minify'), { stdio: 'inherit' });
  // Append the demo's custom CSS (chat bubbles, mascot shadow, safe-area, etc.)
  if (fs.existsSync('src/custom.css')) fs.appendFileSync(`${DIST}/styles.css`, '\n/* custom */\n' + fs.readFileSync('src/custom.css', 'utf8'));

  // 3) Self-hosted Poppins
  for (const w of [400, 500, 600, 700, 800, 900]) {
    fs.copyFileSync(`node_modules/@fontsource/poppins/files/poppins-latin-${w}-normal.woff2`, `${DIST}/fonts/poppins-${w}.woff2`);
  }

  // 4) Static shell + PWA files
  fs.copyFileSync('index.html', `${DIST}/index.html`);
  fs.copyFileSync('public/manifest.webmanifest', `${DIST}/manifest.webmanifest`);
  fs.copyFileSync('public/service-worker.js', `${DIST}/service-worker.js`);
  if (fs.existsSync('src/gallito.png')) fs.copyFileSync('src/gallito.png', `${DIST}/gallito.png`);
  if (fs.existsSync('public/icons')) for (const f of fs.readdirSync('public/icons')) fs.copyFileSync(`public/icons/${f}`, `${DIST}/icons/${f}`);
  // School config (HQ bakes one per school/section so the device "just works" knowing its classroom)
  if (fs.existsSync('escuela.json')) { fs.copyFileSync('escuela.json', `${DIST}/escuela.json`); console.log('   + escuela.json (school config)'); }
  // Bundled model (pen-drive / offline-from-first-run), if it was downloaded via bundle-model.mjs
  if (fs.existsSync('models')) { fs.cpSync('models', `${DIST}/models`, { recursive: true }); console.log('   + bundled model from models/'); }

  // Stamp a build id so the service worker cache + asset URLs change every build
  // (guarantees clients pick up new code instead of serving a stale cache).
  const BUILD_ID = String(Date.now());
  for (const f of ['index.html', 'service-worker.js']) {
    const p = `${DIST}/${f}`;
    if (fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('__BUILD_ID__', BUILD_ID));
  }
}

if (watch) {
  await ctx.rebuild();
  await buildCssAndStatic();
  await ctx.watch();
  console.log('👀 watching… (dist/ is live)');
} else {
  await ctx.rebuild();
  await buildCssAndStatic();
  await ctx.dispose();
  const sz = (p) => (fs.existsSync(p) ? (fs.statSync(p).size / 1024).toFixed(0) + ' KB' : 'missing');
  console.log('\n✅ Build complete → dist/');
  console.log('   bundle.js :', sz(`${DIST}/bundle.js`));
  console.log('   styles.css:', sz(`${DIST}/styles.css`));
}
