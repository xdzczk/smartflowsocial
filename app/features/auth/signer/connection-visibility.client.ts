/**
 * Page visibility / freeze handling for NIP-46 signer.
 * Callback-driven; no imports from connection orchestrator.
 */

export interface VisibilityHandlerOptions {
  onResume: () => void;
  onTeardown: () => void;
  getConfig: () => { type?: string } | null;
  getCachedSigner: () => unknown;
  getTeardownInProgress: () => boolean;
  isMobile: () => boolean;
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
    onTeardown,
    getConfig,
    getCachedSigner,
    getTeardownInProgress,
    isMobile,
    getWasHidden,
    setWasHidden,
    getLastVisibilityReconnectAt,
    setLastVisibilityReconnectAt,
    visibilityReconnectThrottleMs,
    debugTrace = noop,
  } = options;

  const handleResume = () => {
    setWasHidden(false);
    if (getTeardownInProgress()) return;
    const now = Date.now();
    if (now - getLastVisibilityReconnectAt() >= visibilityReconnectThrottleMs) {
      setLastVisibilityReconnectAt(now);
      onResume();
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      setWasHidden(true);
      if (isMobile()) {
        const config = getConfig();
        const signer = getCachedSigner();
        if (config?.type === "nip46" && signer) {
          debugTrace(
            "NIP-46 signer torn down due to visibility hidden (mobile)"
          );
          onTeardown();
        }
      }
    } else if (getWasHidden()) {
      handleResume();
    }
  };

  const handleFocus = () => {
    if (getWasHidden()) handleResume();
  };

  const handlePageShow = () => {
    if (getWasHidden()) handleResume();
  };

  const handleFreeze = () => {
    const config = getConfig();
    const signer = getCachedSigner();
    if (config?.type === "nip46" && signer) {
      debugTrace("NIP-46 signer torn down due to page freeze");
      onTeardown();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("pageshow", handlePageShow);
  window.addEventListener("online", handleResume);

  const supportsFreezeResume =
    typeof document !== "undefined" && "onfreeze" in document;
  if (supportsFreezeResume) {
    document.addEventListener("freeze", handleFreeze);
    document.addEventListener("resume", handleResume);
  }

  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleFocus);
    window.removeEventListener("pageshow", handlePageShow);
    window.removeEventListener("online", handleResume);
    if (supportsFreezeResume) {
      document.removeEventListener("freeze", handleFreeze);
      document.removeEventListener("resume", handleResume);
    }
  };
}
