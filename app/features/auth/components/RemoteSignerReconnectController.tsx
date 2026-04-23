import { useCallback, useEffect, useState } from "react";

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
  OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
  type ReconnectDialogOpenMode,
} from "~/features/auth/signer";
import { BRAND_NAME } from "~/lib/brand";
import { convertToHex } from "~/lib/nostr-conversion";
import { useOptionalUser } from "~/lib/remix-utils";

import { useReconnectDialogState } from "../useReconnectDialogState.client";

import { ReconnectBunkerTab } from "./ReconnectBunkerTab";
import { ReconnectNostrConnectTab } from "./ReconnectNostrConnectTab";

interface RemoteSignerReconnectControllerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onReconnectSuccess?: (connectionId: string) => void;
}

export function RemoteSignerReconnectController(
  props?: RemoteSignerReconnectControllerProps
) {
  const user = useOptionalUser();
  const expectedPubkey = user?.npub ?? null;

  const [dialogOpen, setDialogOpen] = useState(props?.open ?? false);
  const [openMode, setOpenMode] = useState<ReconnectDialogOpenMode>("default");

  const openDialog = useCallback(
    (mode: ReconnectDialogOpenMode = "default") => {
      setOpenMode(mode);
      setDialogOpen(true);
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const openHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: ReconnectDialogOpenMode }>)
        .detail;
      openDialog(detail.mode ?? "default");
    };
    window.addEventListener(
      OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
      openHandler
    );
    return () => {
      window.removeEventListener(
        OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
        openHandler
      );
    };
  }, [openDialog]);

  const handleOpenChange = (open: boolean) => {
    setDialogOpen(open);
    props?.onOpenChange?.(open);
  };

  // Avoid rendering the dialog (and its client-only hooks) during SSR.
  // useReconnectDialogState/useRemoteSignerHealthPolling are from .client modules
  // and are not available in the server bundle.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // Intentional: client-only mount gate to avoid calling .client hooks during SSR
    // eslint-disable-next-line react-hooks/set-state-in-effect -- required for SSR-safe client-only render
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <RemoteSignerReconnectDialog
      open={props?.open ?? dialogOpen}
      onOpenChange={handleOpenChange}
      expectedPubkey={expectedPubkey}
      openMode={openMode}
      onReconnectSuccess={props?.onReconnectSuccess}
    />
  );
}

export function RemoteSignerReconnectDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedPubkey: string | null;
  openMode?: ReconnectDialogOpenMode;
  onReconnectSuccess?: (connectionId: string) => void;
}) {
  const {
    open,
    onOpenChange,
    expectedPubkey,
    openMode = "default",
    onReconnectSuccess,
  } = props;
  const isAddFlow = openMode === "new_session";

  const expectedPubkeyHex = (() => {
    if (!expectedPubkey) return null;
    return convertToHex(expectedPubkey) ?? expectedPubkey;
  })();

  const {
    state,
    tab,
    setTab,
    relayList,
    setRelayList,
    bunkerInput,
    setBunkerInput,
    connectionLabel,
    setConnectionLabel,
    error,
    nostrConnectUri,
    copyOk,
    existingReconnectAttempt,
    copyUri,
    handleLoginWithPrimal,
    handleLoginWithAmber,
    isReconnectingExisting,
    clearSavedSigner,
    handlePrimaryAction,
    reconnectStartLabel,
    EXISTING_SESSION_RECONNECT_TIMEOUTS_MS,
  } = useReconnectDialogState({
    open,
    openMode,
    expectedPubkeyHex,
    onReconnectSuccess,
    onOpenChange,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isAddFlow ? "Add remote signer" : "Reconnect remote signer"}
          </DialogTitle>
          <DialogDescription>
            {isAddFlow
              ? `Add a remote signer so ${BRAND_NAME} can publish and sign with your approval—your key stays in your signer app.`
              : "If your signer app went inactive or the connection dropped, restore it here. Uses Nostr Connect (NIP-46) under the hood."}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="border-danger bg-danger/10 text-danger dark:border-danger/60 dark:bg-danger/10 dark:text-danger rounded-md border p-3 text-sm">
            {error}
          </div>
        ) : null}

        {isReconnectingExisting ? (
          <div className="text-text-secondary rounded-md border border-dashed p-4 text-center text-sm">
            Start a new session in your signer app (e.g. Primal) first, then
            we’ll connect. Reconnecting (attempt{" "}
            {Math.max(existingReconnectAttempt, 1)}/
            {EXISTING_SESSION_RECONNECT_TIMEOUTS_MS.length})…
          </div>
        ) : null}

        <div className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Session info</h3>
            <div className="space-y-1">
              <Label htmlFor="session-label">Session label</Label>
              <Input
                id="session-label"
                value={connectionLabel}
                onChange={(e) => setConnectionLabel(e.target.value)}
                placeholder="e.g., Primal on iPhone"
                disabled={state === "waiting" || isReconnectingExisting}
              />
              <p className="text-text-secondary text-xs">
                Give this signer session a label so you can identify it later.
                Optional.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Connection method</h3>
            <p className="text-text-secondary text-xs">
              Nostr Connect (NIP-46) links your {BRAND_NAME} session to a signer
              app—pick how you want to provide the connection.
            </p>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="w-full">
                <TabsTrigger value="nostrconnect" className="flex-1">
                  Generate connection link
                </TabsTrigger>
                <TabsTrigger value="bunker" className="flex-1">
                  Paste signer connection
                </TabsTrigger>
              </TabsList>

              <TabsContent value="nostrconnect" className="space-y-4 pt-3">
                <ReconnectNostrConnectTab
                  relayList={relayList}
                  onRelayListChange={setRelayList}
                  nostrConnectUri={nostrConnectUri}
                  onCopyUri={() => void copyUri()}
                  copyOk={copyOk}
                  onLoginWithPrimal={handleLoginWithPrimal}
                  onLoginWithAmber={handleLoginWithAmber}
                  disabled={state === "waiting" || isReconnectingExisting}
                />
              </TabsContent>

              <TabsContent value="bunker" className="space-y-3 pt-3">
                <ReconnectBunkerTab
                  bunkerInput={bunkerInput}
                  onBunkerInputChange={setBunkerInput}
                  disabled={state === "waiting" || isReconnectingExisting}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        <div className="border-border/60 stack-tight mt-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          {isAddFlow ? (
            <Button
              type="button"
              variant="outline"
              className="sm:mr-auto"
              onClick={() => onOpenChange(false)}
              disabled={state === "waiting"}
            >
              Cancel
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="text-text-secondary sm:mr-auto"
              onClick={clearSavedSigner}
              disabled={state === "waiting"}
            >
              Clear saved signer
            </Button>
          )}
          <Button
            type="button"
            className="sm:ml-auto"
            onClick={handlePrimaryAction}
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
