/**
 * useInstallPrompt  -  hook backing dashboard PWA install UI (sidebar / drawer panel).
 *
 * Captures Chromium's `beforeinstallprompt` event (Android Chrome, desktop
 * Chrome/Edge) so we can render our own install affordance instead of the
 * default mini-infobar. iOS Safari never fires this event (Apple has no
 * programmatic install API)  -  for iOS we detect it separately and render
 * an "Add to Home Screen" instruction card.
 *
 * Dismissal: stored in localStorage with a 30-day TTL. Re-prompting a user
 * who already dismissed is low-value and mildly annoying.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { isStandalonePWA } from "~/lib/is-standalone-pwa";

const DISMISSED_STORAGE_KEY = "smartflowsocial:install-prompt-dismissed-at";
const DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Chrome's prompt event; not in lib.dom yet so we type it locally. */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

function readDismissedAt(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isDismissalCurrent(): boolean {
  const at = readDismissedAt();
  if (at === null) return false;
  return Date.now() - at < DISMISS_TTL_MS;
}

/** iOS Safari (and derivatives) - where we need to show A2HS instructions. */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  if (!isIos) return false;
  // Chrome/Firefox on iOS still use WebKit, but only Safari itself supports A2HS
  // reliably; we include CriOS/FxiOS as a best-effort (A2HS works but UI differs).
  return /WebKit/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export interface UseInstallPromptResult {
  /** True while we have a real install event captured and the user hasn't dismissed. */
  canPrompt: boolean;
  /** True on iOS Safari where no programmatic prompt exists and we render instructions. */
  isIosSafariInstallable: boolean;
  /** Fire the native prompt. Resolves to true if the user accepted install. */
  triggerPrompt: () => Promise<boolean>;
  /** Hide the affordance for 30 days (persisted). */
  dismiss: () => void;
  /** True once mounted on the client AND the user isn't already installed AND not dismissed. */
  shouldRender: boolean;
}

// --- useSyncExternalStore helpers -------------------------------------------
//
// We use useSyncExternalStore for the client-only booleans (mounted, iOS, PWA)
// so that the initial render value matches SSR (false) and the post-mount value
// is stable. Following the codebase pattern (see DashboardLayoutPage).
const subscribeNoop = () => () => {};
const getClientTrue = () => true;
const getServerFalse = () => false;
const getClientIsIos = () => isIosSafari();
const getServerIsIos = () => false;
const getClientIsStandalone = () => isStandalonePWA();
const getServerIsStandalone = () => false;

export function useInstallPrompt(): UseInstallPromptResult {
  // Chromium-only deferred prompt, captured from `beforeinstallprompt`.
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  // Transitions to true on `appinstalled` (user completed the native prompt).
  const [installed, setInstalled] = useState(false);
  // `dismissed` is user-driven (dismiss()) so regular useState is fine.
  const [dismissed, setDismissed] = useState(false);

  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientTrue,
    getServerFalse
  );
  const isIos = useSyncExternalStore(
    subscribeNoop,
    getClientIsIos,
    getServerIsIos
  );
  const isStandalone = useSyncExternalStore(
    subscribeNoop,
    getClientIsStandalone,
    getServerIsStandalone
  );

  useEffect(() => {
    // Read the persisted dismissal flag once on mount; queueMicrotask keeps the
    // setState out of the synchronous effect body (set-state-in-effect rule).
    queueMicrotask(() => setDismissed(isDismissalCurrent()));

    const onBeforeInstall = (e: Event) => {
      // Suppress Chromium's default mini-infobar  -  we render our own.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const triggerPrompt = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (result.outcome === "accepted") {
        setInstalled(true);
        return true;
      }
      return false;
    } catch {
      setDeferredPrompt(null);
      return false;
    }
  }, [deferredPrompt]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage errors (Safari private mode, etc.).
    }
  }, []);

  const canPrompt = Boolean(deferredPrompt);
  const isIosSafariInstallable = isIos && !isStandalone;
  const shouldRender =
    mounted &&
    !isStandalone &&
    !installed &&
    !dismissed &&
    (canPrompt || isIosSafariInstallable);

  return {
    canPrompt,
    isIosSafariInstallable,
    triggerPrompt,
    dismiss,
    shouldRender,
  };
}
