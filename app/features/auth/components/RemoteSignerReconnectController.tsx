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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  clearActiveSignerConfig,
  serializeSecretKey,
  setActiveSignerConfig,
} from "~/lib/nostr-signer-manager.client";
import { useOptionalUser } from "~/lib/remix-utils";
import {
  REMOTE_SIGNER_TIMEOUT_EVENT,
  type RemoteSignerTimeoutEventDetail,
} from "~/lib/remote-signer-reconnect.client";

import {
  connectNip46WithBunkerInput,
  connectNip46WithNostrConnectUri,
  createNip46NostrConnectUri,
  parseRelayList,
} from "../nostr-signer.client";

const DEFAULT_RELAYS = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://relay.nostr.band",
].join("\n");

type ConnectState = "idle" | "uri_ready" | "waiting" | "connected" | "failed";

export function RemoteSignerReconnectController() {
  const user = useOptionalUser();
  const expectedPubkey = user?.npub ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);

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

  return (
    <RemoteSignerReconnectDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      expectedPubkey={expectedPubkey}
    />
  );
}

function RemoteSignerReconnectDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedPubkey: string | null;
}) {
  const [tab, setTab] = useState<"nostrconnect" | "bunker">("nostrconnect");
  const [relayList, setRelayList] = useState(DEFAULT_RELAYS);
  const [bunkerInput, setBunkerInput] = useState("");

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

        setActiveSignerConfig({
          type: "nip46",
          method: "bunker_input",
          bunkerInput: bunkerInput.trim(),
          clientSecretKeyHex: serializeSecretKey(clientSecretKey),
        });
        setState("connected");
        toast.success("Remote signer reconnected. Please retry your action.");
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

      setActiveSignerConfig({
        type: "nip46",
        method: "nostrconnect_uri",
        uri: created.uri,
        relays: created.relays,
        clientSecretKeyHex: serializeSecretKey(created.clientSecretKey),
      });

      setState("connected");
      toast.success("Remote signer reconnected. Please retry your action.");
      props.onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reconnect signer");
      setState("failed");
    } finally {
      cancelRef.current = null;
    }
  }, [bunkerInput, props, relayList, tab]);

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
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        ) : null}

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
