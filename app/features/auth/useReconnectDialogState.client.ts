import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import {
  clearActiveSignerConfig,
  getActiveConnection,
  getActiveSession,
  matchOrCreateSession,
  recordConnectionEvent,
  setActiveSession,
  setActiveSignerConfig,
  updateSession,
  detectSignerAppName,
  parseSecretKeyHex,
  serializeSecretKey,
} from "~/features/auth/signer";
import { convertToHex } from "~/lib/nostr-conversion";

import {
  connectWithBunker,
  connectWithNostrConnectUri,
  resumeWithPendingUri,
} from "./reconnect/reconnect-connect-actions.client";
import {
  getCanRetryExisting,
  getHandlePrimaryAction,
  getReconnectStartLabel,
} from "./reconnect/reconnect-dialog-derived.client";
import { useExistingReconnectFlow } from "./reconnect/useExistingReconnectFlow.client";
import { useReconnectVisibilityEffect } from "./reconnect/useReconnectVisibilityEffect.client";
import {
  DEFAULT_RELAYS,
  EXISTING_SESSION_RECONNECT_TIMEOUTS_MS,
  TOAST_RECONNECT_SUCCESS,
} from "./reconnect-dialog-utils.client";
import { useRemoteSignerHealthPolling } from "./reconnect-health.client";
import type { ReconnectState } from "./reconnect-state.client";
import {
  appendPrimalCallback,
  clearPendingReconnectStorage,
  getPendingReconnect,
} from "./reconnect-uri.client";

