import { generateSecretKey, SimplePool } from "nostr-tools";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import {
  clearActiveSignerConfig,
  detectSignerAppName,
  getActiveConnection,
  getActiveSigner,
  getActiveSession,
  matchOrCreateSession,
  parseSecretKeyHex,
  recordConnectionEvent,
  serializeSecretKey,
  setActiveSession,
  setActiveSignerConfig,
  syncRelaysWithRemoteSigner,
  tryBackgroundReconnect,
  updateSession,
  type ActiveSignerConfig,
} from "~/features/auth/signer";
import { convertToHex } from "~/lib/nostr-conversion";

import {
  connectNip46WithBunkerInput,
  connectNip46WithNostrConnectUri,
} from "./nostr-signer.client";
import { runExistingBunkerReconnect } from "./reconnect/reconnect-existing-bunker.client";
import { handleExistingReconnectFailure as handleExistingReconnectFailureImpl } from "./reconnect/reconnect-existing-failure.client";
import { runExistingNostrConnectReconnect } from "./reconnect/reconnect-existing-nostrconnect.client";
import {
  DEFAULT_RELAYS,
  debugReconnectTrace,
  EXISTING_SESSION_RECONNECT_TIMEOUTS_MS,
  METHOD_BUNKER_INPUT,
  PROFILE_MISMATCH_MESSAGE,
  RECONNECT_SUCCESS_TOAST_RETRY,
  TOAST_RECONNECT_SUCCESS,
} from "./reconnect-dialog-utils.client";
import { useRemoteSignerHealthPolling } from "./reconnect-health.client";
import {
  shouldCancelExistingReconnectOnHidden,
  shouldResumeExistingReconnectOnVisible,
  type ExistingReconnectTrigger,
} from "./reconnect-lifecycle.client";
import type { ReconnectState } from "./reconnect-state.client";
import {
  appendPrimalCallback,
  bunkerCanonicalKey,
  clearPendingReconnectStorage,
  createNip46NostrConnectUri,
  getPendingReconnect,
  parseBunkerInput,
  parseRelayList,
  setPendingReconnect,
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
  const inFlightExistingReconnectRef = useRef(false);
  const existingReconnectRunIdRef = useRef(0);
  const triedExistingRef = useRef(false);
  const wasHiddenDuringExistingReconnectRef = useRef(false);
  const existingReconnectForegroundAttemptFailedRef = useRef(false);
  const closedByExternalReconnectRef = useRef(false);

  const { onConnectionHealthy } = useRemoteSignerHealthPolling({
    subscribe: true,
  });

  const resetLocal = useCallback(() => {
    existingReconnectRunIdRef.current += 1;
    inFlightExistingReconnectRef.current = false;
    cancelRef.current?.cancel();
    cancelRef.current = null;
    inFlightNostrConnectRef.current = false;
    triedExistingRef.current = false;
    wasHiddenDuringExistingReconnectRef.current = false;
    existingReconnectForegroundAttemptFailedRef.current = false;
    closedByExternalReconnectRef.current = false;
    clearPendingReconnectStorage();
    setState("idle");
    setNostrConnectUri(null);
    setError(null);
    setCopyOk(false);
    setConnectionLabel("");
    setExistingReconnectAttempt(0);
  }, []);

  const syncRelaysAfterReconnect = useCallback(async () => {
    try {
      const signer = await getActiveSigner();
      if (signer?.type !== "nip46") return;
      const result = await syncRelaysWithRemoteSigner(signer);
      debugReconnectTrace("Relay sync after reconnect", {
        changed: result.changed,
        relayCount: result.relays?.length ?? null,
        reason: result.reason ?? null,
      });
    } catch (err) {
      debugReconnectTrace("Relay sync after reconnect failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const handleExistingReconnectFailure = useCallback(
    async (input: {
      error: unknown;
      runId: number;
      trigger: ExistingReconnectTrigger;
    }) => {
      await handleExistingReconnectFailureImpl({
        ...input,
        getCurrentRunId: () => existingReconnectRunIdRef.current,
        getClosedByExternalReconnect: () =>
          closedByExternalReconnectRef.current,
        getWasHiddenDuringExistingReconnect: () =>
          wasHiddenDuringExistingReconnectRef.current,
        getForegroundResumeAttemptFailed: () =>
          existingReconnectForegroundAttemptFailedRef.current,
        setState,
        setError,
        setExistingReconnectAttempt,
        setForegroundResumeAttemptFailed: (v) => {
          existingReconnectForegroundAttemptFailedRef.current = v;
        },
        syncRelaysAfterReconnect,
        expectedPubkeyHex,
        onReconnectSuccess,
        onOpenChange,
        toastSuccess: toast.success,
        debugTrace: debugReconnectTrace,
      });
    },
    [
      expectedPubkeyHex,
      onOpenChange,
      onReconnectSuccess,
      syncRelaysAfterReconnect,
    ]
  );

  const tryReconnectWithExistingConnection = useCallback(
    async (trigger: ExistingReconnectTrigger = "initial") => {
      if (inFlightExistingReconnectRef.current) {
        return;
      }
      const connectionView = getActiveSession();
      if (
        connectionView?.config.type !== "nip46" ||
        connectionView.config.method !== "nostrconnect_uri"
      ) {
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("You're offline. Check your connection and try again.");
        setState("failed");
        return;
      }
      inFlightExistingReconnectRef.current = true;
      const runId = ++existingReconnectRunIdRef.current;
      if (trigger === "foreground_resume") {
        wasHiddenDuringExistingReconnectRef.current = false;
      }

      setState("reconnecting_existing");
      setError(null);

      try {
        await runExistingNostrConnectReconnect({
          connectionView,
          expectedPubkeyHex,
          trigger,
          runId,
          getIsRunStale: () => existingReconnectRunIdRef.current !== runId,
          setCancel: (fn) => {
            cancelRef.current = { cancel: fn };
          },
          setState,
          setError,
          setExistingReconnectAttempt,
          syncRelaysAfterReconnect,
          onSuccess: (connectionId) => {
            toast.success(TOAST_RECONNECT_SUCCESS);
            onReconnectSuccess?.(connectionId);
            onOpenChange(false);
          },
        });
      } catch (err) {
        await handleExistingReconnectFailure({ error: err, runId, trigger });
      } finally {
        if (existingReconnectRunIdRef.current === runId) {
          inFlightExistingReconnectRef.current = false;
        }
        cancelRef.current?.cancel();
        cancelRef.current = null;
      }
    },
    [
      handleExistingReconnectFailure,
      expectedPubkeyHex,
      onReconnectSuccess,
      onOpenChange,
      syncRelaysAfterReconnect,
    ]
  );

  const tryReconnectWithExistingBunkerConnection = useCallback(
    async (trigger: ExistingReconnectTrigger = "initial") => {
      if (inFlightExistingReconnectRef.current) return;
      const connectionView = getActiveSession();
      if (
        connectionView?.config.type !== "nip46" ||
        connectionView.config.method !== "bunker_input"
      ) {
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("You're offline. Check your connection and try again.");
        setState("failed");
        return;
      }
      inFlightExistingReconnectRef.current = true;
      const runId = ++existingReconnectRunIdRef.current;
      if (trigger === "foreground_resume") {
        wasHiddenDuringExistingReconnectRef.current = false;
      }

      setState("reconnecting_existing");
      setError(null);

      try {
        await runExistingBunkerReconnect({
          connectionView,
          expectedPubkeyHex,
          trigger,
          runId,
          getIsRunStale: () => existingReconnectRunIdRef.current !== runId,
          setCancel: (fn) => {
            cancelRef.current = { cancel: fn };
          },
          setState,
          setError,
          setExistingReconnectAttempt,
          syncRelaysAfterReconnect,
          onSuccess: (connectionId) => {
            toast.success(TOAST_RECONNECT_SUCCESS);
            onReconnectSuccess?.(connectionId);
            onOpenChange(false);
          },
        });
      } catch (err) {
        await handleExistingReconnectFailure({ error: err, runId, trigger });
      } finally {
        if (existingReconnectRunIdRef.current === runId) {
          inFlightExistingReconnectRef.current = false;
        }
        cancelRef.current?.cancel();
        cancelRef.current = null;
      }
    },
    [
      handleExistingReconnectFailure,
      expectedPubkeyHex,
      onReconnectSuccess,
      onOpenChange,
      syncRelaysAfterReconnect,
    ]
  );

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

  // When user reconnects in the signer app (new session within existing connection),
  // poll tryBackgroundReconnect so we establish a fresh signer, dispatch healthy, and auto-close.
  const RECONNECT_POLL_MS = 12_000;
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      void tryBackgroundReconnect();
    }, RECONNECT_POLL_MS);
    return () => clearInterval(id);
  }, [open]);

  // When user returns to the app (e.g. from signer app), try reconnect once so modal can close.
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void tryBackgroundReconnect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [open]);

  useEffect(() => {
    if (!open) {
      resetLocal();
      return;
    }

    if (openMode === "new_session") {
      triedExistingRef.current = true;
      if (tab !== "nostrconnect") {
        setTab("nostrconnect");
      }
      return;
    }

    if (triedExistingRef.current) return;
    const connectionView = getActiveSession();
    if (connectionView?.config.type !== "nip46") return;
    if (connectionView.config.method === "nostrconnect_uri") {
      triedExistingRef.current = true;
      void tryReconnectWithExistingConnection("initial");
      return;
    }
    triedExistingRef.current = true;
    void tryReconnectWithExistingBunkerConnection("initial");
  }, [
    open,
    openMode,
    resetLocal,
    tryReconnectWithExistingConnection,
    tryReconnectWithExistingBunkerConnection,
    tab,
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

  const connect = useCallback(async () => {
    setError(null);
    setCopyOk(false);

    try {
      if (tab === "bunker") {
        setState("waiting");
        const trimmedBunker = bunkerInput.trim();
        const activeConnectionForBunker = getActiveSession();
        const bunkerConfig =
          activeConnectionForBunker?.config.type === "nip46" &&
          activeConnectionForBunker.config.method === "bunker_input"
            ? activeConnectionForBunker.config
            : null;
        let isReconnectExisting = false;
        let reconnectBunkerConfig: typeof bunkerConfig = null;
        if (bunkerConfig) {
          const storedBp = await parseBunkerInput(bunkerConfig.bunkerInput);
          const pastedBp = await parseBunkerInput(trimmedBunker);
          if (
            storedBp &&
            pastedBp &&
            bunkerCanonicalKey(storedBp) === bunkerCanonicalKey(pastedBp)
          ) {
            isReconnectExisting = true;
            reconnectBunkerConfig = bunkerConfig;
          }
        }
        const clientSecretKey =
          isReconnectExisting && reconnectBunkerConfig
            ? parseSecretKeyHex(reconnectBunkerConfig.clientSecretKeyHex)
            : generateSecretKey();
        const { pubkey } = await connectNip46WithBunkerInput({
          bunkerInput: trimmedBunker,
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
          bunkerInput: trimmedBunker,
          clientSecretKeyHex:
            isReconnectExisting && reconnectBunkerConfig
              ? reconnectBunkerConfig.clientSecretKeyHex
              : serializeSecretKey(clientSecretKey),
        };

        const connectionView = matchOrCreateSession(config, {
          label: connectionLabel || undefined,
          signerPubkey: pubkey,
        });
        setActiveSession(connectionView.id);

        const detectedAppName = detectSignerAppName(config);
        updateSession(connectionView.id, {
          metadata: {
            ...connectionView.metadata,
            pubkey,
            signerAppName: detectedAppName,
            status: "active",
            connectedAt: Date.now(),
            lastActivityAt: Date.now(),
          },
        });

        recordConnectionEvent(connectionView.id, {
          type: "connected",
          pubkey,
        });

        setActiveSignerConfig(config);
        await syncRelaysAfterReconnect();
        setState("connected");
        toast.success(RECONNECT_SUCCESS_TOAST_RETRY);
        onReconnectSuccess?.(connectionView.id);
        onOpenChange(false);
        return;
      }

      if (inFlightNostrConnectRef.current) {
        return;
      }
      inFlightNostrConnectRef.current = true;
      const relays = parseRelayList(relayList);
      const created = createNip46NostrConnectUri(relays);

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

      const connectionView = matchOrCreateSession(config, {
        label: connectionLabel || undefined,
        signerPubkey: pubkey,
      });
      setActiveSession(connectionView.id);

      const detectedAppName = detectSignerAppName(config);
      updateSession(connectionView.id, {
        metadata: {
          ...connectionView.metadata,
          pubkey,
          signerAppName: detectedAppName,
          status: "active",
          connectedAt: Date.now(),
          lastActivityAt: Date.now(),
        },
      });

      recordConnectionEvent(connectionView.id, {
        type: "connected",
        pubkey,
      });

      setActiveSignerConfig(config);
      await syncRelaysAfterReconnect();
      clearPendingReconnectStorage();
      setState("connected");
      toast.success(RECONNECT_SUCCESS_TOAST_RETRY);
      onReconnectSuccess?.(connectionView.id);
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

      const activeConnectionView = getActiveSession();
      if (activeConnectionView) {
        recordConnectionEvent(activeConnectionView.id, {
          type: "error",
          error: errorMessage,
        });
      }
    } finally {
      inFlightNostrConnectRef.current = false;
      cancelRef.current = null;
    }
  }, [
    bunkerInput,
    expectedPubkeyHex,
    onOpenChange,
    onReconnectSuccess,
    relayList,
    connectionLabel,
    syncRelaysAfterReconnect,
    state,
    tab,
  ]);

  const resumeReconnectWithPendingUri = useCallback(async () => {
    const pending = getPendingReconnect();
    if (!pending) return;
    if (inFlightNostrConnectRef.current) return;
    inFlightNostrConnectRef.current = true;

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

      const connectionView = matchOrCreateSession(config, {
        label: connectionLabel || undefined,
        signerPubkey: pubkey,
      });
      setActiveSession(connectionView.id);

      const detectedAppName = detectSignerAppName(config);
      updateSession(connectionView.id, {
        metadata: {
          ...connectionView.metadata,
          pubkey,
          signerAppName: detectedAppName,
          status: "active",
          connectedAt: Date.now(),
          lastActivityAt: Date.now(),
        },
      });

      recordConnectionEvent(connectionView.id, {
        type: "connected",
        pubkey,
      });

      setActiveSignerConfig(config);
      await syncRelaysAfterReconnect();
      clearPendingReconnectStorage();
      setState("connected");
      toast.success(RECONNECT_SUCCESS_TOAST_RETRY);
      onReconnectSuccess?.(connectionView.id);
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

      const activeConnectionView = getActiveSession();
      if (activeConnectionView) {
        recordConnectionEvent(activeConnectionView.id, {
          type: "error",
          error: errorMessage,
        });
      }
    } finally {
      inFlightNostrConnectRef.current = false;
      cancelRef.current = null;
    }
  }, [
    expectedPubkeyHex,
    onOpenChange,
    onReconnectSuccess,
    connectionLabel,
    syncRelaysAfterReconnect,
    state,
  ]);

  const resumeRef = useRef(resumeReconnectWithPendingUri);
  resumeRef.current = resumeReconnectWithPendingUri;

  useEffect(() => {
    if (!open) return;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        if (shouldCancelExistingReconnectOnHidden(state)) {
          wasHiddenDuringExistingReconnectRef.current = true;
          existingReconnectRunIdRef.current += 1;
          inFlightExistingReconnectRef.current = false;
          cancelRef.current?.cancel();
          cancelRef.current = null;
          setState("idle");
          setExistingReconnectAttempt(0);
          debugReconnectTrace(
            "Visibility hidden: cancelled in-flight existing-connection reconnect"
          );
        }
        return;
      }

      const activeConnectionView = getActiveSession();
      const hasValidExistingConnection =
        activeConnectionView?.config.type === "nip46" &&
        (activeConnectionView.config.method === "nostrconnect_uri" ||
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- method union; both branches needed for type narrowing
          activeConnectionView.config.method === METHOD_BUNKER_INPUT);
      if (
        shouldResumeExistingReconnectOnVisible({
          openMode,
          wasHiddenDuringExistingReconnect:
            wasHiddenDuringExistingReconnectRef.current,
          inFlightExistingReconnect: inFlightExistingReconnectRef.current,
          hasValidExistingSession: hasValidExistingConnection,
        })
      ) {
        setTimeout(() => {
          const method =
            activeConnectionView?.config.type === "nip46"
              ? activeConnectionView.config.method
              : undefined;

          if (method === METHOD_BUNKER_INPUT) {
            void tryReconnectWithExistingBunkerConnection("foreground_resume");
          } else {
            void tryReconnectWithExistingConnection("foreground_resume");
          }
        }, 500);
        return;
      }

      if (state === "waiting" && getPendingReconnect()) {
        if (inFlightNostrConnectRef.current) {
          cancelRef.current?.cancel();
          cancelRef.current = null;
          inFlightNostrConnectRef.current = false;
          debugReconnectTrace(
            "Visibility return: cancelled stale in-flight connect before resume"
          );
        }
        setTimeout(() => {
          if (getPendingReconnect()) {
            void resumeRef.current();
          }
        }, 500);
        return;
      }

      if (
        openMode !== "new_session" &&
        state === "idle" &&
        triedExistingRef.current
      ) {
        const connectionView = getActiveSession();
        const method =
          connectionView?.config.type === "nip46" &&
          "method" in connectionView.config
            ? connectionView.config.method
            : undefined;

        if (method === METHOD_BUNKER_INPUT) {
          setTimeout(() => {
            void tryReconnectWithExistingBunkerConnection("foreground_resume");
          }, 500);
        } else if (connectionView?.config.type === "nip46") {
          setTimeout(() => {
            void tryReconnectWithExistingConnection("foreground_resume");
          }, 500);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [
    open,
    openMode,
    tab,
    state,
    tryReconnectWithExistingConnection,
    tryReconnectWithExistingBunkerConnection,
  ]);

  const canRetryExisting =
    state === "idle" &&
    error?.includes("Could not reconnect with existing connection") &&
    (() => {
      const connectionView = getActiveSession();
      return (
        connectionView?.config.type === "nip46" &&
        (connectionView.config.method === "nostrconnect_uri" ||
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- method union; both branches needed
          connectionView.config.method === METHOD_BUNKER_INPUT)
      );
    })() &&
    !getPendingReconnect();

  const reconnectStartLabel = useMemo(() => {
    if (state === "reconnecting_existing") return "Reconnecting…";
    if (state === "waiting") return "Waiting for signer…";
    if (tab === "bunker") return "Connect";
    if (canRetryExisting) return "Try again with existing connection";
    return nostrConnectUri ? "Retry" : "Generate & wait";
  }, [canRetryExisting, nostrConnectUri, state, tab]);

  const isReconnectingExisting = state === "reconnecting_existing";

  const clearSavedSigner = useCallback(() => {
    cancelRef.current?.cancel();
    cancelRef.current = null;
    clearActiveSignerConfig();
    resetLocal();
  }, [resetLocal]);

  const handlePrimaryAction = useCallback(() => {
    if (canRetryExisting) {
      const connectionView = getActiveSession();
      if (
        connectionView?.config.type === "nip46" &&
        connectionView.config.method === "bunker_input"
      ) {
        void tryReconnectWithExistingBunkerConnection("manual_retry");
      } else {
        void tryReconnectWithExistingConnection("manual_retry");
      }
    } else if (tab === "nostrconnect" && getPendingReconnect()) {
      void resumeReconnectWithPendingUri();
    } else {
      void connect();
    }
  }, [
    canRetryExisting,
    tab,
    tryReconnectWithExistingConnection,
    tryReconnectWithExistingBunkerConnection,
    resumeReconnectWithPendingUri,
    connect,
  ]);

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
    tryReconnectWithExistingConnection,
    tryReconnectWithExistingBunkerConnection,
    resumeReconnectWithPendingUri,
    clearSavedSigner,
    handlePrimaryAction,
    canRetryExisting,
    reconnectStartLabel,
    isReconnectingExisting,
    cancelRef,
    EXISTING_SESSION_RECONNECT_TIMEOUTS_MS,
  };
}
