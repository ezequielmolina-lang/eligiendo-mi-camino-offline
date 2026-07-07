// Minimal static server for dist/ (used by the preview + for local offline testing).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('./dist', import.meta.url));
const PORT = process.env.PORT || 5173;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.wasm': 'application/wasm', '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = path.join(DIST, urlPath);
  if (!filePath.startsWith(DIST)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      if (path.extname(urlPath)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); } // missing asset → 404 (not SPA)
      filePath = path.join(DIST, 'index.html'); // SPA fallback for navigations only
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (filePath.endsWith('service-worker.js') || ext === '.html') headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    res.writeHead(200, headers);
    fs.createReadStream(filePath).pipe(res);
  });
});

function listen(port, attemptsLeft) {
  server.removeAllListeners('error');
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && attemptsLeft > 0) listen(port + 1, attemptsLeft - 1);
    else { console.error('No se pudo iniciar el servidor:', e.message); process.exit(1); }
  });
  server.listen(port, () => {
    const url = 'http://localhost:' + port;
    console.log('\n  ✅ Eligiendo Mi Camino (offline)  ->  ' + url + '\n  Deja esta ventana abierta mientras usas la app. (Ctrl+C para cerrar.)\n');
    if (process.argv.includes('--open')) {
      const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      import('node:child_process').then((cp) => cp.exec(cmd)).catch(() => {});
    }
  });
}
listen(Number(PORT), 10);
