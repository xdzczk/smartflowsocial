import { useLocation, useNavigate } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  classifyErrorForRetry,
  formatNpubShort,
  getErrorSuggestions,
  getErrorTitle,
  getResumeDelayMs,
  normalizeError,
  type ActiveSignerFlow,
  type LoginError,
  type LoginState,
  type RelayStatus,
} from "~/features/auth/login-flow.client";
import { useNip07Login } from "~/features/auth/nip07-login.client";
import { useNip46Login } from "~/features/auth/nip46-login.client";
import {
  canonicalLoginMessage,
  createNip46NostrConnectUri,
  getNostrConnectAppMetadata,
} from "~/features/auth/nostr-signer.client";
import type { NostrSigner } from "~/features/auth/nostr-signer.client";
import { parseRelayList } from "~/features/auth/parse-relay-list";
import type { NostrEvent } from "~/features/nostr/types";
import {
  clearStoredReferralContext,
  getStoredReferralContext,
  setStoredReferralContext,
} from "~/features/referral/referral-context.client";
import {
  INLINE_ICON_SIZE_CLASS,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { isMobile } from "~/lib/is-mobile";
import { isStandalonePWA } from "~/lib/is-standalone-pwa";
import { clearPersistedState } from "~/lib/lifecycle-manager.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import {
  cacheNip46SignerFromLogin,
  clearActiveSignerConfig,
  getActiveSignerConfig,
} from "~/lib/nostr-signer-manager.client";

import { Nip46QrUri } from "./Nip46QrUri";
import { RelayCheckStatus } from "./RelayCheckStatus";

const LOGIN_EVENT_KIND = 27235;
const DEFAULT_RELAYS = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
].join("\n");

/** Official Primal logo for "Login with Primal" button. */
function PrimalLogoIcon({ className }: { className?: string }) {
  return (
    <img
      src="/PrimalIcon.png"
      alt=""
      className={className}
      width={20}
      height={20}
      aria-hidden
    />
  );
}

