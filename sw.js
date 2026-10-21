/* Service worker for the web/PWA build (iOS "Add to Home Screen", Android Chrome install).
   Scope = the folder this file is served from (e.g. /cambridge/), so it works under any sub-path.
   Strategy: app shell + data bundle are precached; requests are served from cache and refreshed in the
   background (stale-while-revalidate). API calls (api/…) and health checks always go to the network.
   Bump VERSION when you deploy changes you want every client to pick up on the next launch. */
const VERSION = 'csa-2026-10-10b';
const HDRS = { 'ngrok-skip-browser-warning': '1' }; // the shared ngrok domain would otherwise answer with its warning page
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/i18n.js',
  'js/app.js',
  'js/data-bundle.js',
  'assets/icon.svg',
  'assets/icons/icon-32.png',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/fonts/fonts.css',
  'assets/fonts/be-vietnam-pro-400-latin-ext.woff2',
  'assets/fonts/be-vietnam-pro-400-latin.woff2',
  'assets/fonts/be-vietnam-pro-400-vietnamese.woff2',
  'assets/fonts/be-vietnam-pro-500-latin-ext.woff2',
  'assets/fonts/be-vietnam-pro-500-latin.woff2',
  'assets/fonts/be-vietnam-pro-500-vietnamese.woff2',
  'assets/fonts/be-vietnam-pro-600-latin-ext.woff2',
  'assets/fonts/be-vietnam-pro-600-latin.woff2',
  'assets/fonts/be-vietnam-pro-600-vietnamese.woff2',
  'assets/fonts/be-vietnam-pro-700-latin-ext.woff2',
  'assets/fonts/be-vietnam-pro-700-latin.woff2',
  'assets/fonts/be-vietnam-pro-700-vietnamese.woff2',
  'assets/fonts/be-vietnam-pro-800-latin-ext.woff2',
  'assets/fonts/be-vietnam-pro-800-latin.woff2',
  'assets/fonts/be-vietnam-pro-800-vietnamese.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload', headers: HDRS })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('csa-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const rel = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  if (/^(api\/|health)/.test(rel)) return; // live data: network only
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const net = fetch(req.mode === 'navigate' ? url.href : req.url, { headers: HDRS, credentials: 'same-origin', cache: 'no-cache' }).then(res => { if (res && res.ok && res.type === 'basic') cache.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
  }));
});
