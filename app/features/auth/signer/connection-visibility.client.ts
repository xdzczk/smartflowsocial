/**
 * Page visibility / focus / online handling for NIP-46 signer.
 *
 * We deliberately do NOT tear down the signer on `visibilitychange` (hidden) or
 * `freeze`. Tearing the signer down loses the BunkerSigner subscription and the
 * underlying SimplePool sockets; the next sign attempt then has to rebuild
 * everything before it can even talk to the bunker. The pool now uses
 * `enableReconnect: true` + `enablePing: true`, so the WebSocket layer recovers
 * by itself when the page is suspended and resumed. Resume callbacks are only
 * used to nudge a background reconnect when the cached signer's transport is
 * actually unhealthy.
 */

export interface VisibilityHandlerOptions {
  /** Called when the page becomes visible/focused/online again. The handler
   * decides whether a background reconnect is actually needed. */
  onResume: () => void;
  getWasHidden: () => boolean;
  setWasHidden: (v: boolean) => void;
  getLastVisibilityReconnectAt: () => number;
  setLastVisibilityReconnectAt: (v: number) => void;
  visibilityReconnectThrottleMs: number;
  debugTrace?: (msg: string) => void;
}

function noop(): void {}

export function initVisibilityHandler(
  options: VisibilityHandlerOptions
): () => void {
  if (typeof document === "undefined") return noop;

  const {
    onResume,
    getWasHidden,
    setWasHidden,
    getLastVisibilityReconnectAt,
    setLastVisibilityReconnectAt,
    visibilityReconnectThrottleMs,
  } = options;

  const handleResume = () => {
    setWasHidden(false);
    const now = Date.now();
    if (now - getLastVisibilityReconnectAt() >= visibilityReconnectThrottleMs) {
      setLastVisibilityReconnectAt(now);
      onResume();
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      setWasHidden(true);
      return;
    }
    if (getWasHidden()) handleResume();
  };

  const handleFocus = () => {
    if (getWasHidden()) handleResume();
  };

  const handlePageShow = () => {
    if (getWasHidden()) handleResume();
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("pageshow", handlePageShow);
  window.addEventListener("online", handleResume);

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleFocus);
    window.removeEventListener("pageshow", handlePageShow);
    window.removeEventListener("online", handleResume);
  };
}
