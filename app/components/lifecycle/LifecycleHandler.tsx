/**
 * Lifecycle Handler Component
 * Integrates lifecycle management with Remix revalidation
 */

import { useLocation, useRevalidator } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getAndClearCorrelationContext } from "~/lib/correlation-id.client";
import {
  initLifecycleHandlers,
  getPersistedState,
  persistUIState,
  clearPersistedState,
} from "~/lib/lifecycle-manager.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { triggerForegroundSync } from "~/lib/sync-manager.client";

export function LifecycleHandler() {
  const revalidator = useRevalidator();
  const queryClient = useQueryClient();
  const location = useLocation();
  const user = useOptionalUser();

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
        revalidator.revalidate();
      }, 0);
    }

    // Initialize lifecycle handlers
    return initLifecycleHandlers({
      onVisibilityChange: (isVisible) => {
        if (isVisible) {
          // Page became visible - trigger sync (defer to avoid setState during render)
          setTimeout(() => {
            void triggerForegroundSync(queryClient);
            revalidator.revalidate();
          }, 0);
        } else {
          // Page hidden - persist state only if authenticated
          if (user) {
            persistUIState({
              route: window.location.pathname,
              lastSyncTimestamp: Date.now(),
            });
          }
        }
      },
      onPageShow: () => {
        // Page shown (including back/forward navigation)
        const state = getPersistedState();
        if (state.lastSyncTimestamp) {
          // Trigger sync if we have a last sync timestamp (defer to avoid setState during render)
          setTimeout(() => {
            void triggerForegroundSync(queryClient);
            revalidator.revalidate();
          }, 0);
        }
      },
      onPageHide: () => {
        // Only persist state if user is authenticated
        if (user) {
          persistUIState({
            route: window.location.pathname,
            lastSyncTimestamp: Date.now(),
          });
        }
      },
      onFocus: () => {
        // Window focused - trigger sync (defer to avoid setState during render)
        setTimeout(() => {
          void triggerForegroundSync(queryClient);
          revalidator.revalidate();
        }, 0);
      },
    });
  }, [revalidator, queryClient, user, location.pathname]);

  return null; // This component doesn't render anything
}
