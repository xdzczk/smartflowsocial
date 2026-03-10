import { useCallback, useEffect, useState } from "react";

import { setActiveSignerConfig } from "~/features/auth/signer";
import {
  canAttemptCircuitBreaker,
  getCircuitBreakerStatus,
  recordCircuitBreakerFailure,
  recordCircuitBreakerSuccess,
} from "~/lib/nostr-circuit-breaker.client";
import { recordConnectionAttempt } from "~/lib/nostr-connection-metrics.client";

import type { LoginError } from "./login-flow.client";
import { normalizeError, PROFILE_MISMATCH_MESSAGE } from "./login-flow.client";
import { Nip07Signer } from "./nostr-signer.client";
import type { NostrSigner } from "./nostr-signer.client";

export type Nip07LoginStatus = "idle" | "loading" | "error";

export interface Nip07LoginError {
  code: LoginError;
  message: string;
  details?: string;
}

export interface UseNip07LoginOptions {
  expectedPubkey: string | null;
  onSuccess: (signer: NostrSigner, pubkey: string) => void;
  onFailure: (error: Nip07LoginError) => void;
}

export function useNip07Login({
  expectedPubkey,
  onSuccess,
  onFailure,
}: UseNip07LoginOptions): {
  connect: () => Promise<void>;
  status: Nip07LoginStatus;
  error: Nip07LoginError | null;
  available: boolean | null;
} {
  const [status, setStatus] = useState<Nip07LoginStatus>("idle");
  const [error, setError] = useState<Nip07LoginError | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      const ok =
        typeof window !== "undefined" &&
        !!(window as { nostr?: unknown }).nostr;
      setAvailable(ok);
    };
    check();
    const handleFocus = () => check();
    const handleExtension = () => check();
    window.addEventListener("focus", handleFocus);
    window.addEventListener("nostr#extension", handleExtension);
    const interval = setInterval(() => {
      if (available === false) check();
    }, 1000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("nostr#extension", handleExtension);
      clearInterval(interval);
    };
  }, [available]);

  const connect = useCallback(async () => {
    const startTime = Date.now();
    setError(null);
    setStatus("loading");

    if (!canAttemptCircuitBreaker("nip07")) {
      const status = getCircuitBreakerStatus("nip07");
      recordConnectionAttempt({
        signerType: "nip07",
        success: false,
        errorCode: "CIRCUIT_BREAKER_OPEN",
        retryCount: 0,
      });
      const err: Nip07LoginError = {
        code: "SIGNER_NOT_FOUND",
        message: `Too many recent failures. Please wait ${Math.ceil(
          (status.cooldownRemaining ?? 0) / 1000
        )} seconds before trying again.`,
      };
      setError(err);
      setStatus("error");
      onFailure(err);
      return;
    }

    try {
      const s = new Nip07Signer();
      const pk = await s.getPublicKey();
      if (expectedPubkey && pk !== expectedPubkey) {
        recordCircuitBreakerFailure("nip07");
        recordConnectionAttempt({
          signerType: "nip07",
          success: false,
          errorCode: "PROFILE_MISMATCH",
          duration: Date.now() - startTime,
          retryCount: 0,
        });
        const err: Nip07LoginError = {
          code: "PROFILE_MISMATCH",
          message: PROFILE_MISMATCH_MESSAGE,
        };
        setError(err);
        setStatus("error");
        onFailure(err);
        return;
      }
      recordCircuitBreakerSuccess("nip07");
      recordConnectionAttempt({
        signerType: "nip07",
        success: true,
        duration: Date.now() - startTime,
        retryCount: 0,
      });
      setActiveSignerConfig({ type: "nip07" });
      setStatus("idle");
      setError(null);
      onSuccess(s, pk);
    } catch (e) {
      recordCircuitBreakerFailure("nip07");
      const n = normalizeError(e);
      recordConnectionAttempt({
        signerType: "nip07",
        success: false,
        errorCode: n.code,
        duration: Date.now() - startTime,
        retryCount: 0,
      });
      setError(n);
      setStatus("error");
      onFailure(n);
    }
  }, [expectedPubkey, onSuccess, onFailure]);

  return { connect, status, error, available };
}
