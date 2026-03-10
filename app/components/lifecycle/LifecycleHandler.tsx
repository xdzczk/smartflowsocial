/**
 * Lifecycle Handler Component
 * Integrates lifecycle management with Remix revalidation
 */

import { useFetcher, useLocation, useRevalidator } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import {
  initLifecycleHandlers,
  getPersistedState,
  persistUIState,
  clearPersistedState,
} from "~/features/auth/lifecycle-manager.client";
import {
  getActiveSignerConfig,
  setActiveSignerConfig,
  SIGNER_CONFIG_HYDRATED_EVENT,
  getActiveConnection,
  setCurrentUserNpub,
} from "~/features/auth/signer";
import { getAndClearCorrelationContext } from "~/lib/correlation-id.client";
import { getLocaleTimeAndDateFormat } from "~/lib/locale-defaults.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { triggerForegroundSync } from "~/lib/sync-manager.client";

/** Minimum ms between revalidates when app becomes visible (reduces PFP flicker on mobile PWA). */
const REVALIDATE_DEBOUNCE_MS = 1500;

const LOCALE_DEFAULTS_SYNCED_KEY = "smartflow_locale_defaults_synced";

function canRevalidateNow(): boolean {
  if (typeof window === "undefined") return false;
  if (document.visibilityState !== "visible") return false;
  return navigator.onLine;
}

export function LifecycleHandler() {
  const revalidator = useRevalidator();
  const queryClient = useQueryClient();
  const location = useLocation();
  const user = useOptionalUser();
  const localeDefaultsFetcher = useFetcher<{
    success?: boolean;
    skipped?: boolean;
  }>();
  const revalidatorRef = useRef(revalidator);
  const lastRevalidateAtRef = useRef(0);

  useEffect(() => {
    revalidatorRef.current = revalidator;
  }, [revalidator]);

  const runRevalidate = useCallback(() => {
    if (!canRevalidateNow()) {
      return;
    }
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

  // Apply browser/OS locale defaults for time/date format once per session when user is still on app defaults
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;
    if (localeDefaultsFetcher.state !== "idle") return;
    const timeFormat = user.timeFormat ?? "24h";
    const userDateFormat =
      "dateFormat" in user &&
      typeof (user as { dateFormat?: string }).dateFormat === "string"
        ? (user as { dateFormat: string }).dateFormat
        : "ddmmyyyy";
    const dateFormat =
      userDateFormat === "mmddyyyy" || userDateFormat === "yyyymmdd"
        ? userDateFormat
        : "ddmmyyyy";
    const stillOnDefaults = timeFormat === "24h" && dateFormat === "ddmmyyyy";
    if (!stillOnDefaults) return;
    if (window.sessionStorage.getItem(LOCALE_DEFAULTS_SYNCED_KEY)) return;
    const { timeFormat: detectedTime, dateFormat: detectedDate } =
      getLocaleTimeAndDateFormat();
    if (detectedTime === "24h" && detectedDate === "ddmmyyyy") {
      window.sessionStorage.setItem(LOCALE_DEFAULTS_SYNCED_KEY, "1");
      return;
    }
    window.sessionStorage.setItem(LOCALE_DEFAULTS_SYNCED_KEY, "1");
    const formData = new FormData();
    formData.set("_action", "apply_locale_defaults");
    formData.set("timeFormat", detectedTime);
    formData.set("dateFormat", detectedDate);
    localeDefaultsFetcher.submit(formData, {
      method: "post",
      action: "/dashboard/settings",
    });
  }, [user, localeDefaultsFetcher.state, localeDefaultsFetcher]);

  useEffect(() => {
    if (
      localeDefaultsFetcher.state === "idle" &&
      localeDefaultsFetcher.data?.success
    ) {
      revalidatorRef.current.revalidate();
    }
  }, [localeDefaultsFetcher.state, localeDefaultsFetcher.data]);

  // When user is logged in but sessionStorage has no signer config (e.g. new tab),
  // restore from active remote-signer connection first; otherwise default to NIP-07.
  useEffect(() => {
    if (!user?.npub || typeof window === "undefined") return;
    if (getActiveSignerConfig() != null) return;

    const activeConnection = getActiveConnection();
    if (activeConnection?.config.type === "nip46") {
      setActiveSignerConfig(activeConnection.config);
    } else {
      // Keep extension-only users unblocked when no remote signer connection exists.
      setActiveSignerConfig({ type: "nip07" });
    }

    window.dispatchEvent(new CustomEvent(SIGNER_CONFIG_HYDRATED_EVENT));
  }, [user?.npub]);

  // Use stable identity (npub string) so revalidation doesn't re-run this effect and cause a loop.
  // Root loader returns a new user object on every load; we only care when the actual user changes.
  const userNpub = user?.npub ?? null;
  const pathname = location.pathname;

  useEffect(() => {
    // Clear persisted state if user is not authenticated (e.g., on logout or landing page)
    if (!userNpub && pathname !== "/" && !pathname.startsWith("/login")) {
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
          if (userNpub) {
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
        if (userNpub) {
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
  }, [queryClient, userNpub, pathname, runRevalidate]);

  return null; // This component doesn't render anything
}
