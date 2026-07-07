/* Eligiendo Mi Camino — offline service worker.
   Precaches the app shell (HTML/JS/CSS/fonts/icons) so the app works with zero network.
   Cross-origin requests (the LLM model CDN on first download, and the HQ sync API) are
   left to the network — WebLLM manages its own model cache; we never intercept those. */
const BUILD = '1783441404341';
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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only manage same-origin shell assets. Let the model CDN and sync API hit the network.
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
    })
  );
});
