// WebGen Gambia — Service Worker v2
// Offline caching for Gambian 3G + full offline-first restaurant flow

const CACHE_NAME = 'webgen-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/landing.html',
  '/portal.html',
  '/admin.html',
  '/medewerker.html',
  '/klant.html',
  '/agent.html',
  // Restaurant flow — must work offline
  '/kassa.html',
  '/bestel.html',
  '/reserveer.html',
  '/menu.html',
  '/menu-generator.html',
  // Generators
  '/qr-generator.html',
  '/flyer-generator.html',
  '/visitekaartje-generator.html',
  '/contract-generator.html',
  '/webgen-gambia-v3.html',
  '/sitemap.html',
  // Assets
  '/manifest.json',
  '/favicon.svg',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap',
  // QR library (used by kassa)
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// Install — cache core pages
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(STATIC_ASSETS.map(url =>
        cache.add(url).catch(err => console.log('SW: failed to cache', url, err.message))
      ));
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches + take control of existing tabs
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategies
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const isApi = url.hostname.includes('workers.dev') || url.pathname.startsWith('/api/');

  // Non-GET API → let it fail naturally when offline (client-side queues it)
  if (event.request.method !== 'GET') return;

  // API GETs: network first, no fallback (we want fresh data or clear failure)
  if (isApi) {
    event.respondWith(
      fetch(event.request).catch(() => new Response(JSON.stringify({ offline: true, orders: [], reservations: [] }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // HTML pages: network first, cache fallback (stay fresh when online, still loads offline)
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(()=>{});
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('/index.html')))
    );
    return;
  }

  // Fonts + CDN libs: cache first (they rarely change)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(()=>{});
          return response;
        }).catch(() => cached)
      )
    );
    return;
  }

  // Everything else: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetched = fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone)).catch(()=>{});
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});

// Message from clients — allow force reload of cache (e.g. after deploy)
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => self.clients.claim());
  }
});
