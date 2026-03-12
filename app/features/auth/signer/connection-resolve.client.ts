/**
 * Resolve NIP-46 signer from config: cooldown, connect (bunker or Nostr Connect), post-connect steps.
 * Used by getActiveSigner; side effects go through options callbacks for testability.
 */

import { SimplePool } from "nostr-tools";
import {
  BunkerSigner,
  createNostrConnectURI,
  parseNostrConnectURI,
} from "nostr-tools/nip46";

import {
  Nip46Signer,
  type NostrSigner,
} from "~/features/auth/nostr-signer.client";
import { RemoteSignerTimeoutError } from "~/lib/errors";
import { convertToHex } from "~/lib/nostr-conversion";

import { createNip46SignerFromStoredConfig } from "./connection-connect.client";
import {
  NIP46_SIGNER_TYPE,
  NOSTR_CONNECTION_HEALTHY_EVENT,
  NOSTR_CONNECTION_STALE_EVENT,
  PROBE_ON_FIRST_USE_TIMEOUT_MS,
  PROBE_FAILED_AFTER_RESUME_MESSAGE,
  DEFAULT_RELAYS_CONNECT,
  RELAY_UNION_CAP,
} from "./connection-constants";
import {
  buildRelayUnion,
  relayListsEqual,
} from "./connection-relay-utils.client";
import { hexToBytes } from "./nostr-signer-keys.client";
import type { ActiveSignerConfig } from "./nostr-signer-storage.client";
import type { RemoteSignerConnection } from "./remote-signer-sessions-types";
import type { ConnectionEvent } from "./remote-signer-status.client";

const CONNECT_TIMEOUT_MS = 90_000;

export interface ResolveNip46SignerOptions {
  getConnectionCooldownUntil: () => number | null;
  isRequestCurrent: () => boolean;
  getSignerGeneration: () => number;
  setCachedSigner: (signer: NostrSigner | null) => void;
  getCachedSigner: () => NostrSigner | null;
  setConnectionEstablishedAt: (t: number | null) => void;
  setLastActivityTime: (t: number | null) => void;
  setLastVerificationTime: (t: number | null) => void;
  startHealthCheckMonitoring: () => void;
  stopHealthCheckMonitoring: () => void;
  getNeedsReprobe: () => boolean;
  setNeedsReprobe: (v: boolean) => void;
  verifySignerConnection: (
    signer: NostrSigner,
    timeoutMs: number
  ) => Promise<boolean>;
  resetCachedSigner: () => void;
  getActiveConnection: () => RemoteSignerConnection | null;
  updateSession: (id: string, updates: Record<string, unknown>) => void;
  recordConnectionEvent: (connectionId: string, event: ConnectionEvent) => void;
  syncRelaysWithRemoteSigner: (signer: NostrSigner) => Promise<unknown>;
  persistActiveSignerConfigWithoutReset: (config: ActiveSignerConfig) => void;
}

/**
 * Resolve a NIP-46 signer from config. Waits for cooldown, connects via bunker or Nostr Connect,
 * runs post-connect steps (probe if needed, update session, sync relays). Returns null if the
 * request is no longer current; throws on connection errors. Caller should catch and handle
 * cooldown/recording.
 */
