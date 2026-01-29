/**
 * Lifecycle Handler Component
 * Integrates lifecycle management with Remix revalidation
 */

import { useLocation, useRevalidator } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

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
  const revalidatorRef = useRef(revalidator);

  useEffect(() => {
    revalidatorRef.current = revalidator;
  }, [revalidator]);

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
          setTimeout(() => {
            void triggerForegroundSync(queryClient);
            revalidatorRef.current.revalidate();
          }, 0);
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
          setTimeout(() => {
            void triggerForegroundSync(queryClient);
            revalidatorRef.current.revalidate();
          }, 0);
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
        setTimeout(() => {
          void triggerForegroundSync(queryClient);
          revalidatorRef.current.revalidate();
        }, 0);
      },
    });
  }, [queryClient, user, location.pathname]);

  return null; // This component doesn't render anything
}