export interface UseReconnectDialogStateParams {
  open: boolean;
  openMode: "default" | "new_session";
  expectedPubkeyHex: string | null;
  onReconnectSuccess?: (connectionId: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function useReconnectDialogState({
  open,
  openMode,
  expectedPubkeyHex,
  onReconnectSuccess,
  onOpenChange,
}: UseReconnectDialogStateParams) {
  const [tab, setTab] = useState<"nostrconnect" | "bunker">("nostrconnect");
  const [relayList, setRelayList] = useState(DEFAULT_RELAYS);
  const [bunkerInput, setBunkerInput] = useState("");
  const [connectionLabel, setConnectionLabel] = useState("");

  const [state, setState] = useState<ReconnectState>("idle");
  const [existingReconnectAttempt, setExistingReconnectAttempt] = useState(0);
  const [nostrConnectUri, setNostrConnectUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  const cancelRef = useRef<{ cancel: () => void } | null>(null);
  const inFlightNostrConnectRef = useRef(false);
  const triedExistingRef = useRef(false);
  const closedByExternalReconnectRef = useRef(false);

  const existingFlow = useExistingReconnectFlow({
    expectedPubkeyHex,
    setState,
    setError,
    setExistingReconnectAttempt,
    onReconnectSuccess,
    onOpenChange,
    cancelRef,
    getClosedByExternalReconnect: () => closedByExternalReconnectRef.current,
  });

  const resetLocal = useCallback(() => {
    existingFlow.existingReconnectRunIdRef.current += 1;
    existingFlow.inFlightExistingReconnectRef.current = false;
    if (cancelRef.current) cancelRef.current.cancel();
    cancelRef.current = null;
    inFlightNostrConnectRef.current = false;
    triedExistingRef.current = false;
    existingFlow.wasHiddenDuringExistingReconnectRef.current = false;
    existingFlow.existingReconnectForegroundAttemptFailedRef.current = false;
    closedByExternalReconnectRef.current = false;
    clearPendingReconnectStorage();
    setState("idle");
    setNostrConnectUri(null);
    setError(null);
    setCopyOk(false);
    setConnectionLabel("");
    setExistingReconnectAttempt(0);
  }, [existingFlow]);

  const { onConnectionHealthy } = useRemoteSignerHealthPolling({
    subscribe: true,
  });
  useEffect(() => {
    if (!open) return;
    return onConnectionHealthy(() => {
      const active = getActiveConnection();
      if (!active?.metadata.pubkey) return;
      const activePubkeyHex =
        convertToHex(active.metadata.pubkey) ?? active.metadata.pubkey;
      if (
        expectedPubkeyHex &&
        activePubkeyHex.toLowerCase() !== expectedPubkeyHex.toLowerCase()
      ) {
        return;
      }
      closedByExternalReconnectRef.current = true;
      toast.success(TOAST_RECONNECT_SUCCESS);
      onReconnectSuccess?.(active.id);
      onOpenChange(false);
    });
  }, [
    open,
    expectedPubkeyHex,
    onReconnectSuccess,
    onOpenChange,
    onConnectionHealthy,
  ]);

  useEffect(() => {
    if (!open) {
      resetLocal();
      return;
    }
    if (openMode === "new_session") {
      triedExistingRef.current = true;
      if (tab !== "nostrconnect") setTab("nostrconnect");
      return;
    }
    if (triedExistingRef.current) return;
    const view = getActiveSession();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- view may be null
    const config = view?.connection?.config;
    if (config?.type !== "nip46") return;
    if (config.method === "nostrconnect_uri") {
      triedExistingRef.current = true;
      void existingFlow.tryReconnectWithExistingConnection("initial");
      return;
    }
    triedExistingRef.current = true;
    void existingFlow.tryReconnectWithExistingBunkerConnection("initial");
  }, [open, openMode, resetLocal, existingFlow, tab]);

  const resumeReconnectWithPendingUri = useCallback(async () => {
    if (getPendingReconnect() === null) return;
    if (inFlightNostrConnectRef.current) return;
    inFlightNostrConnectRef.current = true;
    try {
      await resumeWithPendingUri({
        connectionLabel,
        expectedPubkeyHex,
        getPendingReconnect,
        getActiveSession,
        setState,
        setError,
        setNostrConnectUri,
        setCancel: (fn) => {
          cancelRef.current = { cancel: fn };
        },
        currentState: state,
        matchOrCreateSession,
        setActiveSession,
        updateSession,
        recordConnectionEvent,
        setActiveSignerConfig,
        detectSignerAppName,
        serializeSecretKey,
        onReconnectSuccess,
        onOpenChange,
        toastSuccess: toast.success,
      });
    } finally {
      inFlightNostrConnectRef.current = false;
      cancelRef.current = null;
    }
  }, [
    connectionLabel,
    expectedPubkeyHex,
    state,
    onReconnectSuccess,
    onOpenChange,
  ]);

  const resumeRef = useRef(resumeReconnectWithPendingUri);
  resumeRef.current = resumeReconnectWithPendingUri;

  useReconnectVisibilityEffect({
    open,
    openMode,
    state,
    setState,
    setExistingReconnectAttempt,
    wasHiddenDuringExistingReconnectRef:
      existingFlow.wasHiddenDuringExistingReconnectRef,
    inFlightExistingReconnectRef: existingFlow.inFlightExistingReconnectRef,
    existingReconnectRunIdRef: existingFlow.existingReconnectRunIdRef,
    triedExistingRef,
    cancelRef,
    tryReconnectWithExistingConnection: (trigger) => {
      void existingFlow.tryReconnectWithExistingConnection(trigger);
    },
    tryReconnectWithExistingBunkerConnection: (trigger) => {
      void existingFlow.tryReconnectWithExistingBunkerConnection(trigger);
    },
    resumeReconnectWithPendingUriRef: resumeRef,
    inFlightNostrConnectRef,
  });

  const connect = useCallback(async () => {
    setError(null);
    setCopyOk(false);
    try {
      if (tab === "bunker") {
        await connectWithBunker({
          bunkerInput,
          connectionLabel,
          expectedPubkeyHex,
          getActiveSession,
          setState,
          setError,
          matchOrCreateSession,
          setActiveSession,
          updateSession,
          recordConnectionEvent,
          setActiveSignerConfig,
          detectSignerAppName,
          parseSecretKeyHex,
          serializeSecretKey,
          onReconnectSuccess,
          onOpenChange,
          toastSuccess: toast.success,
        });
        return;
      }
      if (inFlightNostrConnectRef.current) return;
      inFlightNostrConnectRef.current = true;
      await connectWithNostrConnectUri({
        relayList,
        connectionLabel,
        expectedPubkeyHex,
        getActiveSession,
        setState,
        setError,
        setNostrConnectUri,
        setCancel: (fn) => {
          cancelRef.current = { cancel: fn };
        },
        currentState: state,
        matchOrCreateSession,
        setActiveSession,
        updateSession,
        recordConnectionEvent,
        setActiveSignerConfig,
        detectSignerAppName,
        serializeSecretKey,
        onReconnectSuccess,
        onOpenChange,
        toastSuccess: toast.success,
      });
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to reconnect signer";
      const msgLower = errorMessage.toLowerCase();
      const isConnectionError =
        msgLower.includes("subscription closed") ||
        msgLower.includes("websocket") ||
        msgLower.includes("connection");
      const hasPending = getPendingReconnect() !== null;
      if (isConnectionError && hasPending && state === "waiting") return;
      setError(errorMessage);
      setState("failed");
      const activeView = getActiveSession();
      if (activeView) {
        recordConnectionEvent(activeView.connection.id, {
          type: "error",
          error: errorMessage,
        });
      }
    } finally {
      inFlightNostrConnectRef.current = false;
      cancelRef.current = null;
    }
  }, [
    tab,
    bunkerInput,
    relayList,
    connectionLabel,
    expectedPubkeyHex,
    state,
    onReconnectSuccess,
    onOpenChange,
  ]);

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

  const canRetryExisting = useMemo(
    () =>
      getCanRetryExisting(state, error, getActiveSession, getPendingReconnect),
    [state, error]
  );

  const reconnectStartLabel = useMemo(
    () => getReconnectStartLabel(state, tab, canRetryExisting, nostrConnectUri),
    [state, tab, canRetryExisting, nostrConnectUri]
  );

  const handlePrimaryAction = useMemo(
    () =>
      getHandlePrimaryAction(
        canRetryExisting,
        tab,
        getPendingReconnect,
        getActiveSession,
        (trigger) => {
          void existingFlow.tryReconnectWithExistingConnection(trigger);
        },
        (trigger) => {
          void existingFlow.tryReconnectWithExistingBunkerConnection(trigger);
        },
        () => {
          void resumeReconnectWithPendingUri();
        },
        () => {
          void connect();
        }
      ),
    [
      canRetryExisting,
      tab,
      existingFlow,
      resumeReconnectWithPendingUri,
      connect,
    ]
  );

  const clearSavedSigner = useCallback(() => {
    if (cancelRef.current) cancelRef.current.cancel();
    cancelRef.current = null;
    clearActiveSignerConfig();
    resetLocal();
  }, [resetLocal]);

  return {
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
    resetLocal,
    copyUri,
    handleLoginWithPrimal,
    connect,
    tryReconnectWithExistingConnection:
      existingFlow.tryReconnectWithExistingConnection,
    tryReconnectWithExistingBunkerConnection:
      existingFlow.tryReconnectWithExistingBunkerConnection,
    resumeReconnectWithPendingUri,
    clearSavedSigner,
    handlePrimaryAction,
    canRetryExisting,
    reconnectStartLabel,
    isReconnectingExisting: state === "reconnecting_existing",
    cancelRef,
    EXISTING_SESSION_RECONNECT_TIMEOUTS_MS,
  };
}
