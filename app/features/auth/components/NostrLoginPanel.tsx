import { useLocation } from "@remix-run/react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { generateSecretKey } from "nostr-tools";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { NostrEvent } from "~/features/nostr/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  canAttemptCircuitBreaker,
  getCircuitBreakerStatus,
  recordCircuitBreakerFailure,
  recordCircuitBreakerSuccess,
} from "~/lib/nostr-circuit-breaker.client";
import { recordConnectionAttempt } from "~/lib/nostr-connection-metrics.client";
import { convertHexToNpub } from "~/lib/nostr-conversion";
import {
  clearActiveSignerConfig,
  serializeSecretKey,
  setActiveSignerConfig,
} from "~/lib/nostr-signer-manager.client";

import {
  canonicalLoginMessage,
  connectNip46WithBunkerInput,
  connectNip46WithNostrConnectUri,
  createNip46NostrConnectUri,
  Nip07Signer,
  parseRelayList,
  type NostrSigner,
} from "../nostr-signer.client";

type LoginState =
  | "signer_selection"
  | "signer_initializing"
  | "awaiting_profile_selection"
  | "requesting_signature"
  | "verifying_signature"
  | "authenticated"
  | "failed";

type RelayCheckStatus = "checking" | "connected" | "failed";

interface RelayStatus {
  url: string;
  status: RelayCheckStatus;
  checkedAt: number;
  error?: string;
}

type LoginError =
  | "SIGNER_NOT_FOUND"
  | "SIGNER_CONNECTION_DROPPED"
  | "PERMISSION_DENIED"
  | "PROFILE_NOT_APPROVED"
  | "SIGNER_TIMEOUT"
  | "SIGNATURE_INVALID"
  | "CHALLENGE_EXPIRED"
  | "PROFILE_MISMATCH"
  | "UNKNOWN";

const LOGIN_EVENT_KIND = 27235;
const DEFAULT_RELAYS = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
].join("\n");
const PROFILE_MISMATCH_MESSAGE =
  "Different signer profile detected — re-authentication required";

function formatNpubShort(pubkeyHex?: string | null): string {
  if (!pubkeyHex) return "";
  // Use shared conversion utility that works in both server and client contexts
  const npub = pubkeyHex.startsWith("npub")
    ? pubkeyHex
    : convertHexToNpub(pubkeyHex);
  if (npub.length <= 20) return npub;
  return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
}

function getErrorTitle(code: LoginError): string {
  switch (code) {
    case "SIGNER_NOT_FOUND":
      return "No signer detected";
    case "SIGNER_CONNECTION_DROPPED":
      return "Couldn’t connect to remote signer";
    case "SIGNER_TIMEOUT":
      return "Approval timed out";
    case "PERMISSION_DENIED":
      return "Permission denied";
    case "PROFILE_MISMATCH":
      return "Wrong signer profile";
    case "CHALLENGE_EXPIRED":
      return "Login expired";
    case "SIGNATURE_INVALID":
      return "Signature invalid";
    default:
      return "Sign-in failed";
  }
}

function getErrorSuggestions(
  code: LoginError,
  context?: {
    relayStatuses?: Record<string, RelayStatus>;
    retryCount?: number;
    lastFailureOrigin?: "nip07_init" | "nip46_init" | "verify" | null;
  }
): string[] {
  const suggestions: string[] = [];

  switch (code) {
    case "SIGNER_NOT_FOUND":
      suggestions.push(
        "Install/enable a NIP-07 browser extension, or use Remote Signer (NIP-46)."
      );
      break;
    case "SIGNER_CONNECTION_DROPPED":
      suggestions.push("Try again.");

      // Context-aware suggestions
      if (context?.relayStatuses) {
        const failedRelays = Object.values(context.relayStatuses).filter(
          (s) => s.status === "failed"
        );
        if (failedRelays.length > 0) {
          suggestions.push(
            `Remove ${failedRelays.length} unreachable relay${failedRelays.length > 1 ? "s" : ""} or add alternatives in the relay list.`
          );
        }
      }

      if (context?.retryCount && context.retryCount >= 2) {
        suggestions.push(
          "If your signer supports it, try the bunker input method instead."
        );
      } else {
        suggestions.push(
          "Remove unreachable relays or add alternatives in the relay list."
        );
        suggestions.push(
          "If your signer supports it, try the bunker input method instead."
        );
      }
      break;
    case "SIGNER_TIMEOUT":
      suggestions.push(
        "Approve the request in your remote signer, then try again."
      );
      if (context?.relayStatuses) {
        const failedRelays = Object.values(context.relayStatuses).filter(
          (s) => s.status === "failed"
        );
        if (failedRelays.length > 0) {
          suggestions.push(
            "Update your relay list to remove unreachable relays and retry."
          );
        } else {
          suggestions.push(
            "If approval gets stuck, update your relay list and retry."
          );
        }
      } else {
        suggestions.push(
          "If approval gets stuck, update your relay list and retry."
        );
      }
      break;
    case "PERMISSION_DENIED":
      suggestions.push(
        "Approve the permission request in your signer/extension, then try again."
      );
      break;
    case "PROFILE_MISMATCH":
      suggestions.push(
        "Switch to the expected signer profile in your signer, then try again."
      );
      break;
    case "CHALLENGE_EXPIRED":
      suggestions.push("Try again to fetch a new login challenge.");
      break;
    case "SIGNATURE_INVALID":
      suggestions.push(
        "Make sure you approved the signature request in the correct signer profile, then try again."
      );
      break;
    default:
      suggestions.push(
        "Try again, or go back and select a different sign-in method."
      );
  }

  return suggestions;
}

