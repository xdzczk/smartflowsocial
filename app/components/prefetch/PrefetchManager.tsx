/**
 * Prefetch Manager
 * Handles route-level prefetching on idle and hover
 */

import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";

const PREFETCH_ROUTES = [
  "/dashboard",
  "/dashboard/scheduled",
  "/dashboard/posted",
  "/dashboard/newpost",
  "/dashboard/newlongformpost",
];

export function PrefetchManager() {
  const fetcher = useFetcher();

  useEffect(() => {
    // Prefetch routes on idle
    if (typeof window === "undefined") {
      return;
    }

    const prefetchRoutes = () => {
      PREFETCH_ROUTES.forEach((route) => {
        fetcher.load(route);
      });
    };

    // Use requestIdleCallback if available, otherwise use setTimeout
    if (typeof window.requestIdleCallback !== "undefined") {
      const idleCallback = window.requestIdleCallback(prefetchRoutes, {
        timeout: 5000,
      });
      return () => {
        window.cancelIdleCallback(idleCallback);
      };
    } else {
      const timeout = setTimeout(prefetchRoutes, 2000);
      return () => clearTimeout(timeout);
    }
  }, [fetcher]);

  return null;
}
