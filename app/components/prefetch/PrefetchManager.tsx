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
  "/dashboard/published",
  "/dashboard/compose",
];

export function PrefetchManager() {
  const fetcher = useFetcher();
  const location = useLocation();
  const user = useOptionalUser();
  const prefetchedRoutesRef = useRef<Set<string>>(new Set());
  const hasErrorRef = useRef(false);
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    // Only prefetch if user is authenticated
    if (typeof window === "undefined" || !user) {
      return;
    }

    // Don't prefetch if we've encountered errors
    if (hasErrorRef.current) {
      return;
    }

    // Don't prefetch if we're on the login page (root or /login)
    if (location.pathname === "/" || location.pathname.startsWith("/login")) {
      return;
    }

    const prefetchRoutes = () => {
      const currentFetcher = fetcherRef.current;
      PREFETCH_ROUTES.forEach((route) => {
        if (!prefetchedRoutesRef.current.has(route)) {
          prefetchedRoutesRef.current.add(route);
          currentFetcher.load(route);
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
    // Intentionally omit fetcher so we don't reschedule on every fetcher state change
  }, [user, location.pathname]);

  // Reset error state and prefetched routes when user changes
  useEffect(() => {
    if (!user) {
      prefetchedRoutesRef.current.clear();
      hasErrorRef.current = false;
    }
  }, [user]);

  // Monitor fetcher for errors and stop prefetching if we hit rate limits
  useEffect(() => {
    // Check fetcher state for errors
    if (fetcher.state === "idle") {
      // Check if fetcher encountered an error
      if (fetcher.data && typeof fetcher.data === "object") {
        const data = fetcher.data as { error?: string; status?: number };
        if (data.error || (data.status && data.status >= 400)) {
          // Stop prefetching if we encounter errors (especially 429 rate limit or auth errors)
          if (
            data.status === 429 ||
            data.status === 401 ||
            data.status === 403 ||
            data.status === 500
          ) {
            hasErrorRef.current = true;
          }
        }
      }
    }
  }, [fetcher.data, fetcher.state]);

  return null;
}
