import { useCallback, useRef, useState } from "react";

import { parseSecretKeyHex, serializeSecretKey } from "~/features/auth/signer";
import {
  canAttemptCircuitBreaker,
  getCircuitBreakerStatus,
  recordCircuitBreakerFailure,
  recordCircuitBreakerSuccess,
} from "~/lib/nostr-circuit-breaker.client";
import { recordConnectionAttempt } from "~/lib/nostr-connection-metrics.client";

import type { LoginError, LoginState } from "./login-flow.client";
import { normalizeError, PROFILE_MISMATCH_MESSAGE } from "./login-flow.client";
import {
  connectNip46WithBunkerInputForLogin,
  connectNip46WithNostrConnectUriForLogin,
  connectNip46WithPendingUriForLogin,
} from "./nip46/nip46-connect.client";
import { persistNip46LoginSession } from "./nip46/nip46-persist.client";
import type { NostrSigner } from "./nostr-signer.client";
import { parseRelayList } from "./parse-relay-list";

const SUBSCRIPTION_CLOSED_ERROR = "subscription closed";
const PENDING_NIP46_STORAGE_KEY = "__smartflow_pending_nip46_uri_v1";

export type Nip46LoginStatus = "idle" | "loading" | "error";

export interface Nip46LoginError {
  code: LoginError;
  message: string;
  details?: string;
}

export interface Nip46ConnectParams {
  relayList: string;
  nip46Tab: "bunker" | "nostrconnect";
  nip46Input: string;
  retryCount?: number;
  /** Current URI and state so hook can skip if connection already in progress */
  currentUri: string | null;
  currentState: LoginState;
}

export interface UseNip46LoginOptions {
  expectedPubkey: string | null;
  onSuccess: (signer: NostrSigner, pubkey: string) => void;
  onFailure: (error: Nip46LoginError) => void;
  onConnectionStart?: (timeoutMs: number) => void;
  onConnectionEnd?: () => void;
}

