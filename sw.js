/* Valcorsa service worker.
   - Code/HTML: network-first with cache fallback (fresh deploys win; offline still opens).
   - Music/SFX/fonts/icons: CACHE-FIRST in a persistent cache that survives deploys —
     these files never change, and re-downloading ~15MB of music every session is what
     blew the Netlify bandwidth cap (2026-08-07, site went 503 usage_exceeded). */
const CACHE = 'valcorsa-v19';
const MEDIA = 'valcorsa-media-v2';          // v2: original OST replaced the CC soundtrack (2026-08-07)
const IMMUTABLE = /\/(music|sfx|fonts|icons)\//;   // no ^ anchor: site may live under /valcorsa/ (GitHub Pages)

self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== CACHE && k !== MEDIA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (IMMUTABLE.test(url.pathname)) {       // heavy, never-changing: serve local, fetch once
    e.respondWith(
      caches.open(MEDIA).then(c => c.match(e.request).then(hit => hit ||
        fetch(e.request).then(res => {
          if (res.ok) c.put(e.request, res.clone());
          return res;
        })))
    );
    return;
  }

  e.respondWith(                            // code/HTML: freshest wins
    fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: url.pathname.endsWith('/') })
      .then(hit => hit || caches.match('./')))
  );
});
