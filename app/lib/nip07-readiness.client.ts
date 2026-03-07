/**
 * NIP-07 extension readiness state: responsive check and pubkey match with logged-in user.
 * No React; use subscribeToNip07Readiness in components. React layer calls checkNip07Readiness on interval.
 */

export type Nip07Readiness =
  | "unknown"
  | "ready"
  | "unresponsive"
  | "account_mismatch";

/** Give extension time to respond; avoid false "unresponsive" from slow extensions. */
const NIP07_CHECK_TIMEOUT_MS = 10_000;
/** Throttle getPublicKey() to at most once per minute to avoid spamming the NIP-07 extension prompt. */
const NIP07_GET_PUBLIC_KEY_THROTTLE_MS = 60 * 1000;
/** Require this many consecutive failures before showing "Extension unresponsive" (avoids flicker on transient timeouts). */
const NIP07_UNRESPONSIVE_CONSECUTIVE_THRESHOLD = 2;
const REASON_UNRESPONSIVE = "unresponsive";
const SIGNER_TYPE_NIP07 = "nip07";
const EVENT_NOSTR_CONNECTION_STALE = "nostr-connection-stale";

let currentReadiness: Nip07Readiness = "unknown";
/** Last time we called window.nostr.getPublicKey() for readiness check (0 = never). */
let lastGetPublicKeyCheckTime = 0;
/** Consecutive getPublicKey check failures (timeout/error). Reset on success. */
let consecutiveReadinessFailures = 0;
const listeners = new Set<(state: Nip07Readiness) => void>();

/** Set by the hook when user is available; used by the sign guard to run a fresh check before signing. */
let expectedPubkeyHexForGuard: string | null = null;

export function setExpectedPubkeyHexForGuard(hex: string | null): void {
  expectedPubkeyHexForGuard = hex;
}

export function getExpectedPubkeyHexForGuard(): string | null {
  return expectedPubkeyHexForGuard;
}

function setReadiness(state: Nip07Readiness): void {
  if (currentReadiness !== state) {
    currentReadiness = state;
    for (const cb of listeners) {
      // eslint-disable-next-line promise/prefer-await-to-callbacks -- Synchronous subscription notification; not a promise callback.
      cb(state);
    }
  }
}

export function getNip07Readiness(): Nip07Readiness {
  return currentReadiness;
}

export function subscribeToNip07Readiness(
  // eslint-disable-next-line promise/prefer-await-to-callbacks -- Subscription pattern; callback is invoked when external state changes.
  callback: (state: Nip07Readiness) => void
): () => void {
  listeners.add(callback);
  // eslint-disable-next-line promise/prefer-await-to-callbacks -- Defer initial callback to avoid setState during render.
  setTimeout(() => callback(currentReadiness), 0);
  return () => {
    listeners.delete(callback);
  };
}

export async function checkNip07Readiness(
  expectedPubkeyHex: string | null
): Promise<void> {
  if (typeof window === "undefined") {
    setReadiness("unknown");
    return;
  }

  if (!window.nostr) {
    setReadiness(REASON_UNRESPONSIVE);
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent(EVENT_NOSTR_CONNECTION_STALE, {
          detail: {
            signerType: SIGNER_TYPE_NIP07,
            reason: REASON_UNRESPONSIVE,
          },
        })
      );
    }
    return;
  }

  if (expectedPubkeyHex == null || expectedPubkeyHex === "") {
    setReadiness("unknown");
    return;
  }

  const now = Date.now();
  if (now - lastGetPublicKeyCheckTime < NIP07_GET_PUBLIC_KEY_THROTTLE_MS) {
    // Skip to avoid spamming "allow app to get public key" — at most 1 prompt per minute.
    return;
  }

  try {
    lastGetPublicKeyCheckTime = now;
    const pubkeyPromise = window.nostr.getPublicKey();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Connection check timeout")),
        NIP07_CHECK_TIMEOUT_MS
      )
    );
    const extensionPubkey = await Promise.race([pubkeyPromise, timeoutPromise]);

    const expected = expectedPubkeyHex.toLowerCase();
    const actual = String(extensionPubkey).toLowerCase();
    if (expected !== actual) {
      consecutiveReadinessFailures = 0;
      setReadiness("account_mismatch");
      if (typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
          new CustomEvent(EVENT_NOSTR_CONNECTION_STALE, {
            detail: {
              signerType: SIGNER_TYPE_NIP07,
              reason: "account_mismatch",
            },
          })
        );
      }
      return;
    }

    consecutiveReadinessFailures = 0;
    setReadiness("ready");
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(
        new CustomEvent("nostr-connection-healthy", {
          detail: { signerType: SIGNER_TYPE_NIP07 },
        })
      );
    }
  } catch {
    consecutiveReadinessFailures++;
    if (
      consecutiveReadinessFailures >= NIP07_UNRESPONSIVE_CONSECUTIVE_THRESHOLD
    ) {
      setReadiness(REASON_UNRESPONSIVE);
      if (typeof window.dispatchEvent === "function") {
        window.dispatchEvent(
          new CustomEvent(EVENT_NOSTR_CONNECTION_STALE, {
            detail: {
              signerType: SIGNER_TYPE_NIP07,
              reason: REASON_UNRESPONSIVE,
            },
          })
        );
      }
    }
    // Else: keep previous readiness so a single timeout doesn't flip to "unresponsive"
  }
}
