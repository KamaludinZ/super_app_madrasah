/* Super Apps MATSANDATAMA - Service Worker
 * Strategy:
 *  - Never intercept API calls or cross-origin requests (always network).
 *  - App shell / navigation: network-first with offline fallback.
 *  - Static assets (js/css/img/font): stale-while-revalidate.
 *  - Push notifications + notification click handling (Phase 2 ready).
 */
const CACHE_VERSION = 'matsa-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function isApiRequest(url) {
  return url.pathname.startsWith('/api');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle same-origin requests; let API + cross-origin go straight to network.
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  // Navigation requests -> network-first, fallback to cached shell / offline page.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Static assets -> stale-while-revalidate.
  if (['style', 'script', 'image', 'font'].includes(req.destination)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

// ---------- Push Notifications (Phase 2) ----------
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'MATSANDATAMA', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'MATSANDATAMA';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    data: data.data || { url: data.url || '/' },
    tag: data.tag || undefined,
    renotify: !!data.tag,
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || [],
    vibrate: [200, 100, 200], // Vibration pattern
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // Notify foreground clients to play sound
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          clientList.forEach(client => {
            client.postMessage({
              type: 'NOTIFICATION_RECEIVED',
              action: data.data?.action,
              payload: data
            });
          });
        });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  let targetUrl = notificationData.url || '/';

  // Handle notification action buttons
  if (event.action) {
    switch (event.action) {
      case 'scan':
        // Open scan page with schedule_id
        if (notificationData.schedule_id) {
          targetUrl = `/jurnal/scan?schedule_id=${notificationData.schedule_id}`;
        } else {
          targetUrl = '/jurnal/scan';
        }
        break;

      case 'journal':
        // Open journal page
        targetUrl = '/jurnal';
        break;

      default:
        // Use default URL from notification
        break;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus existing window and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }

      // No existing window, open new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
