import { generateSecretKey, getPublicKey, SimplePool } from "nostr-tools";
import { parseBunkerInput } from "nostr-tools/nip46";
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
import { useOptionalUser } from "~/lib/remix-utils";
import {
  OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
  type ReconnectDialogOpenMode,
} from "~/lib/remote-signer-reconnect.client";
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
  createNip46NostrConnectUri,
  getNostrConnectAppMetadata,
  parseRelayList,
} from "../nostr-signer.client";
import {
  isConnectionLifecycleErrorMessage,
  isExistingReconnectRunStale,
  shouldCancelExistingReconnectOnHidden,
  shouldDeferExistingReconnectTerminalError,
  shouldResumeExistingReconnectOnVisible,
  type ExistingReconnectTrigger,
} from "../reconnect-lifecycle.client";

const DEFAULT_RELAYS = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
].join("\n");

const DEFAULT_RELAYS_ARRAY = [
  "wss://relay.primal.net",
  "wss://relay.damus.io",
  "wss://nos.lol/",
];

const RELAY_UNION_CAP = 8;

function buildRelayUnion(
  stored: string[],
  defaults: string[],
  cap: number = RELAY_UNION_CAP
): string[] {
  const normalized = (r: string) => r.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of [...stored, ...defaults]) {
    const n = normalized(r);
    if (r.startsWith("wss://") && !seen.has(n)) {
      seen.add(n);
      out.push(r.trim());
      if (out.length >= cap) break;
    }
  }
  return out;
}

/** Survives app backgrounding when user switches to signer app (e.g. Primal). */
const PENDING_RECONNECT_STORAGE_KEY = "__smartflow_pending_reconnect_nip46_v1";

const PROFILE_MISMATCH_MESSAGE =
  "Different signer profile detected. Please activate the same identity as your SmartFlow connection.";

const RECONNECT_SUCCESS_TOAST_RETRY =
  "Remote signer reconnected. Please retry your action.";

const TOAST_RECONNECT_SUCCESS = "Remote signer reconnected.";

const METHOD_BUNKER_INPUT = "bunker_input";

/** Canonical key for bunker identity (pubkey + normalized relays + secret) for reconnect vs new comparison. */
function bunkerCanonicalKey(bp: {
  pubkey: string;
  relays: string[];
  secret: null | string;
}): string {
  const normalized = bp.relays
    .map((r) => r.trim().toLowerCase())
    .filter((r) => r.startsWith("wss://"));
  const sorted = [...new Set(normalized)].sort();
  return `${bp.pubkey}\n${sorted.join(",")}\n${bp.secret ?? ""}`;
}

const EXISTING_SESSION_RECONNECT_TIMEOUTS_MS = [20_000, 40_000] as const;
const EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS = 1000;

