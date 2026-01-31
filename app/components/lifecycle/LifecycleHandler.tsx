/**
 * Lifecycle Handler Component
 * Integrates lifecycle management with Remix revalidation
 */

import { useLocation, useRevalidator } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { getAndClearCorrelationContext } from "~/lib/correlation-id.client";
import {
  initLifecycleHandlers,
  getPersistedState,
  persistUIState,
  clearPersistedState,
} from "~/lib/lifecycle-manager.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { setCurrentUserNpub } from "~/lib/remote-signer-sessions.client";
import { triggerForegroundSync } from "~/lib/sync-manager.client";

/** Minimum ms between revalidates when app becomes visible (reduces PFP flicker on mobile PWA). */
const REVALIDATE_DEBOUNCE_MS = 1500;

export function LifecycleHandler() {
  const revalidator = useRevalidator();
  const queryClient = useQueryClient();
  const location = useLocation();
  const user = useOptionalUser();
  const revalidatorRef = useRef(revalidator);
  const lastRevalidateAtRef = useRef(0);

  useEffect(() => {
    revalidatorRef.current = revalidator;
  }, [revalidator]);

  const runRevalidate = useCallback(() => {
    const now = Date.now();
    if (now - lastRevalidateAtRef.current < REVALIDATE_DEBOUNCE_MS) {
      return;
    }
    lastRevalidateAtRef.current = now;
    void triggerForegroundSync(queryClient);
    revalidatorRef.current.revalidate();
  }, [queryClient]);

  useEffect(() => {
    setCurrentUserNpub(user?.npub ?? null);
  }, [user?.npub]);

  useEffect(() => {
    // Clear persisted state if user is not authenticated (e.g., on logout or landing page)
    if (!user && location.pathname !== "/login") {
      clearPersistedState();
    }

    // Check for pending correlation context on mount
    const correlationContext = getAndClearCorrelationContext();
    if (correlationContext) {
      // Defer sync to avoid setState during render
      setTimeout(() => {
        void triggerForegroundSync(queryClient);
        revalidatorRef.current.revalidate();
      }, 0);
    }

    // Initialize lifecycle handlers (use ref so effect doesn't re-run when revalidator identity changes)
    return initLifecycleHandlers({
      onVisibilityChange: (isVisible) => {
        if (isVisible) {
          setTimeout(runRevalidate, 0);
        } else {
          if (user) {
            persistUIState({
              route: window.location.pathname,
              lastSyncTimestamp: Date.now(),
            });
          }
        }
      },
      onPageShow: () => {
        const state = getPersistedState();
        if (state.lastSyncTimestamp) {
          setTimeout(runRevalidate, 0);
        }
      },
      onPageHide: () => {
        if (user) {
          persistUIState({
            route: window.location.pathname,
            lastSyncTimestamp: Date.now(),
          });
        }
      },
      onFocus: () => {
        setTimeout(runRevalidate, 0);
      },
    });
  }, [queryClient, user, location.pathname, runRevalidate]);

  return null; // This component doesn't render anything
}
