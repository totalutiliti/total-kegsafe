/**
 * KegSafe Service Worker — cache de assets + API offline.
 * Estratégias:
 *   - Static assets (JS/CSS/fonts/images): Cache-First
 *   - API barrels/clients: StaleWhileRevalidate (1h)
 *   - Navigation: Network-First com fallback offline
 */

const CACHE_VERSION = 'kegsafe-v1';
const API_CACHE = 'kegsafe-api-v1';
const STATIC_CACHE = 'kegsafe-static-v1';

// Assets estáticos para pre-cache
const PRECACHE_URLS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Instalar — pre-cache dos assets essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Ativar — limpar caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== API_CACHE && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — decidir estratégia por tipo de request
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests não-GET
  if (request.method !== 'GET') return;

  // API barrels/clients → StaleWhileRevalidate
  if (url.pathname.match(/\/api\/v1\/(barrels|clients)(\?.*)?$/)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE, 60 * 60));
    return;
  }

  // Assets estáticos (_next/static, icons, fonts) → Cache-First
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(js|css|png|jpg|svg|woff2?)$/)
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation (páginas HTML) → Network-First
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
});

/**
 * Cache-First: serve do cache, só busca na rede se não tiver.
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

/**
 * StaleWhileRevalidate: serve cache imediatamente, atualiza em background.
 * Expira entradas mais velhas que maxAgeSeconds.
 */
async function staleWhileRevalidate(request, cacheName, maxAgeSeconds) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Atualizar em background
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        // Guardar com timestamp
        const headers = new Headers(response.headers);
        headers.set('sw-cached-at', Date.now().toString());
        const copy = new Response(response.clone().body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
        cache.put(request, copy);
      }
      return response;
    })
    .catch(() => cached || new Response(JSON.stringify({ items: [], total: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

  // Se tem cache, verificar se não expirou
  if (cached) {
    const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0', 10);
    const age = (Date.now() - cachedAt) / 1000;
    if (age < maxAgeSeconds) {
      return cached;
    }
  }

  return fetchPromise;
}

/**
 * Network-First: tenta a rede, fallback para cache.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Cache pages para offline
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(
      '<!DOCTYPE html><html><body style="background:#0a0a0a;color:#fff;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><div style="text-align:center"><h1>Sem conexão</h1><p>Verifique sua internet e tente novamente.</p></div></body></html>',
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }
}