function debugReconnectTrace(
  message: string,
  details?: Record<string, unknown>
) {
  if (details) {
    console.info(`[remote-signer-reconnect] ${message}`, details);
    return;
  }
  console.info(`[remote-signer-reconnect] ${message}`);
}

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
  const expectedPubkeyHex = (() => {
    if (!expectedPubkey) return null;
    return convertToHex(expectedPubkey) ?? expectedPubkey;
  })();

  const [tab, setTab] = useState<"nostrconnect" | "bunker">("nostrconnect");
  const [relayList, setRelayList] = useState(DEFAULT_RELAYS);
  const [bunkerInput, setBunkerInput] = useState("");
  const [connectionLabel, setConnectionLabel] = useState("");

  const [state, setState] = useState<ConnectState>("idle");
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
  /** Set when dialog is closed because connection was restored externally (e.g. user started session in Primal). Skip in-flight failure handling. */
  const closedByExternalReconnectRef = useRef(false);
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
  }, [clearPendingReconnectStorage]);

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
    } catch (error) {
      debugReconnectTrace("Relay sync after reconnect failed", {
        error: error instanceof Error ? error.message : String(error),
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
        {
          error: errorMessage,
        }
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
        "Could not reconnect with existing connection. If the connection is still in your signer app, switch to it, reactivate the connection, then return here — we’ll retry automatically. Or generate a new connection string below."
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

        // Verify the new connection with a ping so we don't leave a dead signer cached
        // (e.g. if we connected to Primal's old session before they started a new one).
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
      } catch (error) {
        await handleExistingReconnectFailure({ error, runId, trigger });
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
      const { bunkerInput, clientSecretKeyHex } = bunkerConfig;
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
      const bp = await parseBunkerInput(bunkerInput);
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
          bunkerInput,
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

        // Verify the new connection with a ping so we don't leave a dead signer cached.
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
      } catch (error) {
        await handleExistingReconnectFailure({ error, runId, trigger });
      } finally {
        if (existingReconnectRunIdRef.current === runId) {
          inFlightExistingReconnectRef.current = false;
        }
        cancelRef.current = null;
        const poolToClose = activePool;
        activePool = null;
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard when connect threw before clearing
        if (poolToClose) {
          try {
            const bpForClose = await parseBunkerInput(bunkerInput);
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

  // When connection is restored externally (e.g. user started session in Primal while modal was open), close dialog and avoid handling the modal's in-flight timeout as failure.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const handleConnectionHealthy = () => {
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
    };
    window.addEventListener(
      "nostr-connection-healthy",
      handleConnectionHealthy
    );
    return () => {
      window.removeEventListener(
        "nostr-connection-healthy",
        handleConnectionHealthy
      );
    };
  }, [open, expectedPubkeyHex, onReconnectSuccess, onOpenChange]);

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

    // When dialog opens with an existing connection, try reconnecting with stored config first.
    if (triedExistingRef.current) return;
    const connectionView = getActiveSession();
    if (connectionView?.config.type !== "nip46") return;
    if (connectionView.config.method === "nostrconnect_uri") {
      triedExistingRef.current = true;
      void tryReconnectWithExistingConnection("initial");
      return;
    }
    // nip46 connection that is not nostrconnect_uri is bunker_input
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

        // Create or update connection
        const connectionView = matchOrCreateSession(config, {
          label: connectionLabel || undefined,
          signerPubkey: pubkey,
        });
        setActiveSession(connectionView.id);

        // Update connection with pubkey and detected app name
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

        // Record connection event
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

      // nostrconnect
      if (inFlightNostrConnectRef.current) {
        return;
      }
      inFlightNostrConnectRef.current = true;
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

      // Create or update connection
      const connectionView = matchOrCreateSession(config, {
        label: connectionLabel || undefined,
        signerPubkey: pubkey,
      });
      setActiveSession(connectionView.id);

      // Update connection with pubkey and detected app name
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

      // Record connection event
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
    clearPendingReconnectStorage,
    getPendingReconnect,
    expectedPubkeyHex,
    onOpenChange,
    onReconnectSuccess,
    relayList,
    connectionLabel,
    setPendingReconnect,
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
    clearPendingReconnectStorage,
    getPendingReconnect,
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
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- method is "nostrconnect_uri" | "bunker_input"
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

      // User returned after generating new URI and approving in signer app — resume with same URI.
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

      // User returned after reactivating existing connection in signer app — retry reconnect with stored config.
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
    getPendingReconnect,
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
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- method is "nostrconnect_uri" | "bunker_input"
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
            Start a new session in your signer app (e.g. Primal) first, then
            we’ll connect. Reconnecting (attempt{" "}
            {Math.max(existingReconnectAttempt, 1)}/
            {EXISTING_SESSION_RECONNECT_TIMEOUTS_MS.length})…
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="session-label">Session Label (Optional)</Label>
            <Input
              id="session-label"
              value={connectionLabel}
              onChange={(e) => setConnectionLabel(e.target.value)}
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
                        <span className="flex items-center gap-2">
                          <PrimalLogoIcon className="size-5 shrink-0" />
                          Login with Primal
                        </span>
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
              cancelRef.current?.cancel();
              cancelRef.current = null;
              clearActiveSignerConfig();
              resetLocal();
            }}
            disabled={state === "waiting"}
          >
            Clear saved signer
          </Button>
          <Button
            type="button"
            onClick={() => {
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
