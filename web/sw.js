/* RAJGAR Ludo service worker.
   When you change ANY file, bump VERSION so phones pick up the new files. */
const VERSION = 'rajgar-ludo-v2.2.0';
const ASSETS = [
  './',
  './index.html',
  './ludo.html',
  './snakes.html',
  './carrom.html',
  './privacy.html',
  './shared.css',
  './shared.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // Pages: try network (max 3 s) so updates arrive, fall back to cache when offline or slow.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html'));
      const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; });
      if (!cached) return net;
      return Promise.race([
        net.catch(() => cached),
        new Promise(r => setTimeout(() => r(cached), 3000))
      ]);
    })());
    return;
  }

  // Everything else: cache first.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