/** Append Primal callback param so Primal redirects back to the app. Skipped in PWA so user manually switches back to the same window. */
function appendPrimalCallback(uri: string): string {
  if (isStandalonePWA()) return uri;
  const callbackUrl =
    typeof window !== "undefined"
      ? window.location.origin +
        window.location.pathname +
        window.location.search
      : "";
  if (!callbackUrl) return uri;
  if (uri.includes("callback=")) return uri;
  const sep = uri.includes("?") ? "&" : "?";
  return `${uri}${sep}callback=${encodeURIComponent(callbackUrl)}`;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const expectedPubkey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get("expectedPubkey");
    if (!raw) return null;
    // Accept either hex or npub for convenience
    return nostrAdapter.decodeNpub(raw) ?? raw;
  }, [location.search]);

  // Referral: store valid ?ref= in localStorage as fallback when cookie cannot be set (e.g. cross-site)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref")?.trim();
    if (!ref) return;
    const hex = nostrAdapter.decodeNpub(ref);
    if (hex?.length !== 64) return;
    const npub = nostrAdapter.encodeNpub(hex);
    if (npub) {
      setStoredReferralContext({
        referrer_npub: npub,
        created_at: new Date().toISOString(),
      });
    }
  }, [location.search]);

  const [state, setState] = useState<LoginState>("signer_selection");
  const [activeSignerFlow, setActiveSignerFlow] =
    useState<ActiveSignerFlow>(null);
  const [error, setError] = useState<{
    code: LoginError;
    message: string;
    details?: string;
  } | null>(null);
  const [signer, setSigner] = useState<NostrSigner | null>(null);
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [signingInDisplayName, setSigningInDisplayName] = useState<
    string | null
  >(null);

  const [nip46Tab, setNip46Tab] = useState<"bunker" | "nostrconnect">("bunker");
  const [nip46Input, setNip46Input] = useState("");
  const [relayList, setRelayList] = useState(DEFAULT_RELAYS);
  const [copyOk, setCopyOk] = useState(false);
  const errorRegionRef = useRef<HTMLDivElement | null>(null);
  const relayCheckAttemptIdRef = useRef(0);
  const [nip46AttemptCount, setNip46AttemptCount] = useState(0);
  const relaySocketsRef = useRef<Map<string, WebSocket>>(new Map());
  const [relayStatuses, setRelayStatuses] = useState<
    Record<string, RelayStatus>
  >({});
  const [lastFailureOrigin, setLastFailureOrigin] = useState<
    "nip07_init" | "nip46_init" | "verify" | null
  >(null);
  /** When true, the current NIP-46 signer was transferred to the signer manager before redirect; cleanup must not close it. */
  const signerTransferredToManagerRef = useRef(false);
  const [connectionStartTime, setConnectionStartTime] = useState<number | null>(
    null
  );
  const [connectionTimeout, setConnectionTimeout] = useState<number | null>(
    null
  );
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [wasHiddenDuringConnection, setWasHiddenDuringConnection] =
    useState(false);

  const nip07 = useNip07Login({
    expectedPubkey,
    onSuccess: (s, pk) => {
      setSigner(s);
      setPubkey(pk);
      setActiveSignerFlow("nip07");
      setState("requesting_signature");
    },
    onFailure: (e) => {
      setError(e);
      setLastFailureOrigin("nip07_init");
      setState("failed");
    },
  });

  const nip46 = useNip46Login({
    expectedPubkey,
    onSuccess: (s, pk) => {
      setSigner(s);
      setPubkey(pk);
      setState("requesting_signature");
    },
    onFailure: (e) => {
      setError(e);
      setLastFailureOrigin("nip46_init");
      setState("failed");
    },
    onConnectionStart: (timeoutMs) => {
      setConnectionStartTime(Date.now());
      setConnectionTimeout(timeoutMs);
    },
    onConnectionEnd: () => {
      setConnectionStartTime(null);
      setConnectionTimeout(null);
    },
  });

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

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- nip46.cancelRef is stable; avoid ref.current in deps
  const cleanup = useCallback(async () => {
    nip46.cancelRef.current?.cancel();
    if (signer?.type === "nip46" && !signerTransferredToManagerRef.current) {
      await signer.close?.();
    }
  }, [signer, nip46]);

  const resetToSelection = useCallback(async () => {
    closeRelaySockets();
    setRelayStatuses({});
    try {
      await cleanup();
    } catch {
      // ignore
    }
    signerTransferredToManagerRef.current = false;
    clearActiveSignerConfig();
    setSigner(null);
    setPubkey(null);
    nip46.setNostrConnectUri(null);
    nip46.clearPendingNostrConnectStorage();
    setCopyOk(false);
    setError(null);
    setLastFailureOrigin(null);
    setActiveSignerFlow(null);
    setState("signer_selection");
  }, [cleanup, closeRelaySockets, nip46]);

  const copyNostrConnectUri = useCallback(async () => {
    if (!nip46.nostrConnectUri) return;
    try {
      await navigator.clipboard.writeText(nip46.nostrConnectUri);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1500);
    } catch {
      // ignore
    }
  }, [nip46.nostrConnectUri]);

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
      queueMicrotask(() => setRelayStatuses({}));
      return;
    }

    if (relayUrls.length === 0) {
      closeRelaySockets();
      queueMicrotask(() => setRelayStatuses({}));
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

  // Fetch display name for "Signing in as username" when awaiting signature
  useEffect(() => {
    const isSigning =
      state === "requesting_signature" || state === "verifying_signature";
    if (!pubkey || !isSigning) {
      queueMicrotask(() => setSigningInDisplayName(null));
      return;
    }
    let cancelled = false;
    const q = new URLSearchParams({ pubkey });
    void (async () => {
      try {
        const res = await fetch(`/api/profile-display-name?${q}`);
        const data = (await res.json()) as { displayName?: string | null };
        const name =
          typeof data.displayName === "string" && data.displayName.trim()
            ? data.displayName.trim()
            : null;
        // Only update when we have a display name and effect wasn't cancelled
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- name is string | null; cancelled can be true after cleanup
        if (!cancelled && name) {
          setSigningInDisplayName(name);
        }
      } catch {
        // Keep display name null on error; we fall back to npub
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pubkey, state]);

  // Timeout progress indicator
  useEffect(() => {
    if (
      !connectionStartTime ||
      !connectionTimeout ||
      state !== "awaiting_profile_selection"
    ) {
      queueMicrotask(() => setTimeRemaining(null));
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

  // Store initNip46 in a ref so we can use it in the visibility change handler
  const connectNip46Ref = useRef<(() => void) | null>(null);
  useEffect(() => {
    connectNip46Ref.current = () => {
      setNip46AttemptCount((c) => c + 1);
      setActiveSignerFlow("nip46");
      setState("awaiting_profile_selection");
      void nip46.connect({
        relayList,
        nip46Tab,
        nip46Input,
        retryCount: 0,
        currentUri: nip46.nostrConnectUri,
        currentState: state,
      });
    };
    return () => {
      connectNip46Ref.current = null;
    };
  }, [nip46, relayList, nip46Tab, nip46Input, state]);

  const handleLoginWithPrimal = useCallback(() => {
    if (nip46.nostrConnectUri) {
      window.location.href = appendPrimalCallback(nip46.nostrConnectUri);
      return;
    }
    const relays = parseRelayList(relayList);
    if (relays.length === 0) return;
    const created = createNip46NostrConnectUri({
      relays,
      appName: "SmartFlowSocial",
      ...getNostrConnectAppMetadata(),
    });
    const uriWithCallback = appendPrimalCallback(created.uri);
    nip46.setPendingUri(
      uriWithCallback,
      created.clientSecretKey,
      created.relays
    );
    try {
      created.pool.close(created.relays);
    } catch {
      // ignore
    }
    setNip46Tab("nostrconnect");
    setState("awaiting_profile_selection");
    setConnectionStartTime(Date.now());
    setConnectionTimeout(120_000);
    window.location.href = uriWithCallback;
  }, [nip46, relayList]);

  // Detect app switching on mobile during connection
  useEffect(() => {
    if (
      state !== "awaiting_profile_selection" &&
      state !== "failed" &&
      state !== "signer_initializing"
    ) {
      queueMicrotask(() => setWasHiddenDuringConnection(false));
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWasHiddenDuringConnection(true);
        if (state === "awaiting_profile_selection") {
          nip46.cancelRef.current?.cancel();
        }
      } else if (wasHiddenDuringConnection) {
        setWasHiddenDuringConnection(false);
        if (
          nip46.nostrConnectUri &&
          (state === "awaiting_profile_selection" || state === "failed")
        ) {
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            setError({
              code: "UNKNOWN",
              message: "You're offline. Check your connection and try again.",
            });
            setState("failed");
            return;
          }
          if (state === "failed") {
            setError(null);
            setState("awaiting_profile_selection");
          }
          setTimeout(() => {
            if (nip46.getPendingNostrConnect()) {
              void nip46.resume();
            } else {
              const config = getActiveSignerConfig();
              if (
                config?.type === "nip46" &&
                config.method === "nostrconnect_uri"
              ) {
                connectNip46Ref.current?.();
              }
            }
          }, getResumeDelayMs());
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [nip46, state, wasHiddenDuringConnection]);

  // After full page load (e.g. redirect back from Primal), restore pending NIP-46 and resume connection
  useEffect(() => {
    const pending = nip46.getPendingNostrConnect();
    if (!pending) return;
    const t = setTimeout(() => {
      void nip46.resume();
    }, getResumeDelayMs());
    return () => clearTimeout(t);
  }, [nip46]);

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
      const verifyBody: {
        challengeId: string;
        pubkey: string;
        signedEvent: unknown;
        referral_context?: string;
      } = {
        challengeId: challenge.challengeId,
        pubkey,
        signedEvent,
      };
      const referralContext = getStoredReferralContext();
      if (referralContext) {
        verifyBody.referral_context = JSON.stringify(referralContext);
      }
      const verify = await postJson<{
        success: true;
        redirectTo: string;
        sessionId: string;
        pubkey: string;
      }>("/auth/nostr/verify", verifyBody);

      setState("authenticated");
      if (referralContext) {
        clearStoredReferralContext();
      }
      // Transfer NIP-46 signer to the manager so publish/schedule can use it without opening a second connection
      if (signer.type === "nip46") {
        cacheNip46SignerFromLogin(signer);
        signerTransferredToManagerRef.current = true;
      }
      // Use client-side navigation so the in-memory NIP-46 signer cache is preserved (full reload would lose it)
      queryClient.clear();
      clearPersistedState();
      navigate(verify.redirectTo, { replace: true });
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
  }, [pubkey, signer, queryClient, navigate]);

  // When we land on "requesting_signature" (after extension or remote signer is ready),
  // trigger the actual signature request. The UI shows "Waiting for signature..." but we
  // must call performLogin() to ask the extension/signer to sign — we were not doing this
  // before, so the user was stuck with no prompt from the extension.
  const hasTriggeredLoginRef = useRef(false);
  useEffect(() => {
    if (state !== "requesting_signature" || !signer || !pubkey) {
      if (state !== "requesting_signature") {
        hasTriggeredLoginRef.current = false;
      }
      return;
    }
    if (hasTriggeredLoginRef.current) return;
    hasTriggeredLoginRef.current = true;
    queueMicrotask(() => void performLogin());
  }, [state, signer, pubkey, performLogin]);

  const handleTryAgain = useCallback(() => {
    if (lastFailureOrigin === "nip46_init") {
      if (nip46.getPendingNostrConnect()) {
        void nip46.resume();
      } else {
        connectNip46Ref.current?.();
      }
      return;
    }
    if (lastFailureOrigin === "nip07_init") {
      setActiveSignerFlow("nip07");
      setState("signer_initializing");
      void nip07.connect();
      return;
    }
    if (lastFailureOrigin === "verify") {
      void performLogin();
      return;
    }
    void resetToSelection();
  }, [lastFailureOrigin, nip46, nip07, performLogin, resetToSelection]);

  return (
    <div className="space-y-4">
      {state === "signer_selection" ? (
        <div className="min-h-[164px] space-y-4">
          <div className="text-foreground text-base font-semibold">
            Sign in with Nostr
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Button
                type="button"
                variant="default"
                className="bg-primary text-primary-foreground hover:bg-primary/90 h-auto w-full py-3 text-base font-semibold shadow-lg transition-all hover:shadow-xl"
                onClick={() => {
                  setActiveSignerFlow("nip07");
                  setState("signer_initializing");
                  void nip07.connect();
                }}
                disabled={nip07.available === false}
              >
                <span className="flex items-center justify-center gap-2">
                  Browser Extension
                  {nip07.available === false ? (
                    <AlertTriangle className={INLINE_ICON_SIZE_CLASS} />
                  ) : null}
                </span>
              </Button>
              {nip07.available === false ? (
                <div className="text-muted-foreground space-y-1 text-xs">
                  <p className="flex items-center gap-1">
                    <AlertTriangle className={SMALL_ICON_SIZE_CLASS} />
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
                      <ExternalLink className={SMALL_ICON_SIZE_CLASS} />
                    </a>
                    <a
                      href="https://github.com/fiatjaf/nos2x"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      nos2x
                      <ExternalLink className={SMALL_ICON_SIZE_CLASS} />
                    </a>
                    <a
                      href="https://amber.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      Amber
                      <ExternalLink className={SMALL_ICON_SIZE_CLASS} />
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="border-border bg-card hover:bg-muted hover:text-foreground h-auto py-3 text-base font-semibold shadow-md transition-all hover:shadow-lg dark:shadow-lg"
              onClick={() => {
                setActiveSignerFlow("nip46");
                setState("signer_initializing");
              }}
            >
              Remote Signer
            </Button>
          </div>
          {isMobile() ? (
            <Button
              type="button"
              variant="default"
              className="bg-background text-foreground hover:bg-muted border-border h-auto w-full border py-3 text-base font-semibold shadow-lg transition-all hover:shadow-xl sm:col-span-2"
              onClick={() => handleLoginWithPrimal()}
            >
              <span className="flex items-center justify-center gap-2">
                <PrimalLogoIcon className="size-5 shrink-0" />
                Login with Primal
              </span>
            </Button>
          ) : null}
        </div>
      ) : null}

      {(() => {
        const isInitializingUnknown =
          state === "signer_initializing" &&
          !signer &&
          activeSignerFlow == null;
        const isInitializingNip07 =
          state === "signer_initializing" &&
          !signer &&
          activeSignerFlow === "nip07";
        const isInitializingNip46 =
          state === "signer_initializing" &&
          !signer &&
          activeSignerFlow === "nip46";
        const isConnectionInProgress =
          !!nip46.nostrConnectUri &&
          (state === "awaiting_profile_selection" ||
            state === "requesting_signature" ||
            state === "verifying_signature");

        if (isInitializingNip07) {
          return (
            <div
              className="border-border bg-card min-h-[164px] space-y-3 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="text-primary h-5 w-5 animate-spin" />
                <div className="text-foreground text-base font-semibold">
                  Checking browser extension…
                </div>
              </div>
              <div className="text-muted-foreground text-xs leading-relaxed">
                Waiting for your extension to provide your public key.
              </div>
            </div>
          );
        }

        if (isInitializingUnknown) {
          return (
            <div
              className="border-border bg-card min-h-[164px] space-y-3 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <div className="flex items-center gap-3">
                <Loader2 className="text-primary h-5 w-5 animate-spin" />
                <div className="text-foreground text-base font-semibold">
                  Preparing sign in…
                </div>
              </div>
            </div>
          );
        }

        if (!isInitializingNip46) return null;

        return (
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
                    onClick={() => {
                      setNip46AttemptCount((c) => c + 1);
                      setActiveSignerFlow("nip46");
                      setState("awaiting_profile_selection");
                      void nip46.connect({
                        relayList,
                        nip46Tab,
                        nip46Input,
                        retryCount: 0,
                        currentUri: nip46.nostrConnectUri,
                        currentState: state,
                      });
                    }}
                    disabled={!nip46Input.trim() || isConnectionInProgress}
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
                    If approval gets stuck, try removing unreachable relays or
                    add alternatives.
                  </div>
                  {relayUrls.length > 0 ? (
                    <RelayCheckStatus
                      relayUrls={relayUrls}
                      relayStatuses={relayStatuses}
                      title="Relay status (best-effort connectivity check):"
                    />
                  ) : null}
                </div>

                {nip46.nostrConnectUri ? (
                  <div className="space-y-1">
                    <Label htmlFor="nip46NostrConnectUri">
                      nostrconnect URI
                    </Label>
                    <textarea
                      id="nip46NostrConnectUri"
                      readOnly
                      className="border-input bg-background min-h-[88px] w-full rounded-md border p-2 text-sm shadow-sm"
                      value={nip46.nostrConnectUri}
                    />
                    <div className="text-muted-foreground text-xs">
                      Paste this into your remote signer to approve. Then return
                      here and wait for approval.
                    </div>
                  </div>
                ) : null}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setNip46AttemptCount((c) => c + 1);
                      setActiveSignerFlow("nip46");
                      setState("awaiting_profile_selection");
                      void nip46.connect({
                        relayList,
                        nip46Tab,
                        nip46Input,
                        retryCount: 0,
                        currentUri: nip46.nostrConnectUri,
                        currentState: state,
                      });
                    }}
                    disabled={isConnectionInProgress}
                  >
                    {nip46.nostrConnectUri ? "Retry" : "Generate & wait"}
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
        );
      })()}

      {state === "awaiting_profile_selection" ? (
        <div
          className="border-border bg-card space-y-4 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-3">
            <Loader2
              className="text-primary h-5 w-5 animate-spin"
              aria-hidden
            />
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
            <RelayCheckStatus
              relayUrls={relayUrls}
              relayStatuses={relayStatuses}
              title="Relay status"
            >
              If any relays fail, remove them from the list and click Try again.
            </RelayCheckStatus>
          ) : null}
          {nip46.nostrConnectUri ? (
            <Nip46QrUri
              uri={nip46.nostrConnectUri}
              onCopy={() => {
                void copyNostrConnectUri();
              }}
              copyOk={copyOk}
              textareaId="nip46NostrConnectUriWaiting"
              helperText="Scan or paste into your remote signer to approve."
            >
              {isMobile() ? (
                <Button
                  type="button"
                  variant="default"
                  className="bg-background text-foreground hover:bg-muted border-border border"
                  onClick={() => {
                    handleLoginWithPrimal();
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <PrimalLogoIcon className="size-5 shrink-0" />
                    Login with Primal
                  </span>
                </Button>
              ) : null}
            </Nip46QrUri>
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
        <div className="border-border bg-card min-h-[164px] space-y-4 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl">
          <div className="flex min-h-6 w-full items-center gap-1 text-base">
            <span className="shrink-0">Signing in as</span>
            <span
              className="text-primary min-w-0 truncate font-bold"
              title={signingInDisplayName ?? formatNpubShort(pubkey)}
            >
              {signingInDisplayName ?? formatNpubShort(pubkey)}
            </span>
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[170px] justify-center shadow-md"
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

      {!pubkey &&
      (state === "requesting_signature" || state === "verifying_signature") ? (
        <div
          className="border-border bg-card min-h-[164px] space-y-3 rounded-lg border p-6 shadow-lg dark:bg-[hsl(var(--landing-card-elevated))] dark:shadow-xl"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-3">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
            <div className="text-foreground text-base font-semibold">
              Finalizing sign in…
            </div>
          </div>
        </div>
      ) : null}

      {state === "failed" && error ? (
        <Alert
          ref={errorRegionRef}
          tabIndex={-1}
          aria-live="assertive"
          variant="destructive"
          className="space-y-3 p-5 text-sm shadow-lg"
        >
          <AlertTitle>{getErrorTitle(error.code)}</AlertTitle>
          <AlertDescription className="space-y-3">
            <div className="leading-relaxed">{error.message}</div>
            <ul className="list-disc space-y-1.5 pl-5 text-xs">
              {getErrorSuggestions(error.code, {
                relayStatuses,
                retryCount:
                  lastFailureOrigin === "nip46_init"
                    ? Math.max(0, nip46AttemptCount - 1)
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
                            <span className="font-medium">
                              Retry Strategy:{" "}
                            </span>
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
                  <div className="mb-1 font-medium">
                    Copy Error for Support:
                  </div>
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
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
