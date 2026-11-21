/**
 * PharmD Smart Hub — Offline Service Worker (v14)
 * - Pre-caches core shell & any bundled local vendor assets via resilient Promise.allSettled
 * - Navigation: Network-first with cached shell fallback (supports index.html & index.html.html)
 * - Same-origin static assets: Stale-While-Revalidate for seamless offline + fresh updates
 * - Approved CDN libraries (Tesseract.js, jsPDF, html2canvas): Cache-first with runtime caching
 */
const CORE_CACHE = 'pharmd-smart-hub-v14';
const RUNTIME_CACHE = 'pharmd-smart-hub-runtime-v14';
const ALLOWED_CACHES = [CORE_CACHE, RUNTIME_CACHE];

const CORE_ASSETS = [
  './',
  './index.html',
  './index.html.html',
  './manifest.json'
];

const OPTIONAL_LOCAL_VENDORS = [
  './vendor/tesseract.min.js',
  './vendor/jspdf.umd.min.js',
  './vendor/html2canvas.min.js',
  './tesseract.min.js',
  './jspdf.umd.min.js',
  './html2canvas.min.js'
];

const CACHEABLE_CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'unpkg.com'
];

function isCacheableCdnUrl(url) {
  return CACHEABLE_CDN_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith('.' + host));
}

function isHtmlAssetUrl(pathname) {
  return pathname.endsWith('/') || pathname.endsWith('.html') || pathname.endsWith('.htm');
}

async function isValidResponseForUrl(assetUrl, response) {
  if (!response || !response.ok) return false;
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  let pathname = '';
  try {
    pathname = new URL(assetUrl, self.location.href).pathname.toLowerCase();
  } catch (e) {
    pathname = String(assetUrl || '').toLowerCase();
  }
  // Prevent SPA HTML fallbacks from poisoning cached .js or .json entries
  if ((pathname.endsWith('.js') || pathname.endsWith('.json')) && ct.includes('text/html')) {
    return false;
  }
  // Prevent auto-generated directory listings from poisoning cached app-shell HTML
  if (isHtmlAssetUrl(pathname)) {
    if (!ct.includes('text/html')) return false;
    try {
      const text = await response.clone().text();
      if (!text.includes('PharmD Smart Hub')) return false;
    } catch (e) {
      return false;
    }
  }
  return true;
}

async function cacheIfAvailable(cache, assetUrl) {
  try {
    const response = await fetch(new Request(assetUrl, { cache: 'reload' }));
    if (await isValidResponseForUrl(assetUrl, response)) {
      await cache.put(assetUrl, response.clone());
    }
  } catch (err) {
    // Missing optional alias (e.g., index.html vs index.html.html or unbundled vendor) — skip cleanly
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CORE_CACHE).then(async (cache) => {
      await Promise.allSettled(
        CORE_ASSETS.concat(OPTIONAL_LOCAL_VENDORS).map((url) => cacheIfAvailable(cache, url))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => (ALLOWED_CACHES.includes(key) ? null : caches.delete(key)))
      )
    ).then(() => self.clients.claim())
  );
});

function buildOfflineFallbackResponse() {
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PharmD Smart Hub — Offline</title></head>
<body style="font-family:Segoe UI,Tahoma,Arial,sans-serif;text-align:center;padding:40px 20px;color:#2c3e50;">
  <h2 style="color:#1a6fc4;">💊 PharmD Smart Hub</h2>
  <p>أنت حالياً دون اتصال بالإنترنت ولم يتم تخزين هذه الصفحة مؤقتاً بعد.</p>
  <p dir="ltr" style="color:#64748b;">You are currently offline and this page has not been cached yet.</p>
</body>
</html>`;
  return new Response(html, {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!req || req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }

  // Only handle http(s) requests (skip chrome-extension:, blob:, data:, file:)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 1. Document navigations: Network-first with cached app-shell fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(async (networkRes) => {
          if (await isValidResponseForUrl(req.url, networkRes)) {
            const copy = networkRes.clone();
            caches.open(CORE_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return networkRes;
        })
        .catch(async () => {
          const cached =
            (await caches.match(req, { ignoreSearch: true })) ||
            (await caches.match('./index.html')) ||
            (await caches.match('./index.html.html')) ||
            (await caches.match('./'));
          return cached || buildOfflineFallbackResponse();
        })
    );
    return;
  }

  // 2. Same-origin static/local vendor assets: Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CORE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const networkPromise = fetch(req)
          .then(async (networkRes) => {
            if (await isValidResponseForUrl(req.url, networkRes)) {
              cache.put(req, networkRes.clone()).catch(() => {});
            }
            return networkRes;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(networkPromise);
          return cached;
        }
        const net = await networkPromise;
        return net || new Response('', { status: 503, statusText: 'Offline' });
      })
    );
    return;
  }

  // 3. Approved CDN libraries (Tesseract.js, jsPDF, html2canvas, OCR worker/data): Cache-First
  if (isCacheableCdnUrl(url)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const networkRes = await fetch(req);
          if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
            cache.put(req, networkRes.clone()).catch(() => {});
          }
          return networkRes;
        } catch (err) {
          return new Response('', { status: 503, statusText: 'Offline CDN Unavailable' });
        }
      })
    );
  }
});

// Handle skipWaiting and optional background reminder messages safely
self.addEventListener('message', (event) => {
  if (!event.data || !event.data.type) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (event.data.type === 'SCHEDULE_REMINDER' && event.data.payload) {
    const { id, title, body, delay } = event.data.payload;
    const safeDelay = Math.max(0, Math.min(Number(delay) || 0, 2147483647));
    setTimeout(() => {
      if (self.registration && typeof self.registration.showNotification === 'function') {
        self.registration.showNotification(title || 'PharmD Smart Hub', {
          body: body || '',
          vibrate: [200, 100, 200],
          tag: `reminder-${id || Date.now()}`
        }).catch(() => {});
      }
    }, safeDelay);
  }
});