/**
 * Classify error for intelligent retry strategy
 */
const SUBSCRIPTION_CLOSED_ERROR = "subscription closed";

function classifyErrorForRetry(error: {
  code: LoginError;
  message: string;
  details?: string;
}): {
  shouldRetry: boolean;
  retryStrategy: "exponential_backoff" | "progressive_timeout" | "none";
  isNetworkError: boolean;
  isTimeoutError: boolean;
  isPermissionError: boolean;
} {
  const code = error.code;
  const message = error.message.toLowerCase();
  const details = error.details?.toLowerCase() ?? "";

  const isNetworkError =
    code === "SIGNER_CONNECTION_DROPPED" ||
    message.includes("network") ||
    message.includes("connection") ||
    message.includes("websocket") ||
    details.includes(SUBSCRIPTION_CLOSED_ERROR);

  const isTimeoutError =
    code === "SIGNER_TIMEOUT" || message.includes("timeout");

  const isPermissionError =
    code === "PERMISSION_DENIED" || message.includes("denied");

  const shouldRetry =
    isNetworkError || isTimeoutError || code === "CHALLENGE_EXPIRED";

  const retryStrategy = isNetworkError
    ? "exponential_backoff"
    : isTimeoutError
      ? "progressive_timeout"
      : "none";

  return {
    shouldRetry,
    retryStrategy,
    isNetworkError,
    isTimeoutError,
    isPermissionError,
  };
}

function getRelayStatusLabel(status: RelayCheckStatus): string {
  switch (status) {
    case "checking":
      return "Checking…";
    case "connected":
      return "Connected";
    case "failed":
      return "Failed";
  }
}

function normalizeError(err: unknown): {
  code: LoginError;
  message: string;
  details?: string;
} {
  const fallback = {
    code: "UNKNOWN" as const,
    message: "Login failed",
    details: undefined,
  };
  if (err instanceof Error) {
    const msg = err.message || fallback.message;
    const msgLower = msg.toLowerCase();
    // Common NIP-46 / websocket failure modes from relay/pool libraries.
    if (
      msgLower.includes("subscription closed") ||
      msgLower.includes("websocket") ||
      msgLower.includes("closing") ||
      msgLower.includes("closed state")
    ) {
      return {
        code: "SIGNER_CONNECTION_DROPPED",
        message:
          "Connection to the remote signer was closed before approval completed. Try again, or update your relay list.",
        details: msg,
      };
    }
    if (msg.includes("SIGNER_NOT_FOUND")) {
      return {
        code: "SIGNER_NOT_FOUND",
        message: "No Nostr signer detected",
        details: msg,
      };
    }
    if (msg.includes("SIGNER_TIMEOUT")) {
      return {
        code: "SIGNER_TIMEOUT",
        message: "No approval received in time",
        details: msg,
      };
    }
    if (msgLower.includes("denied")) {
      return {
        code: "PERMISSION_DENIED",
        message: "Access denied",
        details: msg,
      };
    }
    return { code: "UNKNOWN", message: msg, details: msg };
  }
  return fallback;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = (await res.json()) as unknown;
  if (!res.ok) {
    // error-handler.server returns { success:false, error:{ message, code, statusCode } }
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      data["error"] &&
      typeof data["error"] === "object" &&
      "message" in data["error"]
    ) {
      throw new Error(
        String(
          (data as { error: { message?: unknown } }).error.message ??
            "Request failed"
        )
      );
    }
    throw new Error("Request failed");
  }
  return data as T;
}

