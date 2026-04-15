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

type WebVitalName = "CLS" | "LCP" | "INP" | "FCP" | "TTFB";
const WEB_VITALS_ENDPOINT = "/api/web-vitals";
const NEEDS_IMPROVEMENT = "needs-improvement" as const;

function rateMetric(
  name: WebVitalName,
  value: number
): "good" | "needs-improvement" | "poor" {
  if (name === "CLS") {
    if (value <= 0.1) return "good";
    if (value <= 0.25) return NEEDS_IMPROVEMENT;
    return "poor";
  }
  if (name === "LCP") {
    if (value <= 2500) return "good";
    if (value <= 4000) return NEEDS_IMPROVEMENT;
    return "poor";
  }
  if (name === "INP") {
    if (value <= 200) return "good";
    if (value <= 500) return NEEDS_IMPROVEMENT;
    return "poor";
  }
  if (name === "FCP") {
    if (value <= 1800) return "good";
    if (value <= 3000) return NEEDS_IMPROVEMENT;
    return "poor";
  }
  // TTFB
  if (value <= 800) return "good";
  if (value <= 1800) return NEEDS_IMPROVEMENT;
  return "poor";
}

function sendWebVital(name: WebVitalName, value: number, id?: string) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    name,
    value,
    id,
    path: window.location.pathname,
    rating: rateMetric(name, value),
  });

  try {
    const beaconSent = navigator.sendBeacon(WEB_VITALS_ENDPOINT, payload);
    if (beaconSent) {
      return;
    }
  } catch {
    // Fall back to fetch below.
  }

  void fetch(WEB_VITALS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  });
}

function initWebVitalsRUM() {
  if (
    typeof window === "undefined" ||
    typeof PerformanceObserver === "undefined"
  ) {
    return;
  }

  try {
    // TTFB can be read directly from navigation timing.
    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (navigation) {
      sendWebVital("TTFB", navigation.responseStart);
    }

    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as PerformanceEntry[]) {
        const layoutShift = entry as PerformanceEntry & {
          hadRecentInput?: boolean;
          value?: number;
        };
        if (
          !layoutShift.hadRecentInput &&
          typeof layoutShift.value === "number"
        ) {
          clsValue += layoutShift.value;
        }
      }
    });
    clsObserver.observe({ type: "layout-shift", buffered: true });

    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        sendWebVital("LCP", lastEntry.startTime, lastEntry.name);
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

    const fcpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          sendWebVital("FCP", entry.startTime, entry.name);
          break;
        }
      }
    });
    fcpObserver.observe({ type: "paint", buffered: true });

    let maxInp = 0;
    const inpObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const interaction = entry as PerformanceEventTiming;
        const duration = interaction.duration;
        if (duration > maxInp) {
          maxInp = duration;
        }
      }
    });
    // Typings may lag behind browsers for event timing.
    const inpObserverConfig: PerformanceObserverInit = {
      type: "event",
      buffered: true,
      // @ts-expect-error - durationThreshold is available in modern browsers.
      durationThreshold: 40,
    };
    inpObserver.observe(inpObserverConfig);

    const reportOnUnload = () => {
      sendWebVital("CLS", clsValue);
      if (maxInp > 0) {
        sendWebVital("INP", maxInp);
      }
    };
    window.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") reportOnUnload();
    });
    window.addEventListener("pagehide", reportOnUnload);
  } catch (error) {
    console.warn("Web Vitals RUM initialization failed:", error);
  }
}

initWebVitalsRUM();

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
