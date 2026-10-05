// Offline shell for the scoring app. The page itself is network-first (new
// deploys show up whenever online) with the cached copy as fallback; hashed
// build assets, icons and fonts are cache-first. API calls (Supabase, Clerk)
// are never cached: data offline comes from the app's own last-known cache.
const CACHE = 'ml-scoring-shell-v2';
const STATIC = ['/logo.png', '/icon.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// Stores the page plus every /assets/ file it references, so one online visit
// is enough to reopen offline (files fetched before this worker took control
// never passed through it).
async function cachePage(cache, response) {
  await cache.put('/', response.clone());
  const html = await response.text();
  const assets = [...new Set(html.match(/\/assets\/[^"'\s)]+/g) || [])];
  const missing = [];
  for (const url of assets) if (!(await cache.match(url))) missing.push(url);
  await cache.addAll(missing);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(STATIC);
      await cachePage(cache, await fetch('/', { cache: 'no-store' }));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    // Bad venue Wi-Fi: give up quickly and open the cached page.
    const response = await fetch(request, { signal: AbortSignal.timeout(4000) });
    if (response.ok) await cachePage(cache, response.clone()).catch(() => {});
    return response;
  } catch {
    return (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirstPage(request));
  } else if (
    (url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || STATIC.includes(url.pathname))) ||
    FONT_HOSTS.includes(url.hostname)
  ) {
    event.respondWith(cacheFirst(request));
  }
});