// Complex authentication UI component handling multiple signer types, error states, and mobile optimizations
// eslint-disable-next-line sonarjs/cognitive-complexity -- Authentication flows require handling many edge cases, error states, and platform-specific behaviors
export default function NostrLoginPanel() {
  const location = useLocation();
  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("redirectTo") ?? "/dashboard";
  }, [location.search]);
  const expectedPubkey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("expectedPubkey");
    if (!raw) return null;
    // Accept either hex or npub for convenience
    return nostrAdapter.decodeNpub(raw) ?? raw;
  }, [location.search]);

  const [state, setState] = useState<LoginState>("signer_selection");
  const [error, setError] = useState<{
    code: LoginError;
    message: string;
    details?: string;
  } | null>(null);
  const [signer, setSigner] = useState<NostrSigner | null>(null);
  const [pubkey, setPubkey] = useState<string | null>(null);

  const [nip46Tab, setNip46Tab] = useState<"bunker" | "nostrconnect">("bunker");
  const [nip46Input, setNip46Input] = useState("");
  const [relayList, setRelayList] = useState(DEFAULT_RELAYS);
  const [nostrConnectUri, setNostrConnectUri] = useState<string | null>(null);
  const nip46CancelRef = useRef<{ cancel: () => void } | null>(null);
  const [copyOk, setCopyOk] = useState(false);
  const nip46AttemptIdRef = useRef(0);
  const errorRegionRef = useRef<HTMLDivElement | null>(null);
  const relayCheckAttemptIdRef = useRef(0);
  const relaySocketsRef = useRef<Map<string, WebSocket>>(new Map());
  const [relayStatuses, setRelayStatuses] = useState<
    Record<string, RelayStatus>
  >({});
  const [lastFailureOrigin, setLastFailureOrigin] = useState<
    "nip07_init" | "nip46_init" | "verify" | null
  >(null);
  const [nip07Available, setNip07Available] = useState<boolean | null>(null);
  const [connectionStartTime, setConnectionStartTime] = useState<number | null>(
    null
  );
  const [connectionTimeout, setConnectionTimeout] = useState<number | null>(
    null
  );
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [wasHiddenDuringConnection, setWasHiddenDuringConnection] =
    useState(false);

  const relayUrls = useMemo(() => parseRelayList(relayList), [relayList]);

  const closeRelaySockets = useCallback(() => {
    relayCheckAttemptIdRef.current += 1;
    relaySocketsRef.current.forEach((ws) => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    });
    relaySocketsRef.current.clear();
  }, []);

  const startRelayChecks = useCallback((relays: string[]) => {
    if (typeof window === "undefined") return;
    const attemptId = (relayCheckAttemptIdRef.current += 1);

    // Close any previous checks before starting a new run.
    relaySocketsRef.current.forEach((ws) => {
      try {
        ws.close();
      } catch {
        // ignore
      }
    });
    relaySocketsRef.current.clear();

    const now = Date.now();
    setRelayStatuses(
      Object.fromEntries(
        relays.map((url) => [
          url,
          { url, status: "checking", checkedAt: now } satisfies RelayStatus,
        ])
      )
    );

    const timeoutMs = 2500;

    for (const url of relays) {
      try {
        const ws = new WebSocket(url);
        relaySocketsRef.current.set(url, ws);

        let opened = false;
        let closedByUs = false;

        const timeout = window.setTimeout(() => {
          if (attemptId !== relayCheckAttemptIdRef.current) return;
          if (opened) return;
          setRelayStatuses((prev) => ({
            ...prev,
            [url]: {
              url,
              status: "failed",
              checkedAt: Date.now(),
              error: "Timed out while connecting",
            },
          }));
          try {
            closedByUs = true;
            ws.close();
          } catch {
            // ignore
          }
        }, timeoutMs);

        ws.onopen = () => {
          opened = true;
          window.clearTimeout(timeout);
          if (attemptId !== relayCheckAttemptIdRef.current) {
            try {
              closedByUs = true;
              ws.close();
            } catch {
              // ignore
            }
            return;
          }
          setRelayStatuses((prev) => ({
            ...prev,
            [url]: { url, status: "connected", checkedAt: Date.now() },
          }));
          // We only need a connectivity check; close immediately to avoid extra open sockets.
          try {
            closedByUs = true;
            ws.close();
          } catch {
            // ignore
          }
        };

        ws.onerror = () => {
          window.clearTimeout(timeout);
          if (attemptId !== relayCheckAttemptIdRef.current) return;
          setRelayStatuses((prev) => ({
            ...prev,
            [url]: {
              url,
              status: "failed",
              checkedAt: Date.now(),
              error: "Connection error",
            },
          }));
        };

        ws.onclose = (ev) => {
          window.clearTimeout(timeout);
          if (attemptId !== relayCheckAttemptIdRef.current) return;
          if (opened) return;
          if (closedByUs) return;
          const reason = ev.reason ? ` (${ev.reason})` : "";
          setRelayStatuses((prev) => ({
            ...prev,
            [url]: {
              url,
              status: "failed",
              checkedAt: Date.now(),
              error: `Closed before connect (code ${ev.code})${reason}`,
            },
          }));
        };
      } catch (e) {
        if (attemptId !== relayCheckAttemptIdRef.current) return;
        const msg =
          e instanceof Error ? e.message : "Failed to create WebSocket";
        setRelayStatuses((prev) => ({
          ...prev,
          [url]: {
            url,
            status: "failed",
            checkedAt: Date.now(),
            error: msg,
          },
        }));
      }
    }
  }, []);

  const cleanup = useCallback(async () => {
    nip46CancelRef.current?.cancel();
    nip46CancelRef.current = null;
    if (signer?.type === "nip46") {
      await signer.close?.();
    }
  }, [signer]);

  const resetToSelection = useCallback(async () => {
    // Invalidate any in-flight NIP-46 attempts immediately (before awaiting cleanup)
    nip46AttemptIdRef.current += 1;
    closeRelaySockets();
    setRelayStatuses({});
    try {
      await cleanup();
    } catch {
      // ignore
    }
    clearActiveSignerConfig();
    setSigner(null);
    setPubkey(null);
    setNostrConnectUri(null);
    setCopyOk(false);
    setError(null);
    setLastFailureOrigin(null);
    setState("signer_selection");
  }, [cleanup, closeRelaySockets]);

  const copyNostrConnectUri = useCallback(async () => {
    if (!nostrConnectUri) return;
    try {
      await navigator.clipboard.writeText(nostrConnectUri);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1500);
    } catch {
      // ignore
    }
  }, [nostrConnectUri]);

  useEffect(() => {
    return () => {
      void cleanup();
    };
  }, [cleanup]);

  useEffect(() => {
    // Only perform relay health checks when the user is working with the NIP-46
    // nostrconnect method (either configuring relays or waiting for approval).
    if (typeof window === "undefined") return;
    const shouldCheck =
      nip46Tab === "nostrconnect" &&
      (state === "signer_initializing" ||
        state === "awaiting_profile_selection");
    if (!shouldCheck) {
      closeRelaySockets();
      setRelayStatuses({});
      return;
    }

    if (relayUrls.length === 0) {
      closeRelaySockets();
      setRelayStatuses({});
      return;
    }

    // Debounce while user edits the relay list.
    const t = window.setTimeout(() => {
      startRelayChecks(relayUrls);
    }, 300);

    return () => {
      window.clearTimeout(t);
    };
  }, [closeRelaySockets, nip46Tab, relayUrls, startRelayChecks, state]);

  useEffect(() => {
    if (state === "failed" && errorRegionRef.current) {
      errorRegionRef.current.focus();
    }
  }, [state]);

  // Timeout progress indicator
  useEffect(() => {
    if (
      !connectionStartTime ||
      !connectionTimeout ||
      state !== "awaiting_profile_selection"
    ) {
      setTimeRemaining(null);
      return;
    }

    const updateProgress = () => {
      const elapsed = Date.now() - connectionStartTime;
      const remaining = Math.max(0, connectionTimeout - elapsed);
      setTimeRemaining(remaining);
    };

    updateProgress(); // Initial update
    const interval = setInterval(updateProgress, 1000); // Update every second
    return () => clearInterval(interval);
  }, [connectionStartTime, connectionTimeout, state]);

  // Detect app switching on mobile during connection
  useEffect(() => {
    if (state !== "awaiting_profile_selection") {
      setWasHiddenDuringConnection(false);
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWasHiddenDuringConnection(true);
      } else if (wasHiddenDuringConnection) {
        // User returned from signer app
        setWasHiddenDuringConnection(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [state, wasHiddenDuringConnection]);

  // Proactive NIP-07 extension detection
  useEffect(() => {
    const checkNip07Availability = () => {
      // @ts-ignore - window.nostr is injected by browser extensions at runtime
      const available = typeof window !== "undefined" && !!window.nostr;
      setNip07Available(available);
    };

    // Check immediately
    checkNip07Availability();

    // Re-check when page gains focus (extensions may inject asynchronously)
    const handleFocus = () => {
      checkNip07Availability();
    };

    // Listen for custom events that some extensions emit when injected
    const handleExtensionInjected = () => {
      checkNip07Availability();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("nostr#extension", handleExtensionInjected);

    // Poll for extension availability (some extensions inject with delay)
    const pollInterval = setInterval(() => {
      if (nip07Available === false) {
        checkNip07Availability();
      }
    }, 1000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("nostr#extension", handleExtensionInjected);
      clearInterval(pollInterval);
    };
  }, [nip07Available]);

  const initNip07 = useCallback(async () => {
    const startTime = Date.now();

    // Check circuit breaker
    if (!canAttemptCircuitBreaker("nip07")) {
      const status = getCircuitBreakerStatus("nip07");
      recordConnectionAttempt({
        signerType: "nip07",
        success: false,
        errorCode: "CIRCUIT_BREAKER_OPEN",
        retryCount: 0,
      });
      setError({
        code: "SIGNER_NOT_FOUND",
        message: `Too many recent failures. Please wait ${Math.ceil(
          (status.cooldownRemaining ?? 0) / 1000
        )} seconds before trying again.`,
      });
      setLastFailureOrigin("nip07_init");
      setState("failed");
      return;
    }

    setError(null);
    setLastFailureOrigin(null);
    setState("signer_initializing");
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
        setError({
          code: "PROFILE_MISMATCH",
          message: PROFILE_MISMATCH_MESSAGE,
        });
        setLastFailureOrigin("nip07_init");
        setState("failed");
        return;
      }
      recordCircuitBreakerSuccess("nip07");
      recordConnectionAttempt({
        signerType: "nip07",
        success: true,
        duration: Date.now() - startTime,
        retryCount: 0,
      });
      setSigner(s);
      setPubkey(pk);
      setActiveSignerConfig({ type: "nip07" });
      setState("requesting_signature");
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
      setLastFailureOrigin("nip07_init");
      setState("failed");
    }
  }, [expectedPubkey]);

  // Complex NIP-46 connection logic with retry handling, circuit breaker, mobile optimizations, and multiple connection methods
  const initNip46 = useCallback(
    // eslint-disable-next-line sonarjs/cognitive-complexity -- NIP-46 requires handling bunker input, nostrconnect URI, retries, timeouts, and mobile app switching
    async (retryCount = 0) => {
      // If we already have a connection URI and we're in awaiting state, don't restart
      // This prevents restarting the connection when user returns from signer app
      if (
        nostrConnectUri &&
        state === "awaiting_profile_selection" &&
        retryCount === 0
      ) {
        // Connection attempt is already in progress, don't restart
        return;
      }
      const startTime = Date.now();

      // Check circuit breaker (only on first attempt, retries are allowed)
      if (retryCount === 0 && !canAttemptCircuitBreaker("nip46")) {
        const status = getCircuitBreakerStatus("nip46");
        recordConnectionAttempt({
          signerType: "nip46",
          method: nip46Tab === "bunker" ? "bunker_input" : "nostrconnect_uri",
          success: false,
          errorCode: "CIRCUIT_BREAKER_OPEN",
          retryCount: 0,
        });
        setError({
          code: "SIGNER_CONNECTION_DROPPED",
          message: `Too many recent connection failures. Please wait ${Math.ceil(
            (status.cooldownRemaining ?? 0) / 1000
          )} seconds before trying again.`,
        });
        setLastFailureOrigin("nip46_init");
        setState("failed");
        return;
      }

      const attemptId = (nip46AttemptIdRef.current += 1);
      setError(null);
      setLastFailureOrigin(null);
      setState("awaiting_profile_selection");

      // Calculate progressive timeout: 120s, 60s, 30s
      const baseTimeout = 120_000; // 2 minutes
      const timeoutMs =
        retryCount === 0
          ? baseTimeout
          : Math.max(baseTimeout / Math.pow(2, retryCount), 30_000);

      setConnectionStartTime(Date.now());
      setConnectionTimeout(timeoutMs);

      // On mobile, add a delay before first connection attempt if this is a retry
      // This helps WebSocket connections stabilize after app becomes visible
      if (retryCount > 0 && typeof navigator !== "undefined") {
        const isMobile =
          /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          ) ||
          (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
        if (isMobile) {
          // Exponential backoff: 1s, 2s, 4s, etc. (max 8s)
          const delayMs = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      const relays = parseRelayList(relayList);

      try {
        if (nip46Tab === "bunker") {
          const clientSecretKey = generateSecretKey();
          const { signer: nip46Signer, pubkey: pk } =
            await connectNip46WithBunkerInput({
              bunkerInput: nip46Input.trim(),
              clientSecretKey,
              timeoutMs,
              retryCount,
            });
          if (attemptId !== nip46AttemptIdRef.current) return;
          if (expectedPubkey && pk !== expectedPubkey) {
            setError({
              code: "PROFILE_MISMATCH",
              message: PROFILE_MISMATCH_MESSAGE,
            });
            setLastFailureOrigin("nip46_init");
            setState("failed");
            return;
          }
          recordCircuitBreakerSuccess("nip46");
          recordConnectionAttempt({
            signerType: "nip46",
            method: "bunker_input",
            success: true,
            duration: Date.now() - startTime,
            retryCount,
          });
          setSigner(nip46Signer);
          setPubkey(pk);
          setActiveSignerConfig({
            type: "nip46",
            method: "bunker_input",
            bunkerInput: nip46Input.trim(),
            clientSecretKeyHex: serializeSecretKey(clientSecretKey),
          });
          setConnectionStartTime(null);
          setConnectionTimeout(null);
          setState("requesting_signature");
          return;
        }

        const created = createNip46NostrConnectUri({
          relays,
          appName: "SmartFlowSocial",
        });
        if (attemptId !== nip46AttemptIdRef.current) return;
        setNostrConnectUri(created.uri);

        // Allow cancel by closing relay connections used by the pool.
        let didCancel = false;
        nip46CancelRef.current = {
          cancel: () => {
            if (didCancel) return;
            didCancel = true;
            try {
              created.pool.close(created.relays);
            } catch {
              // ignore
            }
          },
        };

        const { signer: nip46Signer, pubkey: pk } =
          await connectNip46WithNostrConnectUri({
            uri: created.uri,
            clientSecretKey: created.clientSecretKey,
            pool: created.pool,
            timeoutMs,
            relaysToCloseOnCancel: created.relays,
            retryCount,
          });
        if (attemptId !== nip46AttemptIdRef.current) return;

        if (expectedPubkey && pk !== expectedPubkey) {
          setError({
            code: "PROFILE_MISMATCH",
            message: PROFILE_MISMATCH_MESSAGE,
          });
          setLastFailureOrigin("nip46_init");
          setState("failed");
          return;
        }
        recordCircuitBreakerSuccess("nip46");
        recordConnectionAttempt({
          signerType: "nip46",
          method: "nostrconnect_uri",
          success: true,
          duration: Date.now() - startTime,
          retryCount,
        });
        setConnectionStartTime(null);
        setConnectionTimeout(null);
        setSigner(nip46Signer);
        setPubkey(pk);
        setActiveSignerConfig({
          type: "nip46",
          method: "nostrconnect_uri",
          uri: created.uri,
          relays: created.relays,
          clientSecretKeyHex: serializeSecretKey(created.clientSecretKey),
        });
        setState("requesting_signature");
      } catch (e) {
        if (attemptId !== nip46AttemptIdRef.current) return;
        const n = normalizeError(e);

        // Auto-retry connection errors (especially on mobile) with exponential backoff
        // This helps with "subscription closed" errors that occur when switching apps
        const msgLower = n.message.toLowerCase();
        const isConnectionError =
          n.code === "SIGNER_CONNECTION_DROPPED" ||
          msgLower.includes(SUBSCRIPTION_CLOSED_ERROR) ||
          msgLower.includes("websocket") ||
          msgLower.includes("connection");

        const isMobile =
          typeof navigator !== "undefined" &&
          (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
          ) ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 1));

        // Record failure in circuit breaker and metrics
        if (isConnectionError) {
          recordCircuitBreakerFailure("nip46");
        }

        recordConnectionAttempt({
          signerType: "nip46",
          method: nip46Tab === "bunker" ? "bunker_input" : "nostrconnect_uri",
          success: false,
          errorCode: n.code,
          duration: Date.now() - startTime,
          retryCount,
        });

        // Auto-retry up to 2 times for connection errors on mobile
        // This helps with the common issue where the first attempt fails
        // but subsequent attempts succeed after WebSocket connections stabilize
        // iOS needs this more, but Android can also benefit
        // IMPORTANT: Only retry if we don't already have a connection URI set
        // If we have a URI, the user might be in the middle of approving it in the signer app
        // Don't restart the connection attempt in that case
        if (
          isConnectionError &&
          isMobile &&
          retryCount < 2 &&
          !nostrConnectUri
        ) {
          // Wait a bit before retrying (exponential backoff)
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 4000);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));

          // Retry the connection
          return initNip46(retryCount + 1);
        }

        setConnectionStartTime(null);
        setConnectionTimeout(null);
        setError(n);
        setLastFailureOrigin("nip46_init");
        setState("failed");
      } finally {
        if (attemptId === nip46AttemptIdRef.current) {
          nip46CancelRef.current = null;
        }
      }
    },
    [expectedPubkey, nip46Input, nip46Tab, relayList, nostrConnectUri, state]
  );

  const performLogin = useCallback(async () => {
    if (!signer || !pubkey) return;
    setError(null);
    setLastFailureOrigin(null);
    setState("requesting_signature");

    try {
      const challenge = await postJson<{
        challengeId: string;
        nonce: string;
        purpose: string;
        expiresAt: string;
      }>("/auth/nostr/challenge");

      const content = canonicalLoginMessage({
        nonce: challenge.nonce,
        expiresAtIso: challenge.expiresAt,
      });

      const event: NostrEvent = {
        kind: LOGIN_EVENT_KIND,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content,
      };

      // Add timeout for signature request to prevent UI freeze
      // Some extensions (like Keychat on iOS) may hang or be slow to respond
      const SIGNATURE_TIMEOUT_MS = 60_000; // 60 seconds
      const signaturePromise = signer.signEvent(event);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                "Signature request timed out. Please try again or check your extension."
              )
            ),
          SIGNATURE_TIMEOUT_MS
        )
      );

      const signedEvent = await Promise.race([
        signaturePromise,
        timeoutPromise,
      ]);

      setState("verifying_signature");
      const verify = await postJson<{
        success: true;
        redirectTo: string;
        sessionId: string;
        pubkey: string;
      }>("/auth/nostr/verify", {
        challengeId: challenge.challengeId,
        pubkey,
        signedEvent,
        redirectTo,
      });

      setState("authenticated");
      window.location.assign(verify.redirectTo);
    } catch (e) {
      const n = normalizeError(e);
      // Map a few known server messages to typed errors
      if (n.message.toLowerCase().includes("challenge expired")) {
        setError({
          code: "CHALLENGE_EXPIRED",
          message: "Login challenge expired",
          details: n.details,
        });
      } else if (n.message.toLowerCase().includes("invalid signature")) {
        setError({
          code: "SIGNATURE_INVALID",
          message: "Signature invalid",
          details: n.details,
        });
      } else if (
        n.message.toLowerCase().includes("timeout") ||
        n.message.toLowerCase().includes("timed out")
      ) {
        setError({
          code: "SIGNER_TIMEOUT",
          message:
            "Signature request timed out. The extension may be slow to respond. Please try again or check your extension settings.",
          details: n.details,
        });
      } else {
        setError(n);
      }
      setLastFailureOrigin("verify");
      setState("failed");
    }
  }, [pubkey, redirectTo, signer]);

  const handleTryAgain = useCallback(() => {
    if (lastFailureOrigin === "nip46_init") {
      void initNip46();
      return;
    }
    if (lastFailureOrigin === "nip07_init") {
      void initNip07();
      return;
    }
    if (lastFailureOrigin === "verify") {
      void performLogin();
      return;
    }
    void resetToSelection();
  }, [initNip07, initNip46, lastFailureOrigin, performLogin, resetToSelection]);

  return (
    <div className="space-y-4">
      {state === "signer_selection" ? (
        <div className="space-y-4">
          <div className="text-foreground text-base font-semibold">
            Sign in with Nostr
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Button
                type="button"
                variant="default"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-auto w-full py-3 text-base font-semibold shadow-lg transition-all hover:shadow-xl"
                onClick={() => void initNip07()}
                disabled={nip07Available === false}
              >
                <span className="flex items-center justify-center gap-2">
                  Browser Extension (NIP-07)
                  {nip07Available === false ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : null}
                </span>
              </Button>
              {nip07Available === false ? (
                <div className="text-muted-foreground space-y-1 text-xs">
                  <p className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Extension not detected
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span>Install:</span>
                    <a
                      href="https://getalby.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      Alby
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href="https://github.com/fiatjaf/nos2x"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      nos2x
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <a
                      href="https://amber.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      Amber
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-border bg-card hover:bg-muted hover:text-foreground h-auto py-3 text-base font-semibold shadow-md transition-all hover:shadow-lg dark:shadow-lg"
              onClick={() => setState("signer_initializing")}
            >
              Remote Signer (NIP-46)
            </Button>
          </div>
        </div>
      ) : null}

      {state === "signer_initializing" && !signer ? (
        <div className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl">
          <div className="space-y-2">
            <div className="text-foreground text-base font-bold">
              Remote signer
            </div>
            <div className="text-muted-foreground text-sm leading-relaxed">
              Connect a remote signer and approve a profile. Each profile
              represents a different identity (pubkey).
            </div>
          </div>

          <Tabs
            value={nip46Tab}
            onValueChange={(v) => setNip46Tab(v as "bunker" | "nostrconnect")}
          >
            <TabsList className="border-border bg-muted w-full">
              <TabsTrigger
                value="bunker"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1"
              >
                Paste bunker input
              </TabsTrigger>
              <TabsTrigger
                value="nostrconnect"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex-1"
              >
                Generate nostrconnect URI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bunker" className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="nip46BunkerInput">Bunker input</Label>
                <Input
                  id="nip46BunkerInput"
                  name="nip46BunkerInput"
                  value={nip46Input}
                  onChange={(e) => setNip46Input(e.target.value)}
                  placeholder="bunker://..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => void initNip46()}
                  disabled={!nip46Input.trim()}
                >
                  Connect
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void resetToSelection()}
                >
                  Cancel
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="nostrconnect" className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="nip46Relays">Relays</Label>
                <textarea
                  id="nip46Relays"
                  name="nip46Relays"
                  aria-describedby="nip46RelaysHelp"
                  className="border-input bg-background focus-visible:ring-ring min-h-[88px] w-full rounded-md border p-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                  value={relayList}
                  onChange={(e) => setRelayList(e.target.value)}
                />
                <div
                  id="nip46RelaysHelp"
                  className="text-muted-foreground text-xs"
                >
                  If approval gets stuck, try removing unreachable relays or add
                  alternatives.
                </div>
                {relayUrls.length > 0 ? (
                  <div className="border-border bg-muted/50 dark:bg-muted/30 space-y-2 rounded-md border p-3 pt-2 text-xs">
                    <div className="text-foreground font-medium">
                      Relay status (best-effort connectivity check):
                    </div>
                    <div className="grid gap-1.5">
                      {relayUrls.map((url) => {
                        const s = relayStatuses[url];
                        const status: RelayCheckStatus =
                          s?.status ?? "checking";
                        const color =
                          status === "connected"
                            ? "text-success dark:text-success"
                            : status === "failed"
                              ? "text-destructive dark:text-destructive"
                              : "text-muted-foreground";
                        return (
                          <div
                            key={url}
                            className="flex items-start justify-between gap-2"
                          >
                            <div className="truncate font-mono text-xs">
                              {url}
                            </div>
                            <div className={`shrink-0 font-medium ${color}`}>
                              {getRelayStatusLabel(status)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {nostrConnectUri ? (
                <div className="space-y-1">
                  <Label htmlFor="nip46NostrConnectUri">nostrconnect URI</Label>
                  <textarea
                    id="nip46NostrConnectUri"
                    readOnly
                    className="border-input bg-background min-h-[88px] w-full rounded-md border p-2 text-sm shadow-sm"
                    value={nostrConnectUri}
                  />
                  <div className="text-muted-foreground text-xs">
                    Paste this into your remote signer to approve. Then return
                    here and wait for approval.
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button type="button" onClick={() => void initNip46()}>
                  {nostrConnectUri ? "Retry" : "Generate & wait"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void resetToSelection()}
                >
                  Cancel
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}

      {state === "awaiting_profile_selection" ? (
        <div
          className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-3">
            <svg
              className="text-primary h-5 w-5 animate-spin"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <div className="flex-1">
              <div className="text-foreground text-base font-bold">
                {wasHiddenDuringConnection
                  ? "Returning from signer app…"
                  : "Waiting for approval…"}
              </div>
              {timeRemaining !== null ? (
                <div className="text-muted-foreground mt-1 text-xs">
                  Time remaining: {Math.ceil(timeRemaining / 1000)}s
                </div>
              ) : null}
            </div>
          </div>
          <div className="text-muted-foreground text-sm leading-relaxed">
            {wasHiddenDuringConnection
              ? "Connection will resume automatically. Please wait…"
              : "Approve the connection in your remote signer. If you switch profiles, you switch identity and must re-authenticate."}
          </div>
          {timeRemaining !== null && connectionTimeout ? (
            <div className="space-y-1">
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>Connection progress</span>
                <span>
                  {Math.round(
                    ((connectionTimeout - timeRemaining) / connectionTimeout) *
                      100
                  )}
                  %
                </span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      ((connectionTimeout - timeRemaining) /
                        connectionTimeout) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
          {relayUrls.length > 0 ? (
            <div className="border-border bg-muted/50 dark:bg-muted/30 rounded-md border p-3 text-xs">
              <div className="text-foreground mb-2 font-semibold">
                Relay status
              </div>
              <div className="grid gap-1.5">
                {relayUrls.map((url) => {
                  const s = relayStatuses[url];
                  const status: RelayCheckStatus = s?.status ?? "checking";
                  const color =
                    status === "connected"
                      ? "text-success dark:text-success"
                      : status === "failed"
                        ? "text-destructive dark:text-destructive"
                        : "text-muted-foreground";
                  return (
                    <div
                      key={url}
                      className="flex items-start justify-between gap-2"
                    >
                      <div className="truncate font-mono text-xs">{url}</div>
                      <div className={`shrink-0 font-medium ${color}`}>
                        {getRelayStatusLabel(status)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-muted-foreground mt-3 text-xs">
                If any relays fail, remove them from the list and click Try
                again.
              </div>
            </div>
          ) : null}
          {nostrConnectUri ? (
            <div className="space-y-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                <div className="border-border bg-background dark:bg-card flex justify-center rounded-lg border p-4 shadow-md">
                  <QRCode value={nostrConnectUri} size={168} />
                </div>
                <div className="space-y-3">
                  <Label
                    htmlFor="nip46NostrConnectUriWaiting"
                    className="text-sm font-semibold"
                  >
                    nostrconnect URI
                  </Label>
                  <textarea
                    id="nip46NostrConnectUriWaiting"
                    readOnly
                    className="border-input bg-background focus-visible:ring-ring min-h-[88px] w-full rounded-md border p-3 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                    value={nostrConnectUri}
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-border bg-card hover:bg-muted hover:text-foreground"
                      onClick={() => void copyNostrConnectUri()}
                    >
                      {copyOk ? "Copied" : "Copy"}
                    </Button>
                    <div className="text-muted-foreground text-xs">
                      Scan or paste into your remote signer to approve.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void resetToSelection()}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {pubkey &&
      (state === "requesting_signature" || state === "verifying_signature") ? (
        <div className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl">
          <div className="text-base">
            Signing in as{" "}
            <span className="text-primary font-bold">
              {formatNpubShort(pubkey)}
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
              onClick={() => void performLogin()}
              disabled
            >
              {state === "verifying_signature"
                ? "Verifying…"
                : "Waiting for signature…"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-border bg-card hover:bg-muted hover:text-foreground"
              onClick={() => void resetToSelection()}
              disabled={state === "verifying_signature"}
            >
              Cancel
            </Button>
          </div>
          <div className="text-muted-foreground text-xs">
            Waiting for your extension to sign the login request. If it
            doesn&apos;t respond, try canceling and checking your extension
            settings.
          </div>
        </div>
      ) : null}

      {state === "failed" && error ? (
        <div
          ref={errorRegionRef}
          tabIndex={-1}
          role="alert"
          aria-live="assertive"
          className="border-destructive bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive space-y-3 rounded-lg border p-5 text-sm shadow-lg focus:outline-none"
        >
          <div className="text-base font-bold">{getErrorTitle(error.code)}</div>
          <div className="text-sm leading-relaxed">{error.message}</div>
          <ul className="list-disc space-y-1.5 pl-5 text-xs">
            {getErrorSuggestions(error.code, {
              relayStatuses,
              retryCount:
                lastFailureOrigin === "nip46_init"
                  ? nip46AttemptIdRef.current - 1
                  : 0,
              lastFailureOrigin,
            }).map((s) => (
              <li key={s} className="leading-relaxed">
                {s}
              </li>
            ))}
          </ul>

          {/* Advanced Troubleshooting Section */}
          <details className="text-xs">
            <summary className="hover:text-foreground cursor-pointer font-medium select-none">
              Advanced Troubleshooting
            </summary>
            <div className="mt-3 space-y-3">
              {error.details ? (
                <div>
                  <div className="mb-1 font-medium">Technical Details:</div>
                  <pre className="border-border bg-background dark:bg-card overflow-x-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
                    {error.details}
                  </pre>
                </div>
              ) : null}

              <div>
                <div className="mb-1 font-medium">Error Classification:</div>
                <div className="border-border bg-muted/50 dark:bg-muted/30 rounded-md border p-2 text-xs">
                  {(() => {
                    const classification = classifyErrorForRetry(error);
                    return (
                      <div className="space-y-1">
                        <div>
                          <span className="font-medium">Type: </span>
                          {classification.isNetworkError
                            ? "Network Error"
                            : null}
                          {classification.isTimeoutError
                            ? "Timeout Error"
                            : null}
                          {classification.isPermissionError
                            ? "Permission Error"
                            : null}
                          {!classification.isNetworkError &&
                          !classification.isTimeoutError &&
                          !classification.isPermissionError
                            ? "Other Error"
                            : null}
                        </div>
                        <div>
                          <span className="font-medium">Retry Strategy: </span>
                          {classification.retryStrategy ===
                          "exponential_backoff"
                            ? "Exponential Backoff"
                            : null}
                          {classification.retryStrategy ===
                          "progressive_timeout"
                            ? "Progressive Timeout"
                            : null}
                          {classification.retryStrategy === "none"
                            ? "No Auto-Retry"
                            : null}
                        </div>
                        <div>
                          <span className="font-medium">Should Retry: </span>
                          {classification.shouldRetry ? "Yes" : "No"}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {relayUrls.length > 0 ? (
                <div>
                  <div className="mb-1 font-medium">Relay Status:</div>
                  <div className="border-border bg-muted/50 dark:bg-muted/30 space-y-1 rounded-md border p-2 text-xs">
                    {relayUrls.map((url) => {
                      const status = relayStatuses[url];
                      return (
                        <div key={url} className="flex justify-between">
                          <span className="truncate font-mono">{url}</span>
                          <span className="ml-2 shrink-0">
                            {status?.status === "connected"
                              ? "✓ Connected"
                              : status?.status === "failed"
                                ? "✗ Failed"
                                : "… Checking"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-1 font-medium">Copy Error for Support:</div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => {
                    void (async () => {
                      const errorText = `Error Code: ${error.code}\nMessage: ${error.message}\nDetails: ${error.details ?? "N/A"}\nTimestamp: ${new Date().toISOString()}`;
                      try {
                        await navigator.clipboard.writeText(errorText);
                        alert("Error details copied to clipboard");
                      } catch {
                        // Fallback for older browsers
                        const textarea = document.createElement("textarea");
                        textarea.value = errorText;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand("copy");
                        document.body.removeChild(textarea);
                        alert("Error details copied to clipboard");
                      }
                    })();
                  }}
                >
                  Copy Error Details
                </Button>
              </div>
            </div>
          </details>
          <div className="flex gap-3 pt-2">
            {error.code === "SIGNER_NOT_FOUND" ? (
              <Button
                type="button"
                variant="outline"
                className="border-border bg-card hover:bg-muted hover:text-foreground"
                onClick={() => void resetToSelection()}
              >
                Back
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                  onClick={handleTryAgain}
                >
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-border bg-card hover:bg-muted hover:text-foreground"
                  onClick={() => void resetToSelection()}
                >
                  Back
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
