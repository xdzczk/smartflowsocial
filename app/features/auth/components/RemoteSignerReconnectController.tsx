import { generateSecretKey, SimplePool } from "nostr-tools";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import QRCode from "react-qr-code";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { isMobile } from "~/lib/is-mobile";
import { isStandalonePWA } from "~/lib/is-standalone-pwa";
import { convertToHex } from "~/lib/nostr-conversion";
import {
  clearActiveSignerConfig,
  parseSecretKeyHex,
  serializeSecretKey,
  setActiveSignerConfig,
  type ActiveSignerConfig,
} from "~/lib/nostr-signer-manager.client";
import { useOptionalUser } from "~/lib/remix-utils";
import {
  OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
  REMOTE_SIGNER_TIMEOUT_EVENT,
  type RemoteSignerTimeoutEventDetail,
} from "~/lib/remote-signer-reconnect.client";
import {
  createSession,
  detectSignerAppName,
  getActiveSession,
  setActiveSession,
  updateSession,
} from "~/lib/remote-signer-sessions.client";
import { recordConnectionEvent } from "~/lib/remote-signer-status.client";

import {
  connectNip46WithBunkerInput,
  connectNip46WithNostrConnectUri,
  createNip46NostrConnectUri,
  getNostrConnectAppMetadata,
  parseRelayList,
} from "../nostr-signer.client";

const DEFAULT_RELAYS = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
].join("\n");

/** Survives app backgrounding when user switches to signer app (e.g. Primal). */
const PENDING_RECONNECT_STORAGE_KEY = "__smartflow_pending_reconnect_nip46_v1";

const PROFILE_MISMATCH_MESSAGE =
  "Different signer profile detected. Please activate the same identity as your SmartFlow session.";

const RECONNECT_SUCCESS_TOAST_RETRY =
  "Remote signer reconnected. Please retry your action.";

const EXISTING_SESSION_RECONNECT_TIMEOUT_MS = 60_000;
const EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS = 1200;

/** Append callback so Primal redirects back to app (skip in standalone PWA). */
function appendPrimalCallback(uri: string): string {
  if (isStandalonePWA()) return uri;
  if (typeof window === "undefined") return uri;
  if (uri.includes("callback=")) return uri;

  const callbackUrl =
    window.location.origin + window.location.pathname + window.location.search;
  const separator = uri.includes("?") ? "&" : "?";
  return `${uri}${separator}callback=${encodeURIComponent(callbackUrl)}`;
}

type ConnectState =
  | "idle"
  | "reconnecting_existing"
  | "uri_ready"
  | "waiting"
  | "connected"
  | "failed";

interface RemoteSignerReconnectControllerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onReconnectSuccess?: (sessionId: string) => void;
}

export function RemoteSignerReconnectController(
  props?: RemoteSignerReconnectControllerProps
) {
  const user = useOptionalUser();
  const expectedPubkey = user?.npub ?? null;

  const [dialogOpen, setDialogOpen] = useState(props?.open ?? false);

  // Throttle toasts to avoid spam during rapid retries.
  const lastToastAtRef = useRef(0);
  const toastIdRef = useRef<string | null>(null);

  const openDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const showReconnectToast = useCallback(
    (detail?: RemoteSignerTimeoutEventDetail) => {
      const now = Date.now();
      if (now - lastToastAtRef.current < 5_000) return;
      lastToastAtRef.current = now;

      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }

      toastIdRef.current = toast.custom(
        (t) => (
          <div className="dark:bg-card w-[360px] rounded-lg border bg-white p-3 shadow-lg">
            <div className="dark:text-foreground text-foreground text-sm font-medium">
              Remote signer isn’t responding
            </div>
            <div className="dark:text-foreground text-foreground mt-1 text-sm">
              {detail?.message ??
                "Open your signer app to approve, or reconnect the session."}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => toast.dismiss(t.id)}
              >
                Dismiss
              </Button>
              <Button
                type="button"
                onClick={() => {
                  toast.dismiss(t.id);
                  openDialog();
                }}
              >
                Reconnect
              </Button>
            </div>
          </div>
        ),
        { duration: 15_000, position: "top-right" }
      );
    },
    [openDialog]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (ev: Event) => {
      const custom = ev as CustomEvent<RemoteSignerTimeoutEventDetail>;
      showReconnectToast(custom.detail);
    };
    const openHandler = () => {
      openDialog();
    };
    window.addEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handler);
    window.addEventListener(
      OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
      openHandler
    );
    return () => {
      window.removeEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handler);
      window.removeEventListener(
        OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
        openHandler
      );
    };
  }, [openDialog, showReconnectToast]);

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    props?.onOpenChange?.(open);
  };

  return (
    <RemoteSignerReconnectDialog
      open={props?.open ?? dialogOpen}
      onOpenChange={handleOpenChange}
      expectedPubkey={expectedPubkey}
      onReconnectSuccess={props?.onReconnectSuccess}
    />
  );
}

