/*
 * Dependency-free service worker for Together.
 *
 * Responsibilities:
 * - Cache the same-origin application shell and built static assets.
 * - Keep Supabase and other cross-origin private data network-only.
 * - Receive visible Web Push notifications.
 * - Focus or open the correct application route when a notification is tapped.
 */
const CACHE_VERSION = 'together-shell-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache Supabase or any other cross-origin request.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseCopy = response.clone();
            void caches
              .open(CACHE_VERSION)
              .then((cache) => cache.put('/index.html', responseCopy));
          }

          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_VERSION);
          return (await cache.match('/index.html')) ?? Response.error();
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((response) => {
        if (!response.ok || response.type !== 'basic') return response;

        const responseCopy = response.clone();
        void caches
          .open(CACHE_VERSION)
          .then((cache) => cache.put(request, responseCopy));

        return response;
      });
    }),
  );
});

/**
 * Safari requires every received push to produce a visible notification.
 * The server payload intentionally contains no surprise-note or hidden-wheel
 * content.
 */
self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: 'Together',
      body: event.data?.text() || 'You have a new update.',
      data: { url: '/' },
    };
  }

  const title = payload.title || 'Together';
  const options = {
    body: payload.body || 'You have a new update.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'together-update',
    renotify: false,
    data: {
      url: payload.data?.url || '/',
      notificationType: payload.data?.notificationType || 'update',
    },
  };

  const tasks = [self.registration.showNotification(title, options)];

  if (self.navigator && typeof self.navigator.setAppBadge === 'function') {
    tasks.push(self.navigator.setAppBadge(1));
  }

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const requestedUrl = event.notification.data?.url || '/';
  const targetUrl = new URL(requestedUrl, self.location.origin);

  // Never allow a notification payload to navigate outside this application.
  if (targetUrl.origin !== self.location.origin) {
    targetUrl.href = self.location.origin;
  }

  event.waitUntil(
    (async () => {
      if (
        self.navigator &&
        typeof self.navigator.clearAppBadge === 'function'
      ) {
        await self.navigator.clearAppBadge();
      }

      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const windowClient of windows) {
        if ('focus' in windowClient) {
          await windowClient.focus();

          if ('navigate' in windowClient) {
            await windowClient.navigate(targetUrl.href);
          }

          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl.href);
      }
    })(),
  );
});

/* =========================================================
   TOGETHER_BADGE_CLEAR_REFINEMENT
========================================================= */

/**
 * Clears the installed PWA badge when supported.
 */
async function clearTogetherApplicationBadge() {
  try {
    if (typeof self.registration.clearAppBadge === 'function') {
      await self.registration.clearAppBadge();
    }
  } catch {
    // Badge support is optional and must not interrupt push handling.
  }
}

/**
 * The open application asks the worker to clear its badge whenever it becomes
 * visible or active.
 */
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CLEAR_APP_BADGE') {
    return;
  }

  event.waitUntil(clearTogetherApplicationBadge());
});

/**
 * Clearing a displayed notification should also clear the Home Screen badge.
 */
self.addEventListener('notificationclose', (event) => {
  event.waitUntil(clearTogetherApplicationBadge());
});

/**
 * The existing notification-click listener still performs routing. This
 * additional listener handles only the independent badge state.
 */
self.addEventListener('notificationclick', (event) => {
  event.waitUntil(clearTogetherApplicationBadge());
});