/**
 * Service Worker for SmartFlow Social PWA
 * Implements app shell caching with stale-while-revalidate strategy
 */

const CACHE_VERSION = "v1";
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const STATIC_ASSETS_CACHE = `static-assets-${CACHE_VERSION}`;

// Assets to cache on install (app shell)
const APP_SHELL_ASSETS = ["/", "/manifest.json"];

// Assets that should use cache-first strategy (long TTL)
const STATIC_ASSETS_PATTERNS = [
  /\/build\/.*\.js$/,
  /\/build\/.*\.css$/,
  /\/.*\.(png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot)$/,
];

// Install event - cache app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS).catch((error) => {
        console.warn(
          "Service Worker: Failed to cache some app shell assets",
          error
        );
        // Don't fail installation if some assets fail to cache
        return Promise.resolve();
      });
    })
  );
  // Activate new service worker immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(
            (name) => name !== APP_SHELL_CACHE && name !== STATIC_ASSETS_CACHE
          )
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all clients immediately
  return self.clients.claim();
});

// Push event - handle push notifications
self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  try {
    const payload = event.data.json();

    const options = {
      body: payload.body,
      icon: payload.icon || "/icon-192.png",
      badge: payload.badge || "/icon-192.png",
      data: payload.data,
      tag:
        payload.data && payload.data.postId
          ? payload.data.postId
          : "publish-notification",
      requireInteraction:
        payload.data && payload.data.action === "publish_failure",
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
  } catch (error) {
    console.error("Error handling push event:", error);
  }
});

// Notification click event - handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data;
  if (data?.url) {
    event.waitUntil(clients.openWindow(data.url));
  } else {
    event.waitUntil(clients.openWindow("/"));
  }
});

// Fetch event - implement caching strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API calls - network first, no caching
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets (JS, CSS, images, fonts) - cache first with long TTL
  const isStaticAsset = STATIC_ASSETS_PATTERNS.some((pattern) =>
    pattern.test(url.pathname)
  );

  if (isStaticAsset) {
    event.respondWith(
      caches.open(STATIC_ASSETS_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // HTML and app shell - stale-while-revalidate
  if (
    request.headers.get("accept")?.includes("text/html") ||
    url.pathname === "/" ||
    !url.pathname.includes(".")
  ) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => {
              // If network fails and we have cache, return cache
              if (cachedResponse) {
                return cachedResponse;
              }
              // Otherwise return offline fallback
              return new Response("Offline", {
                status: 503,
                statusText: "Service Unavailable",
              });
            });

          // Return cached version immediately, update in background
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Default: network first
  event.respondWith(fetch(request));
});