export function RemoteSignerReconnectDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedPubkey: string | null;
  onReconnectSuccess?: (sessionId: string) => void;
}) {
  const { open, onOpenChange, expectedPubkey, onReconnectSuccess } = props;
  const expectedPubkeyHex = (() => {
    if (!expectedPubkey) return null;
    return convertToHex(expectedPubkey) ?? expectedPubkey;
  })();

  const [tab, setTab] = useState<"nostrconnect" | "bunker">("nostrconnect");
  const [relayList, setRelayList] = useState(DEFAULT_RELAYS);
  const [bunkerInput, setBunkerInput] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");

  const [state, setState] = useState<ConnectState>("idle");
  const [nostrConnectUri, setNostrConnectUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const cancelRef = useRef<{ cancel: () => void } | null>(null);
  const triedExistingRef = useRef(false);
  const pendingReconnectRef = useRef<{
    uri: string;
    clientSecretKey: Uint8Array;
    relays: string[];
  } | null>(null);

  const getPendingReconnect = useCallback((): {
    uri: string;
    clientSecretKey: Uint8Array;
    relays: string[];
  } | null => {
    if (pendingReconnectRef.current) return pendingReconnectRef.current;
    try {
      const raw = sessionStorage.getItem(PENDING_RECONNECT_STORAGE_KEY);
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

  const setPendingReconnect = useCallback(
    (uri: string, clientSecretKey: Uint8Array, relays: string[]) => {
      const payload = {
        uri,
        clientSecretKeyHex: serializeSecretKey(clientSecretKey),
        relays,
      };
      pendingReconnectRef.current = { uri, clientSecretKey, relays };
      try {
        sessionStorage.setItem(
          PENDING_RECONNECT_STORAGE_KEY,
          JSON.stringify(payload)
        );
      } catch {
        // ignore
      }
    },
    []
  );

  const clearPendingReconnectStorage = useCallback(() => {
    pendingReconnectRef.current = null;
    try {
      sessionStorage.removeItem(PENDING_RECONNECT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const resetLocal = useCallback(() => {
    cancelRef.current?.cancel();
    cancelRef.current = null;
    triedExistingRef.current = false;
    clearPendingReconnectStorage();
    setState("idle");
    setNostrConnectUri(null);
    setError(null);
    setCopyOk(false);
    setSessionLabel("");
  }, [clearPendingReconnectStorage]);

  const tryReconnectWithExistingSession = useCallback(async () => {
    const session = getActiveSession();
    if (
      session?.config.type !== "nip46" ||
      session.config.method !== "nostrconnect_uri"
    ) {
      return;
    }

    const { uri, relays, clientSecretKeyHex } = session.config;

    setState("reconnecting_existing");
    setError(null);

    const pool = new SimplePool();
    cancelRef.current = {
      cancel: () => {
        try {
          pool.close(relays);
        } catch {
          // ignore
        }
      },
    };

    try {
      const clientSecretKey = parseSecretKeyHex(clientSecretKeyHex);
      const tryConnect = async () =>
        await connectNip46WithNostrConnectUri({
          uri,
          clientSecretKey,
          pool,
          timeoutMs: EXISTING_SESSION_RECONNECT_TIMEOUT_MS,
          relaysToCloseOnCancel: relays,
        });

      let pubkey: string;
      try {
        ({ pubkey } = await tryConnect());
      } catch (firstError) {
        // On mobile app switching, signer network state can still be warming up.
        // Retry once after a short delay before surfacing failure.
        await new Promise((resolve) =>
          setTimeout(resolve, EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS)
        );
        try {
          ({ pubkey } = await tryConnect());
        } catch {
          throw firstError;
        }
      }

      if (expectedPubkeyHex && pubkey !== expectedPubkeyHex) {
        setError(PROFILE_MISMATCH_MESSAGE);
        setState("failed");
        return;
      }

      const config: ActiveSignerConfig = {
        type: "nip46",
        method: "nostrconnect_uri",
        uri,
        relays,
        clientSecretKeyHex,
      };

      const detectedAppName = detectSignerAppName(config);
      updateSession(session.id, {
        metadata: {
          ...session.metadata,
          pubkey,
          signerAppName: detectedAppName,
          status: "active",
          connectedAt: Date.now(),
          lastActivityAt: Date.now(),
          lastError: null,
        },
      });

      recordConnectionEvent(session.id, {
        type: "connected",
        pubkey,
      });

      setActiveSignerConfig(config);
      setState("connected");
      toast.success("Remote signer reconnected.");
      onReconnectSuccess?.(session.id);
      onOpenChange(false);
    } catch {
      setState("idle");
      setError(
        "Could not reconnect with existing session. If the session is still in your signer app, switch to it, reactivate the session, then return here — we’ll retry automatically. Or generate a new connection string below."
      );
    } finally {
      cancelRef.current = null;
    }
  }, [expectedPubkeyHex, onReconnectSuccess, onOpenChange]);

  useEffect(() => {
    if (!open) {
      resetLocal();
      return;
    }

    // When dialog opens with an existing session, try reconnecting with stored config first.
    if (triedExistingRef.current) return;
    const session = getActiveSession();
    if (
      session?.config.type !== "nip46" ||
      session.config.method !== "nostrconnect_uri"
    ) {
      return;
    }

    triedExistingRef.current = true;
    void tryReconnectWithExistingSession();
  }, [open, resetLocal, tryReconnectWithExistingSession]);

  const copyUri = useCallback(async () => {
    if (!nostrConnectUri) return;
    try {
      await navigator.clipboard.writeText(nostrConnectUri);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1500);
    } catch {
      // ignore
    }
  }, [nostrConnectUri]);

  const handleLoginWithPrimal = useCallback(() => {
    if (!nostrConnectUri || typeof window === "undefined") return;
    window.location.href = appendPrimalCallback(nostrConnectUri);
  }, [nostrConnectUri]);

  const connect = useCallback(async () => {
    setError(null);
    setCopyOk(false);

    try {
      if (tab === "bunker") {
        setState("waiting");
        const clientSecretKey = generateSecretKey();
        const { pubkey } = await connectNip46WithBunkerInput({
          bunkerInput: bunkerInput.trim(),
          clientSecretKey,
          timeoutMs: 2 * 60 * 1000,
        });

        if (expectedPubkeyHex && pubkey !== expectedPubkeyHex) {
          setError(PROFILE_MISMATCH_MESSAGE);
          setState("failed");
          return;
        }

        const config: ActiveSignerConfig = {
          type: "nip46",
          method: "bunker_input",
          bunkerInput: bunkerInput.trim(),
          clientSecretKeyHex: serializeSecretKey(clientSecretKey),
        };

        // Create or update session
        const session = createSession(config, sessionLabel || undefined);
        setActiveSession(session.id);

        // Update session with pubkey and detected app name
        const detectedAppName = detectSignerAppName(config);
        updateSession(session.id, {
          metadata: {
            ...session.metadata,
            pubkey,
            signerAppName: detectedAppName,
            status: "active",
            connectedAt: Date.now(),
            lastActivityAt: Date.now(),
          },
        });

        // Record connection event
        recordConnectionEvent(session.id, {
          type: "connected",
          pubkey,
        });

        setActiveSignerConfig(config);
        setState("connected");
        toast.success(RECONNECT_SUCCESS_TOAST_RETRY);
        onReconnectSuccess?.(session.id);
        onOpenChange(false);
        return;
      }

      // nostrconnect
      const relays = parseRelayList(relayList);
      const created = createNip46NostrConnectUri({
        relays,
        appName: "SmartFlowSocial",
        ...getNostrConnectAppMetadata(),
      });

      setNostrConnectUri(created.uri);
      setState("waiting");
      setPendingReconnect(created.uri, created.clientSecretKey, created.relays);

      cancelRef.current = {
        cancel: () => {
          try {
            created.pool.close(created.relays);
          } catch {
            // ignore
          }
        },
      };

      const { pubkey } = await connectNip46WithNostrConnectUri({
        uri: created.uri,
        clientSecretKey: created.clientSecretKey,
        pool: created.pool,
        timeoutMs: 2 * 60 * 1000,
        relaysToCloseOnCancel: created.relays,
      });

      if (expectedPubkeyHex && pubkey !== expectedPubkeyHex) {
        setError(PROFILE_MISMATCH_MESSAGE);
        setState("failed");
        return;
      }

      const config: ActiveSignerConfig = {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: created.uri,
        relays: created.relays,
        clientSecretKeyHex: serializeSecretKey(created.clientSecretKey),
      };

      // Create or update session
      const session = createSession(config, sessionLabel || undefined);
      setActiveSession(session.id);

      // Update session with pubkey and detected app name
      const detectedAppName = detectSignerAppName(config);
      updateSession(session.id, {
        metadata: {
          ...session.metadata,
          pubkey,
          signerAppName: detectedAppName,
          status: "active",
          connectedAt: Date.now(),
          lastActivityAt: Date.now(),
        },
      });

      // Record connection event
      recordConnectionEvent(session.id, {
        type: "connected",
        pubkey,
      });

      setActiveSignerConfig(config);
      clearPendingReconnectStorage();
      setState("connected");
      toast.success(RECONNECT_SUCCESS_TOAST_RETRY);
      onReconnectSuccess?.(session.id);
      onOpenChange(false);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to reconnect signer";
      const msgLower = errorMessage.toLowerCase();
      const isConnectionError =
        msgLower.includes("subscription closed") ||
        msgLower.includes("websocket") ||
        msgLower.includes("connection");
      const hasPending = getPendingReconnect() !== null;

      if (isConnectionError && hasPending && state === "waiting") {
        return;
      }

      setError(errorMessage);
      setState("failed");

      const activeSession = getActiveSession();
      if (activeSession) {
        recordConnectionEvent(activeSession.id, {
          type: "error",
          error: errorMessage,
        });
      }
    } finally {
      cancelRef.current = null;
    }
  }, [
    bunkerInput,
    clearPendingReconnectStorage,
    getPendingReconnect,
    expectedPubkeyHex,
    onOpenChange,
    onReconnectSuccess,
    relayList,
    sessionLabel,
    setPendingReconnect,
    state,
    tab,
  ]);

  const resumeReconnectWithPendingUri = useCallback(async () => {
    const pending = getPendingReconnect();
    if (!pending) return;

    setError(null);
    setNostrConnectUri(pending.uri);
    setState("waiting");

    const pool = new SimplePool();
    cancelRef.current = {
      cancel: () => {
        try {
          pool.close(pending.relays);
        } catch {
          // ignore
        }
      },
    };

    try {
      const { pubkey } = await connectNip46WithNostrConnectUri({
        uri: pending.uri,
        clientSecretKey: pending.clientSecretKey,
        pool,
        timeoutMs: 60_000,
        relaysToCloseOnCancel: pending.relays,
      });

      if (expectedPubkeyHex && pubkey !== expectedPubkeyHex) {
        setError(PROFILE_MISMATCH_MESSAGE);
        setState("failed");
        return;
      }

      const config: ActiveSignerConfig = {
        type: "nip46",
        method: "nostrconnect_uri",
        uri: pending.uri,
        relays: pending.relays,
        clientSecretKeyHex: serializeSecretKey(pending.clientSecretKey),
      };

      const session = createSession(config, sessionLabel || undefined);
      setActiveSession(session.id);

      const detectedAppName = detectSignerAppName(config);
      updateSession(session.id, {
        metadata: {
          ...session.metadata,
          pubkey,
          signerAppName: detectedAppName,
          status: "active",
          connectedAt: Date.now(),
          lastActivityAt: Date.now(),
        },
      });

      recordConnectionEvent(session.id, {
        type: "connected",
        pubkey,
      });

      setActiveSignerConfig(config);
      clearPendingReconnectStorage();
      setState("connected");
      toast.success(RECONNECT_SUCCESS_TOAST_RETRY);
      onReconnectSuccess?.(session.id);
      onOpenChange(false);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to reconnect signer";
      const msgLower = errorMessage.toLowerCase();
      const isConnectionError =
        msgLower.includes("subscription closed") ||
        msgLower.includes("websocket") ||
        msgLower.includes("connection");
      const hasPending = getPendingReconnect() !== null;

      if (isConnectionError && hasPending && state === "waiting") {
        return;
      }

      setError(errorMessage);
      setState("failed");

      const activeSession = getActiveSession();
      if (activeSession) {
        recordConnectionEvent(activeSession.id, {
          type: "error",
          error: errorMessage,
        });
      }
    } finally {
      cancelRef.current = null;
    }
  }, [
    clearPendingReconnectStorage,
    getPendingReconnect,
    expectedPubkeyHex,
    onOpenChange,
    onReconnectSuccess,
    sessionLabel,
    state,
  ]);

  const resumeRef = useRef(resumeReconnectWithPendingUri);
  resumeRef.current = resumeReconnectWithPendingUri;

  useEffect(() => {
    if (!open) return;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;

      // User returned after generating new URI and approving in signer app — resume with same URI.
      if (state === "waiting" && getPendingReconnect()) {
        setTimeout(() => {
          if (getPendingReconnect()) {
            void resumeRef.current();
          }
        }, 500);
        return;
      }

      // User returned after reactivating existing session in signer app — retry reconnect with stored config.
      if (state === "idle" && triedExistingRef.current) {
        const session = getActiveSession();
        if (
          session?.config.type === "nip46" &&
          session.config.method === "nostrconnect_uri"
        ) {
          setTimeout(() => {
            void tryReconnectWithExistingSession();
          }, 500);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [open, tab, state, getPendingReconnect, tryReconnectWithExistingSession]);

  const canRetryExisting =
    state === "idle" &&
    error?.includes("Could not reconnect with existing session") &&
    (() => {
      const session = getActiveSession();
      return (
        session?.config.type === "nip46" &&
        session.config.method === "nostrconnect_uri"
      );
    })() &&
    !getPendingReconnect();

  const reconnectStartLabel = useMemo(() => {
    if (state === "reconnecting_existing") return "Reconnecting…";
    if (state === "waiting") return "Waiting for signer…";
    if (tab === "bunker") return "Connect";
    if (canRetryExisting) return "Try again with existing session";
    return nostrConnectUri ? "Retry" : "Generate & wait";
  }, [canRetryExisting, nostrConnectUri, state, tab]);

  const isReconnectingExisting = state === "reconnecting_existing";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reconnect remote signer</DialogTitle>
          <DialogDescription>
            If your signer app went inactive, reconnect it here (NIP-46).
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="border-destructive bg-destructive/10 text-destructive dark:border-destructive/60 dark:bg-destructive/10 dark:text-destructive rounded-md border p-3 text-sm">
            {error}
          </div>
        ) : null}

        {isReconnectingExisting ? (
          <div className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
            Reconnecting with existing session… No need to switch to your signer
            app.
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="session-label">Session Label (Optional)</Label>
            <Input
              id="session-label"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="e.g., Primal on iPhone"
              disabled={state === "waiting" || isReconnectingExisting}
            />
            <p className="text-muted-foreground text-xs">
              Give this session a name to identify it later
            </p>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="w-full">
            <TabsTrigger value="nostrconnect" className="flex-1">
              Generate nostrconnect URI
            </TabsTrigger>
            <TabsTrigger value="bunker" className="flex-1">
              Paste bunker input
            </TabsTrigger>
          </TabsList>

          <TabsContent value="nostrconnect" className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Relays</div>
              <textarea
                className="border-input bg-background focus-visible:ring-ring min-h-[88px] w-full rounded-md border p-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                value={relayList}
                onChange={(e) => setRelayList(e.target.value)}
                disabled={state === "waiting" || isReconnectingExisting}
              />
            </div>

            {nostrConnectUri ? (
              <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
                <div className="dark:bg-card/30 flex justify-center rounded-md border bg-white p-3">
                  <QRCode value={nostrConnectUri} size={176} />
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
                      onClick={() => void copyUri()}
                    >
                      {copyOk ? "Copied" : "Copy"}
                    </Button>
                    {isMobile() ? (
                      <Button type="button" onClick={handleLoginWithPrimal}>
                        Login with Primal
                      </Button>
                    ) : null}
                    <div className="text-muted-foreground text-xs">
                      Scan or paste into your signer app to approve.
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="bunker" className="space-y-3">
            <div className="space-y-1">
              <div className="text-sm font-medium">Bunker input</div>
              <Input
                value={bunkerInput}
                onChange={(e) => setBunkerInput(e.target.value)}
                placeholder="bunker://..."
                disabled={state === "waiting" || isReconnectingExisting}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              clearActiveSignerConfig();
              resetLocal();
            }}
            disabled={state === "waiting" || isReconnectingExisting}
          >
            Clear saved signer
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (canRetryExisting) {
                void tryReconnectWithExistingSession();
              } else if (tab === "nostrconnect" && getPendingReconnect()) {
                void resumeReconnectWithPendingUri();
              } else {
                void connect();
              }
            }}
            disabled={
              state === "waiting" ||
              isReconnectingExisting ||
              (tab === "bunker" && !bunkerInput.trim())
            }
          >
            {reconnectStartLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
