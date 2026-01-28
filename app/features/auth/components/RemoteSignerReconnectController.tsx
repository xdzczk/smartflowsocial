import { generateSecretKey } from "nostr-tools";
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
import {
  clearActiveSignerConfig,
  serializeSecretKey,
  setActiveSignerConfig,
  type ActiveSignerConfig,
} from "~/lib/nostr-signer-manager.client";
import { useOptionalUser } from "~/lib/remix-utils";
import {
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
  parseRelayList,
} from "../nostr-signer.client";

const DEFAULT_RELAYS = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
].join("\n");

type ConnectState = "idle" | "uri_ready" | "waiting" | "connected" | "failed";

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
    window.addEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handler);
    return () => {
      window.removeEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handler);
    };
  }, [showReconnectToast]);

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
  const [tab, setTab] = useState<"nostrconnect" | "bunker">("nostrconnect");
  const [relayList, setRelayList] = useState(DEFAULT_RELAYS);
  const [bunkerInput, setBunkerInput] = useState("");
  const [sessionLabel, setSessionLabel] = useState("");

  const [state, setState] = useState<ConnectState>("idle");
  const [nostrConnectUri, setNostrConnectUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const cancelRef = useRef<{ cancel: () => void } | null>(null);

  const resetLocal = useCallback(() => {
    cancelRef.current?.cancel();
    cancelRef.current = null;
    setState("idle");
    setNostrConnectUri(null);
    setError(null);
    setCopyOk(false);
    setSessionLabel("");
  }, []);

  useEffect(() => {
    if (!props.open) {
      resetLocal();
    }
  }, [props.open, resetLocal]);

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

        if (props.expectedPubkey && pubkey !== props.expectedPubkey) {
          setError(
            "Different signer profile detected. Please activate the same identity as your SmartFlow session."
          );
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
        toast.success("Remote signer reconnected. Please retry your action.");
        props.onReconnectSuccess?.(session.id);
        props.onOpenChange(false);
        return;
      }

      // nostrconnect
      const relays = parseRelayList(relayList);
      const created = createNip46NostrConnectUri({
        relays,
        appName: "SmartFlowSocial",
      });

      setNostrConnectUri(created.uri);
      setState("waiting");

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

      if (props.expectedPubkey && pubkey !== props.expectedPubkey) {
        setError(
          "Different signer profile detected. Please activate the same identity as your SmartFlow session."
        );
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
      setState("connected");
      toast.success("Remote signer reconnected. Please retry your action.");
      props.onReconnectSuccess?.(session.id);
      props.onOpenChange(false);
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to reconnect signer";
      setError(errorMessage);
      setState("failed");

      // Record error if we have an active session
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
  }, [bunkerInput, props, relayList, sessionLabel, tab]);

  const reconnectStartLabel = useMemo(() => {
    if (state === "waiting") return "Waiting for signer…";
    if (tab === "bunker") return "Connect";
    return nostrConnectUri ? "Retry" : "Generate & wait";
  }, [nostrConnectUri, state, tab]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl">
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

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="session-label">Session Label (Optional)</Label>
            <Input
              id="session-label"
              value={sessionLabel}
              onChange={(e) => setSessionLabel(e.target.value)}
              placeholder="e.g., Primal on iPhone"
              disabled={state === "waiting"}
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
                disabled={state === "waiting"}
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
                disabled={state === "waiting"}
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
            disabled={state === "waiting"}
          >
            Clear saved signer
          </Button>
          <Button
            type="button"
            onClick={() => void connect()}
            disabled={
              state === "waiting" || (tab === "bunker" && !bunkerInput.trim())
            }
          >
            {reconnectStartLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
