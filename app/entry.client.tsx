/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/docs/en/main/file-conventions/entry.client
 */

import { RemixBrowser } from "@remix-run/react";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

// Initialize Sentry early for client-side error tracking
import { initSentry } from "~/lib/sentry.client";
initSentry();

// Register service worker after React hydration
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        // Handle service worker updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New service worker available, prompt user to reload
                // Optionally show a toast notification here
              }
            });
          }
        });
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }

      // Handle service worker controller changes (page reload after update)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    })();
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
