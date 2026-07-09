/* Eligiendo Mi Camino — offline service worker.
   Precaches the app shell (HTML/JS/CSS/fonts/icons) so the app works with zero network.
   Cross-origin requests (the LLM model CDN on first download, and the HQ sync API) are
   left to the network — WebLLM manages its own model cache; we never intercept those. */
const BUILD = '1783618153122';
const CACHE = 'emc-shell-' + BUILD;
const ASSETS = [
  './',
  './index.html',
  './bundle.js?b=' + BUILD,
  './styles.css?b=' + BUILD,
  './manifest.webmanifest',
  './gallito.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './fonts/poppins-400.woff2',
  './fonts/poppins-500.woff2',
  './fonts/poppins-600.woff2',
  './fonts/poppins-700.woff2',
  './fonts/poppins-800.woff2',
  './fonts/poppins-900.woff2',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function putInCache(req, resp) {
  if (resp && resp.status === 200 && resp.type === 'basic') {
    const copy = resp.clone();
    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only manage same-origin shell assets. Let the model CDN and sync API hit the network.
  if (url.origin !== self.location.origin) return;

  // NETWORK-FIRST for the app shell (navigations + JS/CSS): a new deploy is picked up
  // immediately when online, and we fall back to cache only when the network fails (offline).
  // Cache-first here was the bug: returning visitors kept running the OLD cached bundle after a
  // deploy (the new code needed two reloads / a manual cache clear to take effect).
  const isShell = req.mode === 'navigate'
    || url.pathname === '/' || url.pathname.endsWith('/index.html')
    || /\.(?:js|css)(?:$|\?)/.test(url.pathname);
  if (isShell) {
    event.respondWith(
      fetch(req)
        .then((resp) => { putInCache(req, resp); return resp; })
        .catch(() => caches.match(req).then((c) => c || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
    );
    return;
  }

  // CACHE-FIRST for static assets (fonts, icons, images, bundled model): fast + offline.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => { putInCache(req, resp); return resp; }).catch(() => undefined);
    })
  );
});
