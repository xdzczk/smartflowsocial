/**
 * Hook that runs periodic NIP-07 extension readiness check when active signer is NIP-07 and user is present.
 * Returns current Nip07Readiness for footer and sign guard.
 * This module has no .client suffix so it is included in the server bundle; the hook returns "unknown" on
 * server and uses dynamic imports for client-only logic to avoid "useNip07Readiness is not a function" on SSR.
 */

import { useEffect, useRef, useState } from "react";

import { useOptionalUser } from "~/lib/remix-utils";

export type Nip07Readiness =
  | "unknown"
  | "ready"
  | "unresponsive"
  | "account_mismatch";

const NIP07_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds so account switch is detected sooner

export function useNip07Readiness(): Nip07Readiness {
  const user = useOptionalUser();
  const [readiness, setReadiness] = useState<Nip07Readiness>("unknown");
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const setup = async (): Promise<void> => {
      const [
        { getActiveSignerConfig },
        {
          getNip07Readiness,
          checkNip07Readiness,
          setExpectedPubkeyHexForGuard,
          subscribeToNip07Readiness,
        },
        nostrAdapterModule,
      ] = await Promise.all([
        import("~/features/auth/signer"),
        import("~/lib/nip07-readiness.client"),
        import("~/lib/nostr-adapter.client"),
      ]);

      if (cancelled) return;

      const { nostrAdapter } = nostrAdapterModule as {
        nostrAdapter: { decodeNpub: (npub: string) => string | null };
      };

      setReadiness(getNip07Readiness());

      const config = getActiveSignerConfig();
      if (config?.type !== "nip07" || !user?.npub) {
        setExpectedPubkeyHexForGuard(null);
        return;
      }

      const expectedHex = nostrAdapter.decodeNpub(user.npub) ?? null;
      setExpectedPubkeyHexForGuard(expectedHex);

      const runCheck = (): void => {
        void checkNip07Readiness(expectedHex);
      };

      runCheck();
      const intervalId = setInterval(runCheck, NIP07_CHECK_INTERVAL_MS);
      const unsubscribe = subscribeToNip07Readiness((r) => {
        if (!cancelled) setReadiness(r);
      });

      const handleFocus = (): void => {
        runCheck();
      };
      window.addEventListener("focus", handleFocus);

      const doCleanup = (): void => {
        setExpectedPubkeyHexForGuard(null);
        clearInterval(intervalId);
        unsubscribe();
        window.removeEventListener("focus", handleFocus);
      };

      cleanupRef.current = doCleanup;
    };

    void setup();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [user?.npub]);

  return readiness;
}
