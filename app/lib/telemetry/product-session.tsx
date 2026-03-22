/**
 * SSR-safe: sessionStorage / fetch / document run only inside useEffect after a window check
 * (no `.client` suffix so the hook can be used from server-rendered layouts).
 */
import { useEffect, useRef } from "react";

const STORAGE_KEY = "__sfs_product_session_id";
const HEARTBEAT_MS = 120_000;

function getOrCreateClientSessionId(): string {
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    sessionStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `${Date.now()}-fallback`;
  }
}

function deviceCoarse():
  | "mobile"
  | "desktop"
  | "tablet"
  | "unknown"
  | undefined {
  if (typeof navigator === "undefined") return undefined;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "mobile";
  if (/Android/.test(ua)) return "mobile";
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return "tablet";
  }
  return "desktop";
}

const PRODUCT_SESSION_API = "/api/product-session";

function postJson(path: string, body: unknown): void {
  void (async () => {
    try {
      await fetch(path, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      /* ignore */
    }
  })();
}

/**
 * Lightweight product-session beacons for admin DAU/WAU-style metrics.
 */
export function useProductSessionTelemetry(enabled: boolean): void {
  const idRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const clientSessionId = getOrCreateClientSessionId();
    idRef.current = clientSessionId;

    postJson(PRODUCT_SESSION_API, {
      phase: "start",
      clientSessionId,
      deviceCoarse: deviceCoarse(),
    });

    const hb = window.setInterval(() => {
      postJson(PRODUCT_SESSION_API, {
        phase: "heartbeat",
        clientSessionId,
      });
    }, HEARTBEAT_MS);

    const onHide = () => {
      postJson(PRODUCT_SESSION_API, {
        phase: "end",
        clientSessionId,
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);

    return () => {
      window.clearInterval(hb);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      postJson(PRODUCT_SESSION_API, {
        phase: "end",
        clientSessionId,
      });
    };
  }, [enabled]);
}
