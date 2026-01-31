/**
 * Hook that runs periodic NIP-07 extension readiness check when active signer is NIP-07 and user is present.
 * Returns current Nip07Readiness for footer and sign guard.
 */

import { useEffect, useState } from "react";

import {
  type Nip07Readiness,
  checkNip07Readiness,
  getNip07Readiness,
  setExpectedPubkeyHexForGuard,
  subscribeToNip07Readiness,
} from "~/lib/nip07-readiness.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { getActiveSignerConfig } from "~/lib/nostr-signer-manager.client";
import { useOptionalUser } from "~/lib/remix-utils";

const NIP07_CHECK_INTERVAL_MS = 30 * 1000; // 30 seconds so account switch is detected sooner

export function useNip07Readiness(): Nip07Readiness {
  const user = useOptionalUser();
  const config = getActiveSignerConfig();
  const [readiness, setReadiness] = useState<Nip07Readiness>(() =>
    typeof window !== "undefined" ? getNip07Readiness() : "unknown"
  );

  useEffect(() => {
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
    const unsubscribe = subscribeToNip07Readiness(setReadiness);

    const handleFocus = (): void => {
      runCheck();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      setExpectedPubkeyHexForGuard(null);
      clearInterval(intervalId);
      unsubscribe();
      window.removeEventListener("focus", handleFocus);
    };
  }, [config?.type, user?.npub]);

  return readiness;
}
