const CACHE_NAME = 'pharmd-hub-v12';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

// تثبيت الـ Service Worker وكاش الملفات الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// تفعيل الـ SW وتنظيف الكاش القديم
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// استراتيجية جلب البيانات (Cache First, Fetch Fallback)
self.addEventListener('fetch', (event) => {
  // عدم عمل كاش لمكتبات الـ CDN في حالة الـ Fetch العادي لتجنب المشاكل، أو كاش لها إذا كانت مستقرة
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // إذا فتحنا ميزة والنت شغال، نكش مكتبات الـ CDN (زي Tesseract و jsPDF) تلقائياً للمستقبل
        if (event.request.url.includes('cdnjs.cloudflare.com')) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});

// هيندلة التذكيرات في الخلفية (Background Notifications)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_REMINDER') {
    const { id, title, body, delay } = event.data.payload;
    
    // عمل تايمر شغال في الخلفية تبع السيرفس وركر
    setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAM...', // أيقونتك هنا
        badge: 'data:image/png;base64,iVBORw0KGgoAAAAM...',
        vibrate: [200, 100, 200], // هابتك فيدباك للموبايل!
        tag: `reminder-${id}`,
        renewWithCurrent: true
      });
    }, delay);
  }
});