export function useNip46Login({
  expectedPubkey,
  onSuccess,
  onFailure,
  onConnectionStart,
  onConnectionEnd,
}: UseNip46LoginOptions): {
  connect: (params: Nip46ConnectParams) => Promise<void>;
  resume: () => Promise<void>;
  status: Nip46LoginStatus;
  error: Nip46LoginError | null;
  nostrConnectUri: string | null;
  setNostrConnectUri: (uri: string | null) => void;
  getPendingNostrConnect: () => {
    uri: string;
    clientSecretKey: Uint8Array;
    relays: string[];
  } | null;
  clearPendingNostrConnectStorage: () => void;
  setPendingUri: (
    uri: string,
    clientSecretKey: Uint8Array,
    relays: string[]
  ) => void;
  cancelRef: React.MutableRefObject<{ cancel: () => void } | null>;
} {
  const [status, setStatus] = useState<Nip46LoginStatus>("idle");
  const [error, setError] = useState<Nip46LoginError | null>(null);
  const [nostrConnectUri, setNostrConnectUriState] = useState<string | null>(
    null
  );
  const cancelRef = useRef<{ cancel: () => void } | null>(null);
  const attemptIdRef = useRef(0);
  const pendingNostrConnectRef = useRef<{
    uri: string;
    clientSecretKey: Uint8Array;
    relays: string[];
  } | null>(null);

  const getPendingNostrConnect = useCallback(() => {
    if (pendingNostrConnectRef.current) return pendingNostrConnectRef.current;
    try {
      const raw = sessionStorage.getItem(PENDING_NIP46_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as {
        uri: string;
        clientSecretKeyHex: string;
        relays: string[];
      };
      return {
        uri: parsed.uri,
        clientSecretKey: parseSecretKeyHex(parsed.clientSecretKeyHex),
        relays: parsed.relays,
      };
    } catch {
      return null;
    }
  }, []);

  const clearPendingNostrConnectStorage = useCallback(() => {
    pendingNostrConnectRef.current = null;
    try {
      sessionStorage.removeItem(PENDING_NIP46_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const setNostrConnectUri = useCallback((uri: string | null) => {
    setNostrConnectUriState(uri);
  }, []);

  const connect = useCallback(
    async (params: Nip46ConnectParams) => {
      const {
        relayList,
        nip46Tab,
        nip46Input,
        retryCount = 0,
        currentUri,
        currentState,
      } = params;

      const shouldSkip =
        currentUri &&
        (currentState === "awaiting_profile_selection" ||
          currentState === "signer_initializing") &&
        retryCount === 0;
      if (shouldSkip) return;

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const err: Nip46LoginError = {
          code: "UNKNOWN",
          message: "You're offline. Check your connection and try again.",
        };
        setError(err);
        setStatus("error");
        onFailure(err);
        return;
      }

      const startTime = Date.now();
      const circuitOpen =
        retryCount === 0 && !canAttemptCircuitBreaker("nip46");
      if (circuitOpen) {
        const status = getCircuitBreakerStatus("nip46");
        recordConnectionAttempt({
          signerType: "nip46",
          method: nip46Tab === "bunker" ? "bunker_input" : "nostrconnect_uri",
          success: false,
          errorCode: "CIRCUIT_BREAKER_OPEN",
          retryCount: 0,
        });
        const err: Nip46LoginError = {
          code: "SIGNER_CONNECTION_DROPPED",
          message: `Too many recent connection failures. Please wait ${Math.ceil(
            (status.cooldownRemaining ?? 0) / 1000
          )} seconds before trying again.`,
        };
        setError(err);
        setStatus("error");
        onFailure(err);
        return;
      }

      const attemptId = (attemptIdRef.current += 1);
      setError(null);
      setStatus("loading");

      const baseTimeout = 120_000;
      const timeoutMs =
        retryCount === 0
          ? baseTimeout
          : Math.max(baseTimeout / Math.pow(2, retryCount), 30_000);
      onConnectionStart?.(timeoutMs);

      const relays = parseRelayList(relayList);

      const isMobile =
        typeof navigator !== "undefined" &&
        (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) ||
          navigator.maxTouchPoints > 1);
      if (retryCount > 0 && isMobile) {
        const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const failWith = (err: Nip46LoginError) => {
        setError(err);
        setStatus("error");
        onFailure(err);
      };

      const checkProfileMismatch = (pk: string) => {
        if (!expectedPubkey || pk === expectedPubkey) return false;
        failWith({
          code: "PROFILE_MISMATCH",
          message: PROFILE_MISMATCH_MESSAGE,
        });
        return true;
      };

      async function runBunkerFlow(): Promise<void> {
        const { signer, pubkey, config } =
          await connectNip46WithBunkerInputForLogin({
            bunkerInput: nip46Input,
            timeoutMs,
            retryCount,
          });
        if (attemptId !== attemptIdRef.current) return;
        if (checkProfileMismatch(pubkey)) return;
        recordCircuitBreakerSuccess("nip46");
        recordConnectionAttempt({
          signerType: "nip46",
          method: "bunker_input",
          success: true,
          duration: Date.now() - startTime,
          retryCount,
        });
        persistNip46LoginSession(config, pubkey);
        onConnectionEnd?.();
        setStatus("idle");
        setNostrConnectUriState(null);
        onSuccess(signer, pubkey);
      }

      async function runNostrConnectFlow(): Promise<void> {
        const result = await connectNip46WithNostrConnectUriForLogin({
          relays,
          timeoutMs,
          retryCount,
          appName: "SmartFlowSocial",
          onUriCreated: (uri, pool, relaysToClose, clientSecretKey) => {
            setNostrConnectUriState(uri);
            const pending = {
              uri,
              clientSecretKey: clientSecretKey.slice(0),
              relays: [...relaysToClose],
            };
            pendingNostrConnectRef.current = pending;
            try {
              sessionStorage.setItem(
                PENDING_NIP46_STORAGE_KEY,
                JSON.stringify({
                  uri: pending.uri,
                  clientSecretKeyHex: serializeSecretKey(
                    pending.clientSecretKey
                  ),
                  relays: pending.relays,
                })
              );
            } catch {
              // ignore
            }
            let didCancel = false;
            cancelRef.current = {
              cancel: () => {
                if (didCancel) return;
                didCancel = true;
                try {
                  pool.close(relaysToClose);
                } catch {
                  // ignore
                }
              },
            };
          },
        });
        if (attemptId !== attemptIdRef.current) return;
        if (checkProfileMismatch(result.pubkey)) return;
        recordCircuitBreakerSuccess("nip46");
        recordConnectionAttempt({
          signerType: "nip46",
          method: "nostrconnect_uri",
          success: true,
          duration: Date.now() - startTime,
          retryCount,
        });
        onConnectionEnd?.();
        clearPendingNostrConnectStorage();
        setNostrConnectUriState(null);
        setStatus("idle");
        persistNip46LoginSession(result.config, result.pubkey);
        onSuccess(result.signer, result.pubkey);
      }

      try {
        if (nip46Tab === "bunker") {
          await runBunkerFlow();
          return;
        }
        await runNostrConnectFlow();
      } catch (e) {
        if (attemptId !== attemptIdRef.current) return;
        const n = normalizeError(e);
        const msgLower = n.message.toLowerCase();
        const isConnectionError =
          n.code === "SIGNER_CONNECTION_DROPPED" ||
          msgLower.includes(SUBSCRIPTION_CLOSED_ERROR) ||
          msgLower.includes("websocket") ||
          msgLower.includes("connection");
        if (isConnectionError) recordCircuitBreakerFailure("nip46");
        recordConnectionAttempt({
          signerType: "nip46",
          method: nip46Tab === "bunker" ? "bunker_input" : "nostrconnect_uri",
          success: false,
          errorCode: n.code,
          duration: Date.now() - startTime,
          retryCount,
        });
        const shouldSuppress =
          isConnectionError &&
          getPendingNostrConnect() !== null &&
          (currentState === "awaiting_profile_selection" ||
            currentState === "signer_initializing");
        if (shouldSuppress) return;
        onConnectionEnd?.();
        failWith(n);
      } finally {
        if (attemptId === attemptIdRef.current) {
          cancelRef.current = null;
        }
      }
    },
    [
      expectedPubkey,
      onSuccess,
      onFailure,
      onConnectionStart,
      onConnectionEnd,
      clearPendingNostrConnectStorage,
      getPendingNostrConnect,
    ]
  );

  const resume = useCallback(async () => {
    const pending = getPendingNostrConnect();
    if (!pending) return;

    const attemptId = (attemptIdRef.current += 1);
    setError(null);
    setStatus("loading");
    setNostrConnectUriState(pending.uri);

    const timeoutMs = 60_000;
    onConnectionStart?.(timeoutMs);

    try {
      const { signer, pubkey, config } =
        await connectNip46WithPendingUriForLogin({
          uri: pending.uri,
          clientSecretKey: pending.clientSecretKey,
          relays: pending.relays,
          timeoutMs,
          retryCount: 1,
          onPoolCreated: (pool, relaysToClose) => {
            cancelRef.current = {
              cancel: () => {
                try {
                  pool.close(relaysToClose);
                } catch {
                  // ignore
                }
              },
            };
          },
        });
      if (attemptId !== attemptIdRef.current) return;

      if (expectedPubkey && pubkey !== expectedPubkey) {
        const err: Nip46LoginError = {
          code: "PROFILE_MISMATCH",
          message: PROFILE_MISMATCH_MESSAGE,
        };
        setError(err);
        setStatus("error");
        onFailure(err);
        return;
      }
      recordCircuitBreakerSuccess("nip46");
      recordConnectionAttempt({
        signerType: "nip46",
        method: "nostrconnect_uri",
        success: true,
        duration: 0,
        retryCount: 1,
      });
      onConnectionEnd?.();
      clearPendingNostrConnectStorage();
      setNostrConnectUriState(null);
      setStatus("idle");
      persistNip46LoginSession(config, pubkey);
      onSuccess(signer, pubkey);
    } catch (e) {
      if (attemptId !== attemptIdRef.current) return;
      const n = normalizeError(e);
      recordCircuitBreakerFailure("nip46");
      recordConnectionAttempt({
        signerType: "nip46",
        method: "nostrconnect_uri",
        success: false,
        errorCode: n.code,
        duration: 0,
        retryCount: 1,
      });
      onConnectionEnd?.();
      setError(n);
      setStatus("error");
      onFailure(n);
    } finally {
      if (attemptId === attemptIdRef.current) {
        cancelRef.current = null;
      }
    }
  }, [
    expectedPubkey,
    getPendingNostrConnect,
    clearPendingNostrConnectStorage,
    onSuccess,
    onFailure,
    onConnectionStart,
    onConnectionEnd,
  ]);

  /** For "Login with Primal" flow: set URI and store pending without running connect. */
  const setPendingUri = useCallback(
    (uri: string, clientSecretKey: Uint8Array, relays: string[]) => {
      const pending = { uri, clientSecretKey, relays };
      pendingNostrConnectRef.current = pending;
      try {
        sessionStorage.setItem(
          PENDING_NIP46_STORAGE_KEY,
          JSON.stringify({
            uri: pending.uri,
            clientSecretKeyHex: serializeSecretKey(pending.clientSecretKey),
            relays: pending.relays,
          })
        );
      } catch {
        // ignore
      }
      setNostrConnectUriState(uri);
    },
    []
  );

  return {
    connect,
    resume,
    status,
    error,
    nostrConnectUri,
    setNostrConnectUri,
    setPendingUri,
    getPendingNostrConnect,
    clearPendingNostrConnectStorage,
    cancelRef,
  };
}
