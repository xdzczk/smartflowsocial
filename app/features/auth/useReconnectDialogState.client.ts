import { getPublicKey, generateSecretKey, SimplePool } from "nostr-tools";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";

import { convertToHex } from "~/lib/nostr-conversion";
import {
  cacheNip46SignerFromLogin,
  clearActiveSignerConfig,
  createNip46SignerFromStoredConfig,
  getActiveSigner,
  parseSecretKeyHex,
  resetCachedSigner,
  serializeSecretKey,
  setActiveSignerConfig,
  syncRelaysWithRemoteSigner,
  type ActiveSignerConfig,
} from "~/lib/nostr-signer-manager.client";
import { attemptPrimarySignerFailover } from "~/lib/primary-signer-failover.client";
import {
  detectSignerAppName,
  getActiveConnection,
  getActiveSession,
  matchOrCreateSession,
  setActiveSession,
  updateSession,
} from "~/lib/remote-signer-sessions.client";
import { recordConnectionEvent } from "~/lib/remote-signer-status.client";

import {
  connectNip46WithBunkerInput,
  connectNip46WithNostrConnectUri,
} from "./nostr-signer.client";
import {
  buildRelayUnion,
  DEFAULT_RELAYS,
  DEFAULT_RELAYS_ARRAY,
  debugReconnectTrace,
  EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS,
  EXISTING_SESSION_RECONNECT_TIMEOUTS_MS,
  METHOD_BUNKER_INPUT,
  PROFILE_MISMATCH_MESSAGE,
  RECONNECT_SUCCESS_TOAST_RETRY,
  RELAY_UNION_CAP,
  TOAST_RECONNECT_SUCCESS,
} from "./reconnect-dialog-utils.client";
import { useRemoteSignerHealthPolling } from "./reconnect-health.client";
import {
  isConnectionLifecycleErrorMessage,
  isExistingReconnectRunStale,
  shouldCancelExistingReconnectOnHidden,
  shouldDeferExistingReconnectTerminalError,
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
      if (
        isExistingReconnectRunStale({
          currentRunId: existingReconnectRunIdRef.current,
          runId: input.runId,
        })
      ) {
        return;
      }
      if (closedByExternalReconnectRef.current) {
        debugReconnectTrace(
          "Skipping failure handling: dialog already closed by external reconnect"
        );
        return;
      }

      const errorMessage =
        input.error instanceof Error
          ? input.error.message
          : String(input.error);
      const lifecycleError = isConnectionLifecycleErrorMessage(errorMessage);

      if (
        input.trigger !== "foreground_resume" &&
        shouldDeferExistingReconnectTerminalError({
          lifecycleError,
          wasHiddenDuringExistingReconnect:
            wasHiddenDuringExistingReconnectRef.current,
          trigger: input.trigger,
          foregroundResumeAttemptFailed:
            existingReconnectForegroundAttemptFailedRef.current,
        })
      ) {
        debugReconnectTrace(
          "Existing-connection reconnect failed during app-switch window; deferring terminal error",
          { trigger: input.trigger, error: errorMessage }
        );
        setState("idle");
        setExistingReconnectAttempt(0);
        setError(null);
        return;
      }

      debugReconnectTrace(
        "Existing-connection reconnect failed; trying primary failover",
        { error: errorMessage }
      );

      const fallback = await attemptPrimarySignerFailover({
        expectedPubkey: expectedPubkeyHex,
        labelFallback: "Primary Home Signer",
      });
      if (
        isExistingReconnectRunStale({
          currentRunId: existingReconnectRunIdRef.current,
          runId: input.runId,
        })
      ) {
        return;
      }
      if (fallback.recovered) {
        debugReconnectTrace("Primary failover recovered reconnect");
        await syncRelaysAfterReconnect();
        setExistingReconnectAttempt(0);
        setState("connected");
        toast.success(TOAST_RECONNECT_SUCCESS);
        const recoveredConnection = getActiveSession();
        if (recoveredConnection) {
          onReconnectSuccess?.(recoveredConnection.id);
        }
        onOpenChange(false);
        return;
      }
      debugReconnectTrace("Primary failover did not recover reconnect", {
        reason: fallback.reason ?? "unknown",
      });

      if (input.trigger === "foreground_resume") {
        existingReconnectForegroundAttemptFailedRef.current = true;
      } else if (
        shouldDeferExistingReconnectTerminalError({
          lifecycleError,
          wasHiddenDuringExistingReconnect:
            wasHiddenDuringExistingReconnectRef.current,
          trigger: input.trigger,
          foregroundResumeAttemptFailed:
            existingReconnectForegroundAttemptFailedRef.current,
        })
      ) {
        debugReconnectTrace(
          "Suppressing terminal reconnect error until foreground resume attempt fails",
          { trigger: input.trigger }
        );
        setState("idle");
        setExistingReconnectAttempt(0);
        setError(null);
        return;
      }

      setState("idle");
      setExistingReconnectAttempt(0);
      setError(
        "Could not reconnect with existing connection. If the connection is still in your signer app, switch to it, reactivate the connection, then return here — we'll retry automatically. Or generate a new connection string below."
      );
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

      type Nip46NostrConnectConfig = Extract<
        ActiveSignerConfig,
        { type: "nip46"; method: "nostrconnect_uri" }
      >;
      const ncConfig: Nip46NostrConnectConfig = connectionView.config;
      const { uri, relays, clientSecretKeyHex } = ncConfig;
      const signerPubkeyHex =
        ncConfig.signerPubkey ??
        (connectionView.metadata.pubkey
          ? (convertToHex(connectionView.metadata.pubkey) ??
            connectionView.metadata.pubkey)
          : null);
      const clientPubkeyHex = (() => {
        try {
          return getPublicKey(parseSecretKeyHex(clientSecretKeyHex));
        } catch {
          return null;
        }
      })();
      debugReconnectTrace("Starting existing-connection reconnect", {
        connectionId: connectionView.id,
        client_pubkey: clientPubkeyHex,
        relays,
        method: "nostrconnect_uri",
        relayCount: relays.length,
        timeoutsMs: EXISTING_SESSION_RECONNECT_TIMEOUTS_MS,
        expectedPubkeyHex,
        status: connectionView.metadata.status,
        lastActivityAt: connectionView.metadata.lastActivityAt,
        trigger,
      });

      setState("reconnecting_existing");
      setError(null);

      let activePool: SimplePool | null = null;
      const closePool = (pool: SimplePool | null) => {
        if (!pool) return;
        try {
          pool.close(relays);
        } catch {
          // ignore
        }
      };
      cancelRef.current = {
        cancel: () => {
          closePool(activePool);
          activePool = null;
        },
      };

      try {
        const clientSecretKey = parseSecretKeyHex(clientSecretKeyHex);
        const tryConnect = async (
          timeoutMs: number,
          relaysToUse: string[]
        ): Promise<{
          signer: Awaited<
            ReturnType<typeof createNip46SignerFromStoredConfig>
          >["signer"];
          pubkey: string;
        }> => {
          closePool(activePool);
          const attemptPool = new SimplePool();
          activePool = attemptPool;
          if (signerPubkeyHex || ncConfig.bunkerPointer) {
            const config: Nip46NostrConnectConfig = {
              ...ncConfig,
              relays: relaysToUse,
              signerPubkey:
                ncConfig.signerPubkey ?? signerPubkeyHex ?? undefined,
              bunkerPointer: ncConfig.bunkerPointer
                ? { ...ncConfig.bunkerPointer, relays: relaysToUse }
                : ncConfig.bunkerPointer,
            };
            const { signer, pubkey } = await createNip46SignerFromStoredConfig(
              config,
              {
                pool: attemptPool,
                timeoutMs,
              }
            );
            return { signer, pubkey };
          }
          const { signer, pubkey } = await connectNip46WithNostrConnectUri({
            uri,
            clientSecretKey,
            pool: attemptPool,
            timeoutMs,
            relaysToCloseOnCancel: relaysToUse,
          });
          return { signer, pubkey };
        };

        let result: Awaited<ReturnType<typeof tryConnect>>;
        let relaysUsed = relays;
        try {
          setExistingReconnectAttempt(1);
          result = await tryConnect(
            EXISTING_SESSION_RECONNECT_TIMEOUTS_MS[0],
            relays
          );
        } catch (firstError) {
          debugReconnectTrace(
            "First existing-connection reconnect attempt failed",
            {
              error:
                firstError instanceof Error
                  ? firstError.message
                  : String(firstError),
            }
          );
          let relaysSecond = relays;
          try {
            const unionRelays = buildRelayUnion(
              relays,
              DEFAULT_RELAYS_ARRAY,
              RELAY_UNION_CAP
            );
            if (unionRelays.length > 0) {
              relaysSecond = unionRelays;
            }
          } catch {
            // Keep original relays if build fails
          }
          await new Promise((resolve) =>
            setTimeout(resolve, EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS)
          );
          try {
            setExistingReconnectAttempt(2);
            result = await tryConnect(
              EXISTING_SESSION_RECONNECT_TIMEOUTS_MS[1],
              relaysSecond
            );
            relaysUsed = relaysSecond;
          } catch {
            debugReconnectTrace(
              "Second existing-connection reconnect attempt failed"
            );
            throw firstError;
          }
        }

        if (
          isExistingReconnectRunStale({
            currentRunId: existingReconnectRunIdRef.current,
            runId,
          })
        ) {
          try {
            await result.signer.close();
          } catch {
            // ignore
          }
          activePool = null;
          return;
        }
        const { signer, pubkey } = result;
        if (expectedPubkeyHex && pubkey !== expectedPubkeyHex) {
          debugReconnectTrace("Existing-connection reconnect pubkey mismatch", {
            expectedPubkeyHex,
            receivedPubkey: pubkey,
          });
          try {
            await signer.close();
          } catch {
            // ignore
          }
          activePool = null;
          setError(PROFILE_MISMATCH_MESSAGE);
          setState("failed");
          return;
        }

        const config: ActiveSignerConfig = {
          type: "nip46",
          method: "nostrconnect_uri",
          uri,
          relays: relaysUsed,
          clientSecretKeyHex,
          signerPubkey: convertToHex(pubkey) ?? pubkey,
        };

        const detectedAppName = detectSignerAppName(config);
        updateSession(connectionView.id, {
          config: {
            ...connectionView.config,
            relays: relaysUsed,
            signerPubkey: config.signerPubkey,
            bunkerPointer: connectionView.config.bunkerPointer,
          },
          metadata: {
            ...connectionView.metadata,
            pubkey,
            signerAppName: detectedAppName,
            status: "active",
            connectedAt: Date.now(),
            lastActivityAt: Date.now(),
            lastError: null,
            relays: relaysUsed,
          },
        });

        recordConnectionEvent(connectionView.id, {
          type: "connected",
          pubkey,
        });

        setActiveSignerConfig(config);
        cacheNip46SignerFromLogin(signer);
        activePool = null;

        const PING_VERIFY_MS = 5000;
        if (typeof signer.ping === "function") {
          try {
            await Promise.race([
              signer.ping(),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error("Ping timeout")),
                  PING_VERIFY_MS
                )
              ),
            ]);
          } catch {
            resetCachedSigner();
            setError(
              "Connection could not be verified. Start a new session in your signer app (e.g. Primal), then tap Reconnect again."
            );
            setState("idle");
            return;
          }
        }

        await syncRelaysAfterReconnect();
        if (existingReconnectRunIdRef.current !== runId) {
          return;
        }
        debugReconnectTrace("Existing-connection reconnect succeeded", {
          connectionId: connectionView.id,
          pubkey,
        });
        setExistingReconnectAttempt(0);
        setState("connected");
        toast.success(TOAST_RECONNECT_SUCCESS);
        onReconnectSuccess?.(connectionView.id);
        onOpenChange(false);
      } catch (err) {
        await handleExistingReconnectFailure({ error: err, runId, trigger });
      } finally {
        if (existingReconnectRunIdRef.current === runId) {
          inFlightExistingReconnectRef.current = false;
        }
        closePool(activePool);
        activePool = null;
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

      type Nip46BunkerConfig = Extract<
        ActiveSignerConfig,
        { type: "nip46"; method: "bunker_input" }
      >;
      const bunkerConfig: Nip46BunkerConfig = connectionView.config;
      const { bunkerInput: storedBunkerInput, clientSecretKeyHex } =
        bunkerConfig;
      const clientPubkeyHexBunker = (() => {
        try {
          return getPublicKey(parseSecretKeyHex(clientSecretKeyHex));
        } catch {
          return null;
        }
      })();
      debugReconnectTrace("Starting existing-connection bunker reconnect", {
        connectionId: connectionView.id,
        client_pubkey: clientPubkeyHexBunker,
        method: "bunker_input",
        trigger,
      });

      setState("reconnecting_existing");
      setError(null);

      let activePool: SimplePool | null = null;
      const bp = await parseBunkerInput(storedBunkerInput);
      if (!bp) throw new Error("Invalid bunker input");
      try {
        cancelRef.current = {
          cancel: () => {
            if (activePool && bp.relays.length) {
              try {
                activePool.close(bp.relays);
              } catch {
                // ignore
              }
            }
            activePool = null;
          },
        };

        const tryConnect = async (timeoutMs: number) => {
          if (activePool) {
            try {
              activePool.close(bp.relays);
            } catch {
              // ignore
            }
            activePool = null;
          }
          const pool = new SimplePool();
          activePool = pool;
          const { signer, pubkey } = await createNip46SignerFromStoredConfig(
            bunkerConfig,
            {
              pool,
              timeoutMs,
            }
          );
          return { signer, pubkey };
        };

        let result: Awaited<
          ReturnType<typeof createNip46SignerFromStoredConfig>
        >;
        try {
          setExistingReconnectAttempt(1);
          result = await tryConnect(EXISTING_SESSION_RECONNECT_TIMEOUTS_MS[0]);
        } catch (firstError) {
          debugReconnectTrace(
            "First existing-connection bunker reconnect attempt failed",
            {
              error:
                firstError instanceof Error
                  ? firstError.message
                  : String(firstError),
            }
          );
          await new Promise((resolve) =>
            setTimeout(resolve, EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS)
          );
          try {
            setExistingReconnectAttempt(2);
            result = await tryConnect(
              EXISTING_SESSION_RECONNECT_TIMEOUTS_MS[1]
            );
          } catch {
            debugReconnectTrace(
              "Second existing-connection bunker reconnect attempt failed"
            );
            throw firstError;
          }
        }

        if (
          isExistingReconnectRunStale({
            currentRunId: existingReconnectRunIdRef.current,
            runId,
          })
        ) {
          try {
            await result.signer.close();
          } catch {
            // ignore
          }
          activePool = null;
          return;
        }
        const { signer, pubkey } = result;
        if (expectedPubkeyHex && pubkey !== expectedPubkeyHex) {
          debugReconnectTrace(
            "Existing-connection bunker reconnect pubkey mismatch",
            { expectedPubkeyHex, receivedPubkey: pubkey }
          );
          try {
            await signer.close();
          } catch {
            // ignore
          }
          activePool = null;
          setError(PROFILE_MISMATCH_MESSAGE);
          setState("failed");
          return;
        }

        const config: ActiveSignerConfig = {
          type: "nip46",
          method: "bunker_input",
          bunkerInput: storedBunkerInput,
          clientSecretKeyHex,
        };

        const detectedAppName = detectSignerAppName(config);
        updateSession(connectionView.id, {
          metadata: {
            ...connectionView.metadata,
            pubkey,
            signerAppName: detectedAppName,
            status: "active",
            connectedAt: Date.now(),
            lastActivityAt: Date.now(),
            lastError: null,
          },
        });

        recordConnectionEvent(connectionView.id, {
          type: "connected",
          pubkey,
        });

        setActiveSignerConfig(config);
        cacheNip46SignerFromLogin(signer);
        activePool = null;

        const PING_VERIFY_MS_BUNKER = 5000;
        if (typeof signer.ping === "function") {
          try {
            await Promise.race([
              signer.ping(),
              new Promise<never>((_, reject) =>
                setTimeout(
                  () => reject(new Error("Ping timeout")),
                  PING_VERIFY_MS_BUNKER
                )
              ),
            ]);
          } catch {
            resetCachedSigner();
            setError(
              "Connection could not be verified. Start a new session in your signer app (e.g. Primal), then tap Reconnect again."
            );
            setState("idle");
            return;
          }
        }

        await syncRelaysAfterReconnect();
        if (existingReconnectRunIdRef.current !== runId) return;
        debugReconnectTrace("Existing-connection bunker reconnect succeeded", {
          connectionId: connectionView.id,
          pubkey,
        });
        setExistingReconnectAttempt(0);
        setState("connected");
        toast.success(TOAST_RECONNECT_SUCCESS);
        onReconnectSuccess?.(connectionView.id);
        onOpenChange(false);
      } catch (err) {
        await handleExistingReconnectFailure({ error: err, runId, trigger });
      } finally {
        if (existingReconnectRunIdRef.current === runId) {
          inFlightExistingReconnectRef.current = false;
        }
        cancelRef.current = null;
        const poolToClose = activePool;
        activePool = null;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- activePool may be null; poolToClose used in finally
        if (poolToClose != null) {
          try {
            const bpForClose = await parseBunkerInput(storedBunkerInput);
            if (bpForClose?.relays.length)
              (poolToClose as SimplePool).close(bpForClose.relays);
          } catch {
            // ignore
          }
        }
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
