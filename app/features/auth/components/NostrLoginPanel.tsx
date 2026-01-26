import { useLocation } from "@remix-run/react";
import { generateSecretKey } from "nostr-tools";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { NostrEvent } from "~/features/nostr/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
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
  "wss://relay.nostr.band",
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

function getErrorSuggestions(code: LoginError): string[] {
  switch (code) {
    case "SIGNER_NOT_FOUND":
      return [
        "Install/enable a NIP-07 browser extension, or use Remote Signer (NIP-46).",
      ];
    case "SIGNER_CONNECTION_DROPPED":
      return [
        "Try again.",
        "Remove unreachable relays or add alternatives in the relay list.",
        "If your signer supports it, try the bunker input method instead.",
      ];
    case "SIGNER_TIMEOUT":
      return [
        "Approve the request in your remote signer, then try again.",
        "If approval gets stuck, update your relay list and retry.",
      ];
    case "PERMISSION_DENIED":
      return [
        "Approve the permission request in your signer/extension, then try again.",
      ];
    case "PROFILE_MISMATCH":
      return [
        "Switch to the expected signer profile in your signer, then try again.",
      ];
    case "CHALLENGE_EXPIRED":
      return ["Try again to fetch a new login challenge."];
    case "SIGNATURE_INVALID":
      return [
        "Make sure you approved the signature request in the correct signer profile, then try again.",
      ];
    default:
      return ["Try again, or go back and select a different sign-in method."];
  }
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

  const initNip07 = useCallback(async () => {
    setError(null);
    setLastFailureOrigin(null);
    setState("signer_initializing");
    try {
      const s = new Nip07Signer();
      const pk = await s.getPublicKey();
      if (expectedPubkey && pk !== expectedPubkey) {
        setError({
          code: "PROFILE_MISMATCH",
          message: PROFILE_MISMATCH_MESSAGE,
        });
        setLastFailureOrigin("nip07_init");
        setState("failed");
        return;
      }
      setSigner(s);
      setPubkey(pk);
      setActiveSignerConfig({ type: "nip07" });
      setState("requesting_signature");
    } catch (e) {
      const n = normalizeError(e);
      setError(n);
      setLastFailureOrigin("nip07_init");
      setState("failed");
    }
  }, [expectedPubkey]);

  const initNip46 = useCallback(async () => {
    const attemptId = (nip46AttemptIdRef.current += 1);
    setError(null);
    setLastFailureOrigin(null);
    setState("awaiting_profile_selection");

    const timeoutMs = 2 * 60 * 1000; // 2 minutes
    const relays = parseRelayList(relayList);

    try {
      if (nip46Tab === "bunker") {
        const clientSecretKey = generateSecretKey();
        const { signer: nip46Signer, pubkey: pk } =
          await connectNip46WithBunkerInput({
            bunkerInput: nip46Input.trim(),
            clientSecretKey,
            timeoutMs,
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
        setSigner(nip46Signer);
        setPubkey(pk);
        setActiveSignerConfig({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: nip46Input.trim(),
          clientSecretKeyHex: serializeSecretKey(clientSecretKey),
        });
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
      setError(n);
      setLastFailureOrigin("nip46_init");
      setState("failed");
    } finally {
      if (attemptId === nip46AttemptIdRef.current) {
        nip46CancelRef.current = null;
      }
    }
  }, [expectedPubkey, nip46Input, nip46Tab, relayList]);

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

      const signedEvent = await signer.signEvent(event);

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
            <Button
              type="button"
              variant="default"
              className="bg-primary text-primary-foreground hover:bg-primary/90 h-auto py-3 text-base font-semibold shadow-lg transition-all hover:shadow-xl"
              onClick={() => void initNip07()}
            >
              Browser Extension (NIP-07)
            </Button>
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
            <div className="text-foreground text-base font-bold">
              Waiting for approval…
            </div>
          </div>
          <div className="text-muted-foreground text-sm leading-relaxed">
            Approve the connection in your remote signer. If you switch
            profiles, you switch identity and must re-authenticate.
          </div>
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
              disabled={state === "verifying_signature"}
            >
              {state === "verifying_signature"
                ? "Verifying…"
                : "Confirm login signature"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-border bg-card hover:bg-muted hover:text-foreground"
              onClick={() => void resetToSelection()}
            >
              Back
            </Button>
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
            {getErrorSuggestions(error.code).map((s) => (
              <li key={s} className="leading-relaxed">
                {s}
              </li>
            ))}
          </ul>
          {error.details ? (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium select-none">
                Technical details
              </summary>
              <pre className="border-border bg-background dark:bg-card mt-2 rounded-md border p-3 text-xs whitespace-pre-wrap">
                {error.details}
              </pre>
            </details>
          ) : null}
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
