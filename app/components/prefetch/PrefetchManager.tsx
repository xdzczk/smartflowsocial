/**
 * Prefetch Manager
 * Handles route-level prefetching on idle and hover
 */

import { useFetcher, useLocation } from "@remix-run/react";
import { useEffect, useRef } from "react";

import { useOptionalUser } from "~/lib/remix-utils";

const PREFETCH_ROUTES = [
  "/dashboard",
  "/dashboard/scheduled",
  "/dashboard/posted",
  "/dashboard/newpost",
  "/dashboard/newlongformpost",
];

export function PrefetchManager() {
  const fetcher = useFetcher();
  const location = useLocation();
  const user = useOptionalUser();
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const hasErrorRef = useRef(false);

  useEffect(() => {
    // Only prefetch if user is authenticated
    if (typeof window === "undefined" || !user) {
      return;
    }

    // Don't prefetch if we've encountered errors
    if (hasErrorRef.current) {
      return;
    }

    // Don't prefetch if we're on the login page
    if (location.pathname.startsWith("/login")) {
      return;
    }

    const prefetchRoutes = () => {
      // Only prefetch routes we haven't already prefetched
      PREFETCH_ROUTES.forEach((route) => {
        if (!prefetchedRoutesRef.current.has(route)) {
          prefetchedRoutesRef.current.add(route);
          fetcher.load(route);
        }
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
  }, [fetcher, user, location.pathname]);

  // Reset error state and prefetched routes when user changes
  useEffect(() => {
    if (!user) {
      prefetchedRoutesRef.current.clear();
      hasErrorRef.current = false;
    }
  }, [user]);

  // Monitor fetcher for errors and stop prefetching if we hit rate limits
  useEffect(() => {
    if (fetcher.data && typeof fetcher.data === "object") {
      const data = fetcher.data as { error?: string; status?: number };
      if (data.error || (data.status && data.status >= 400)) {
        // Stop prefetching if we encounter errors (especially 429 rate limit)
        if (data.status === 429) {
          hasErrorRef.current = true;
        }
      }
    }
  }, [fetcher.data]);

  return null;
}
