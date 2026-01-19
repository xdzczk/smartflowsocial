import { useLocation } from "@remix-run/react";
import { generateSecretKey } from "nostr-tools";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { NostrEvent } from "~/features/nostr/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
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

type LoginError =
  | "SIGNER_NOT_FOUND"
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
  const npub = nostrAdapter.encodeNpub(pubkeyHex) ?? pubkeyHex;
  if (npub.length <= 20) return npub;
  return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
}

function normalizeError(err: unknown): { code: LoginError; message: string } {
  const fallback = { code: "UNKNOWN" as const, message: "Login failed" };
  if (err instanceof Error) {
    const msg = err.message || fallback.message;
    if (msg.includes("SIGNER_NOT_FOUND")) {
      return { code: "SIGNER_NOT_FOUND", message: "No Nostr signer detected" };
    }
    if (msg.includes("SIGNER_TIMEOUT")) {
      return {
        code: "SIGNER_TIMEOUT",
        message: "No approval received in time",
      };
    }
    if (msg.toLowerCase().includes("denied")) {
      return { code: "PERMISSION_DENIED", message: "Access denied" };
    }
    return { code: "UNKNOWN", message: msg };
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
  } | null>(null);
  const [signer, setSigner] = useState<NostrSigner | null>(null);
  const [pubkey, setPubkey] = useState<string | null>(null);

  const [nip46Tab, setNip46Tab] = useState<"bunker" | "nostrconnect">("bunker");
  const [nip46Input, setNip46Input] = useState("");
  const [relayList, setRelayList] = useState(DEFAULT_RELAYS);
  const [nostrConnectUri, setNostrConnectUri] = useState<string | null>(null);
  const nip46CancelRef = useRef<{ cancel: () => void } | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const cleanup = useCallback(async () => {
    nip46CancelRef.current?.cancel();
    nip46CancelRef.current = null;
    if (signer?.type === "nip46") {
      await signer.close?.();
    }
  }, [signer]);

  const reset = useCallback(async () => {
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
    setState("signer_selection");
  }, [cleanup]);

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

  const initNip07 = useCallback(async () => {
    setError(null);
    setState("signer_initializing");
    try {
      const s = new Nip07Signer();
      const pk = await s.getPublicKey();
      if (expectedPubkey && pk !== expectedPubkey) {
        setError({
          code: "PROFILE_MISMATCH",
          message: PROFILE_MISMATCH_MESSAGE,
        });
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
      setState("failed");
    }
  }, [expectedPubkey]);

  const initNip46 = useCallback(async () => {
    setError(null);
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
        if (expectedPubkey && pk !== expectedPubkey) {
          setError({
            code: "PROFILE_MISMATCH",
            message: PROFILE_MISMATCH_MESSAGE,
          });
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
      setNostrConnectUri(created.uri);

      // Allow cancel by closing relay connections used by the pool.
      nip46CancelRef.current = {
        cancel: () => {
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

      if (expectedPubkey && pk !== expectedPubkey) {
        setError({
          code: "PROFILE_MISMATCH",
          message: PROFILE_MISMATCH_MESSAGE,
        });
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
      const n = normalizeError(e);
      setError(n);
      setState("failed");
    } finally {
      nip46CancelRef.current = null;
    }
  }, [expectedPubkey, nip46Input, nip46Tab, relayList]);

  const performLogin = useCallback(async () => {
    if (!signer || !pubkey) return;
    setError(null);
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
        });
      } else if (n.message.toLowerCase().includes("invalid signature")) {
        setError({ code: "SIGNATURE_INVALID", message: "Signature invalid" });
      } else {
        setError(n);
      }
      setState("failed");
    }
  }, [pubkey, redirectTo, signer]);

  return (
    <div className="space-y-4">
      {state === "signer_selection" ? (
        <div className="space-y-3">
          <div className="text-sm font-medium">Sign in with Nostr</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="default"
              onClick={() => void initNip07()}
            >
              Browser Extension (NIP-07)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setState("signer_initializing")}
            >
              Remote Signer (NIP-46)
            </Button>
          </div>
        </div>
      ) : null}

      {state === "signer_initializing" && !signer ? (
        <div className="space-y-3 rounded-md border bg-white/50 p-4 dark:bg-gray-900/30">
          <div className="text-sm font-medium">Remote signer</div>
          <div className="text-muted-foreground text-sm">
            Connect a remote signer and approve a profile. Each profile
            represents a different identity (pubkey).
          </div>

          <Tabs
            value={nip46Tab}
            onValueChange={(v) => setNip46Tab(v as "bunker" | "nostrconnect")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="bunker" className="flex-1">
                Paste bunker input
              </TabsTrigger>
              <TabsTrigger value="nostrconnect" className="flex-1">
                Generate nostrconnect URI
              </TabsTrigger>
            </TabsList>

            <TabsContent value="bunker" className="space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Bunker input</div>
                <Input
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
                  onClick={() => void reset()}
                >
                  Cancel
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="nostrconnect" className="space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Relays</div>
                <textarea
                  className="border-input bg-background focus-visible:ring-ring min-h-[88px] w-full rounded-md border p-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                  value={relayList}
                  onChange={(e) => setRelayList(e.target.value)}
                />
              </div>

              {nostrConnectUri ? (
                <div className="space-y-1">
                  <div className="text-sm font-medium">nostrconnect URI</div>
                  <textarea
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
                  onClick={() => void reset()}
                >
                  Cancel
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}

      {state === "awaiting_profile_selection" ? (
        <div className="space-y-2 rounded-md border bg-white/50 p-4 text-sm dark:bg-gray-900/30">
          <div className="font-medium">Waiting for approval…</div>
          <div className="text-muted-foreground">
            Approve the connection in your remote signer. If you switch
            profiles, you switch identity and must re-authenticate.
          </div>
          {nostrConnectUri ? (
            <div className="space-y-3 pt-2">
              <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
                <div className="flex justify-center rounded-md border bg-white p-3 dark:bg-gray-950/30">
                  <QRCode value={nostrConnectUri} size={168} />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">nostrconnect URI</div>
                  <textarea
                    readOnly
                    className="border-input bg-background min-h-[88px] w-full rounded-md border p-2 text-sm shadow-sm"
                    value={nostrConnectUri}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
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
              onClick={() => void reset()}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {pubkey &&
      (state === "requesting_signature" || state === "verifying_signature") ? (
        <div className="space-y-3 rounded-md border bg-white/50 p-4 dark:bg-gray-900/30">
          <div className="text-sm">
            Signing in as{" "}
            <span className="font-medium">{formatNpubShort(pubkey)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
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
              onClick={() => void reset()}
            >
              Back
            </Button>
          </div>
        </div>
      ) : null}

      {state === "failed" && error ? (
        <div className="space-y-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          <div className="font-medium">Sign-in failed</div>
          <div>{error.message}</div>
          <div className="flex gap-2">
            {error.code === "SIGNER_NOT_FOUND" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void reset()}
              >
                Back
              </Button>
            ) : (
              <>
                <Button type="button" onClick={() => void reset()}>
                  Try again
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void reset()}
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