export async function resolveNip46SignerFromConfig(
  config: Extract<ActiveSignerConfig, { type: "nip46" }>,
  options: ResolveNip46SignerOptions
): Promise<NostrSigner | null> {
  const {
    getConnectionCooldownUntil,
    isRequestCurrent,
    getSignerGeneration,
    setCachedSigner,
    getCachedSigner,
    setConnectionEstablishedAt,
    setLastActivityTime,
    setLastVerificationTime,
    startHealthCheckMonitoring,
    stopHealthCheckMonitoring,
    getNeedsReprobe,
    setNeedsReprobe,
    verifySignerConnection,
    resetCachedSigner,
    getActiveConnection,
    updateSession,
    recordConnectionEvent,
    syncRelaysWithRemoteSigner,
    persistActiveSignerConfigWithoutReset,
  } = options;

  const now = Date.now();
  const cooldownUntil = getConnectionCooldownUntil();
  if (cooldownUntil != null && now < cooldownUntil) {
    await new Promise((resolve) => setTimeout(resolve, cooldownUntil - now));
  }

  const myGen = getSignerGeneration();
  const clientSecretKey = hexToBytes(config.clientSecretKeyHex);
  let pool: SimplePool | undefined = new SimplePool();
  let relaysToClose: string[] = [];

  try {
    async function connectViaBunker(
      cfg: Extract<ActiveSignerConfig, { type: "nip46" }>
    ): Promise<NostrSigner | null> {
      const result = await createNip46SignerFromStoredConfig(cfg, {
        pool,
        timeoutMs: CONNECT_TIMEOUT_MS,
      });
      if (!isRequestCurrent()) {
        await result.signer.close();
        return null;
      }
      const signer = result.signer;
      setCachedSigner(signer);
      pool = undefined;
      const nowEst = Date.now();
      setConnectionEstablishedAt(nowEst);
      setLastActivityTime(nowEst);
      setLastVerificationTime(nowEst);
      startHealthCheckMonitoring();

      if (getNeedsReprobe()) {
        const probeOk = await verifySignerConnection(
          signer,
          PROBE_ON_FIRST_USE_TIMEOUT_MS
        );
        if (!probeOk) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- close is optional on NostrSigner
            await signer.close?.();
          } catch {
            // ignore
          }
          resetCachedSigner();
          setConnectionEstablishedAt(null);
          setLastActivityTime(null);
          const activeConnection = getActiveConnection();
          if (activeConnection) {
            recordConnectionEvent(activeConnection.id, {
              type: "health_check",
              healthy: false,
              error: PROBE_FAILED_AFTER_RESUME_MESSAGE,
            });
            recordConnectionEvent(activeConnection.id, {
              type: "disconnected",
              reason: PROBE_FAILED_AFTER_RESUME_MESSAGE,
            });
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent(NOSTR_CONNECTION_STALE_EVENT, {
                detail: { signerType: NIP46_SIGNER_TYPE },
              })
            );
          }
          throw new RemoteSignerTimeoutError();
        }
        setNeedsReprobe(false);
      }

      if (myGen !== getSignerGeneration()) {
        const s = getCachedSigner();
        resetCachedSigner();
        setConnectionEstablishedAt(null);
        setLastActivityTime(null);
        stopHealthCheckMonitoring();
        try {
          if (s) await s.close?.();
        } catch {
          // ignore
        }
        return null;
      }

      const pubkey = await signer.getPublicKey();
      const activeConnection = getActiveConnection();
      if (activeConnection) {
        updateSession(activeConnection.id, {
          metadata: {
            ...activeConnection.metadata,
            status: "active",
            pubkey,
            connectedAt: Date.now(),
            lastActivityAt: Date.now(),
            lastError: null,
          },
        });
        recordConnectionEvent(activeConnection.id, {
          type: "connected",
          pubkey,
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(NOSTR_CONNECTION_HEALTHY_EVENT, {
            detail: { signerType: NIP46_SIGNER_TYPE },
          })
        );
      }

      try {
        await syncRelaysWithRemoteSigner(getCachedSigner()!);
      } catch {
        // best-effort
      }

      return getCachedSigner();
    }

    type NostrConnectConfig = Extract<
      ActiveSignerConfig,
      { type: "nip46"; method: "nostrconnect_uri" }
    >;

    async function runNostrConnectPostConnectSteps(
      signer: NostrSigner,
      cfg: NostrConnectConfig
    ): Promise<boolean> {
      const nowEst = Date.now();
      setConnectionEstablishedAt(nowEst);
      setLastActivityTime(nowEst);
      setLastVerificationTime(nowEst);
      startHealthCheckMonitoring();

      if (getNeedsReprobe()) {
        const probeOk = await verifySignerConnection(
          signer,
          PROBE_ON_FIRST_USE_TIMEOUT_MS
        );
        if (!probeOk) {
          try {
            await signer.close?.();
          } catch {
            // ignore
          }
          resetCachedSigner();
          setConnectionEstablishedAt(null);
          setLastActivityTime(null);
          const activeConnection = getActiveConnection();
          if (activeConnection) {
            recordConnectionEvent(activeConnection.id, {
              type: "health_check",
              healthy: false,
              error: PROBE_FAILED_AFTER_RESUME_MESSAGE,
            });
            recordConnectionEvent(activeConnection.id, {
              type: "disconnected",
              reason: PROBE_FAILED_AFTER_RESUME_MESSAGE,
            });
          }
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent(NOSTR_CONNECTION_STALE_EVENT, {
                detail: { signerType: NIP46_SIGNER_TYPE },
              })
            );
          }
          throw new RemoteSignerTimeoutError();
        }
        setNeedsReprobe(false);
      }

      if (myGen !== getSignerGeneration()) {
        resetCachedSigner();
        setConnectionEstablishedAt(null);
        setLastActivityTime(null);
        stopHealthCheckMonitoring();
        try {
          await signer.close?.();
        } catch {
          // ignore
        }
        return false;
      }

      if (
        relaysToClose.length > 0 &&
        !relayListsEqual(relaysToClose, cfg.relays)
      ) {
        persistActiveSignerConfigWithoutReset({
          ...cfg,
          relays: relaysToClose,
        });
        const connectionForRelays = getActiveConnection();
        if (
          connectionForRelays?.config.type === NIP46_SIGNER_TYPE &&
          connectionForRelays.config.method === "nostrconnect_uri"
        ) {
          updateSession(connectionForRelays.id, {
            config: { ...connectionForRelays.config, relays: relaysToClose },
            metadata: {
              ...connectionForRelays.metadata,
              relays: relaysToClose,
              lastActivityAt: Date.now(),
            },
          });
        }
      }

      const pubkey = await signer.getPublicKey();

      const configUpdates: Partial<NostrConnectConfig> = {};
      if (!cfg.signerPubkey) {
        configUpdates.signerPubkey = convertToHex(pubkey) ?? pubkey;
      }
      if (signer.type === NIP46_SIGNER_TYPE && "getBunkerPointer" in signer) {
        configUpdates.bunkerPointer = (
          signer as Nip46Signer
        ).getBunkerPointer();
      }
      if (Object.keys(configUpdates).length > 0) {
        persistActiveSignerConfigWithoutReset({ ...cfg, ...configUpdates });
      }

      const activeConnection = getActiveConnection();
      if (activeConnection) {
        updateSession(activeConnection.id, {
          metadata: {
            ...activeConnection.metadata,
            status: "active",
            pubkey,
            connectedAt: Date.now(),
            lastActivityAt: Date.now(),
            lastError: null,
          },
        });
        recordConnectionEvent(activeConnection.id, {
          type: "connected",
          pubkey,
        });
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent(NOSTR_CONNECTION_HEALTHY_EVENT, {
            detail: { signerType: NIP46_SIGNER_TYPE },
          })
        );
      }

      try {
        await syncRelaysWithRemoteSigner(signer);
      } catch {
        // best-effort
      }
      return true;
    }

    async function connectViaNostrConnect(
      cfg: Extract<ActiveSignerConfig, { type: "nip46" }>
    ): Promise<NostrSigner | null> {
      if (cfg.method !== "nostrconnect_uri") return null;
      relaysToClose = cfg.relays;
      try {
        const unionRelays = buildRelayUnion(
          cfg.relays,
          DEFAULT_RELAYS_CONNECT,
          RELAY_UNION_CAP
        );
        if (unionRelays.length > 0) relaysToClose = unionRelays;
      } catch {
        // keep original
      }

      if (cfg.bunkerPointer || (cfg.signerPubkey && cfg.relays.length > 0)) {
        if (cfg.bunkerPointer?.relays.length) {
          relaysToClose = cfg.bunkerPointer.relays
            .map((r: string) => r.trim())
            .filter((r: string) => r.startsWith("wss://"));
        }
        const result = await createNip46SignerFromStoredConfig(cfg, {
          pool,
          timeoutMs: CONNECT_TIMEOUT_MS,
        });
        if (!isRequestCurrent()) {
          await result.signer.close();
          return null;
        }
        setCachedSigner(result.signer);
        pool = undefined;
      } else {
        if (!pool) return null;
        let uriToUse = cfg.uri;
        try {
          const parsed = parseNostrConnectURI(cfg.uri);
          const unionRelays = buildRelayUnion(
            cfg.relays,
            DEFAULT_RELAYS_CONNECT,
            RELAY_UNION_CAP
          );
          if (unionRelays.length > 0) {
            uriToUse = createNostrConnectURI({
              clientPubkey: parsed.clientPubkey,
              relays: unionRelays,
              secret: parsed.params.secret,
              perms: parsed.params.perms,
            });
            relaysToClose = unionRelays;
          }
        } catch {
          // keep original
        }
        const inner = await BunkerSigner.fromURI(
          clientSecretKey,
          uriToUse,
          { pool },
          CONNECT_TIMEOUT_MS
        );
        if (!isRequestCurrent()) {
          await inner.close();
          return null;
        }
        setCachedSigner(new Nip46Signer({ pool, inner }));
        pool = undefined;
      }

      const currentSigner = getCachedSigner();
      const ok = currentSigner
        ? await runNostrConnectPostConnectSteps(currentSigner, cfg)
        : false;
      if (!ok) return null;
      return getCachedSigner();
    }

    if (config.method === "bunker_input") {
      return await connectViaBunker(config);
    }
    return await connectViaNostrConnect(config);
  } catch (err) {
    try {
      /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- pool may be unset in some code paths */
      if (config.method === "nostrconnect_uri" && pool) {
        pool.close(relaysToClose);
      }
    } catch {
      // ignore
    }
    throw err;
  }
}
