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

// Register service worker as soon as the app loads so it's ready for push
// notifications when the user navigates to Settings (even if they landed on /login first).
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  void (async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const isPublicPage =
        window.location.pathname === "/" ||
        window.location.pathname.startsWith("/login") ||
        window.location.pathname.startsWith("/plans");
      // Only listen for updates on app pages so we don't reload login/marketing
      if (!isPublicPage) {
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                // New service worker available, prompt user to reload
              }
            });
          }
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          window.location.reload();
        });
      }
    } catch (error) {
      console.warn("Service Worker registration failed:", error);
    }
  })();
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>
  );
});
