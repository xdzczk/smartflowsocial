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

    // `createNip46SignerFromStoredConfig` runs in `skipValidation` mode on
    // cold rebuild and returns the bunker pointer pubkey rather than doing
    // a second `get_public_key` RPC. For session metadata we prefer the
    // user pubkey we already captured at login, falling back to the bunker
    // pubkey only when no metadata exists yet (first reconnect after a
    // partial setup).
    const activeConnection = getActiveConnection();
    const pubkey = activeConnection?.metadata.pubkey ?? result.pubkey;
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

    // We deliberately do NOT proactively call `switch_relays` here. It used
    // to fire on every cold reopen as a "best-effort" relay refresh, but it
    // adds an extra NIP-46 publish to all bunker relays and an 8s pending
    // RPC that competes with the user's first sign for the per-signer
    // rpcLock. Worse, when Primal is still waking up the publish gets lost
    // (or rate-limited) and our retry layer used to interpret the timeout
    // as a transport failure and tear down the signer. Ditto's
    // `NConnectSigner` never calls `switch_relays`; the relay set captured
    // at login is sufficient for ongoing use, and explicit reconnect via
    // the reconnect dialog is the right place to refresh it.

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

    // Reuse the pubkey we already captured at login (or via fromURI's
    // connection event) instead of doing a fresh `get_public_key` RPC. On
    // cold reopen the bunker app may be backgrounded/sleeping, and a
    // network round-trip here races the user's first `signEvent` for the
    // signer's reply — exactly the bug behind "I logged back in but the
    // first publish hangs and times out". Mirrors `connectViaBunker` and
    // matches `@nostrify` `NConnectSigner` which never validates on
    // construction. The fallback only fires for the truly fresh URI flow
    // where no pubkey has been captured yet.
    const activeConnection = getActiveConnection();
    const knownPubkey =
      activeConnection?.metadata.pubkey ?? cfg.signerPubkey ?? null;
    const pubkey = knownPubkey ?? (await signer.getPublicKey());

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

    // Same reasoning as `connectViaBunker`: don't block the cached signer
    // on a `switch_relays` RPC that races the user's first sign.
    void (async () => {
      try {
        await syncRelaysWithRemoteSigner(signer);
      } catch {
        // best-effort
      }
    })();
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
