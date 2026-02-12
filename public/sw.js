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
      image: payload.image || undefined,
      data: payload.data,
      tag:
        payload.data && payload.data.action === "runway_low"
          ? "runway-low"
          : payload.data && payload.data.postId
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

  // Skip service worker registration requests
  if (url.pathname === "/sw.js" || url.pathname.endsWith("/sw.js")) {
    return;
  }

  // API calls - network first, no caching
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => {
        // If API fetch fails, return error response instead of letting it throw
        return new Response("Network error", {
          status: 503,
          statusText: "Service Unavailable",
        });
      })
    );
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
          return fetch(request)
            .then((response) => {
              if (response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => {
              // If fetch fails, return cached version if available
              if (cachedResponse) {
                return cachedResponse;
              }
              // Otherwise return error
              return new Response("Network error", {
                status: 503,
                statusText: "Service Unavailable",
              });
            });
        });
      })
    );
    return;
  }

  // Dashboard (and other) data requests with ?_data= - do not intercept; let the browser
  // fetch directly so Remix fetcher gets a clean response and we avoid ERR_FAILED / SW issues.
  if (url.searchParams.has("_data")) {
    return;
  }

  // HTML and navigation - network first, never cache. Auth-dependent content must
  // always come from the network so we never serve stale user/session (e.g. after
  // logout or sign-in with different account on mobile PWA).
  if (
    request.headers.get("accept")?.includes("text/html") ||
    url.pathname === "/" ||
    !url.pathname.includes(".")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => {
          return caches.open(APP_SHELL_CACHE).then((cache) => {
            return cache.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return new Response("Offline", {
                status: 503,
                statusText: "Service Unavailable",
              });
            });
          });
        })
    );
    return;
  }

  // Default: network first
  event.respondWith(
    fetch(request).catch((error) => {
      // Log error but don't crash the service worker
      console.error("Service Worker fetch error:", error);
      // Return error response
      return new Response("Network error", {
        status: 503,
        statusText: "Service Unavailable",
      });
    })
  );
});
