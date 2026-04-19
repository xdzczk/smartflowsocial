/**
 * Resolve NIP-46 signer from config: cooldown, connect (bunker or Nostr Connect), post-connect steps.
 * Used by getActiveSigner; side effects go through options callbacks for testability.
 */

import {
  BunkerSigner,
  createNostrConnectURI,
  parseNostrConnectURI,
} from "nostr-tools/nip46";

import {
  Nip46Signer,
  type NostrSigner,
} from "~/features/auth/nostr-signer.client";
import { getSharedPool } from "~/features/nostr/shared-pool.client";
import { convertToHex } from "~/lib/nostr-conversion";

import { createNip46SignerFromStoredConfig } from "./connection-connect.client";
import {
  NIP46_SIGNER_TYPE,
  NOSTR_CONNECTION_HEALTHY_EVENT,
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
  isRequestCurrent: () => boolean;
  setCachedSigner: (signer: NostrSigner | null) => void;
  getCachedSigner: () => NostrSigner | null;
  getActiveConnection: () => RemoteSignerConnection | null;
  updateSession: (id: string, updates: Record<string, unknown>) => void;
  recordConnectionEvent: (connectionId: string, event: ConnectionEvent) => void;
  syncRelaysWithRemoteSigner: (signer: NostrSigner) => Promise<unknown>;
  persistActiveSignerConfigWithoutReset: (config: ActiveSignerConfig) => void;
}

/**
 * Resolve a NIP-46 signer from config. Connects via bunker or Nostr Connect,
 * runs post-connect steps (update session, sync relays). Returns null if the
 * request is no longer current; throws on connection errors.
 */
export async function resolveNip46SignerFromConfig(
  config: Extract<ActiveSignerConfig, { type: "nip46" }>,
  options: ResolveNip46SignerOptions
): Promise<NostrSigner | null> {
  const {
    isRequestCurrent,
    setCachedSigner,
    getCachedSigner,
    getActiveConnection,
    updateSession,
    recordConnectionEvent,
    syncRelaysWithRemoteSigner,
    persistActiveSignerConfigWithoutReset,
  } = options;

  const clientSecretKey = hexToBytes(config.clientSecretKeyHex);
  // Shared pool: never closed here. The bunker subscription is released via
  // signer.close(); transport stays open for the rest of the app.
  const pool = getSharedPool();

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
    const unionRelays = buildRelayUnion(
      cfg.relays,
      DEFAULT_RELAYS_CONNECT,
      RELAY_UNION_CAP
    );
    if (unionRelays.length > 0 && !relayListsEqual(unionRelays, cfg.relays)) {
      persistActiveSignerConfigWithoutReset({
        ...cfg,
        relays: unionRelays,
      });
      const connectionForRelays = getActiveConnection();
      if (
        connectionForRelays?.config.type === NIP46_SIGNER_TYPE &&
        connectionForRelays.config.method === "nostrconnect_uri"
      ) {
        updateSession(connectionForRelays.id, {
          config: { ...connectionForRelays.config, relays: unionRelays },
          metadata: {
            ...connectionForRelays.metadata,
            relays: unionRelays,
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
      configUpdates.bunkerPointer = (signer as Nip46Signer).getBunkerPointer();
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

    if (cfg.bunkerPointer || (cfg.signerPubkey && cfg.relays.length > 0)) {
      const result = await createNip46SignerFromStoredConfig(cfg, {
        pool,
        timeoutMs: CONNECT_TIMEOUT_MS,
      });
      if (!isRequestCurrent()) {
        await result.signer.close();
        return null;
      }
      setCachedSigner(result.signer);
    } else {
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
}
