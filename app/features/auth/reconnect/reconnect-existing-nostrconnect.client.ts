/**
 * Run existing Nostr Connect session reconnect (pool, retries, timeouts).
 * No React; callbacks for state and signer/session updates.
 */

import {
  cacheNip46SignerFromLogin,
  createNip46SignerFromStoredConfig,
  detectSignerAppName,
  parseSecretKeyHex,
  recordConnectionEvent,
  resetCachedSigner,
  setActiveSignerConfig,
  updateSession,
} from "~/features/auth/signer";
import type {
  ActiveSignerConfig,
  ConnectionWithCurrentSession,
} from "~/features/auth/signer";
import { getSharedPool } from "~/features/nostr/shared-pool.client";
import { convertToHex } from "~/lib/nostr-conversion";

import { connectNip46WithNostrConnectUri } from "../nostr-signer.client";
import {
  buildRelayUnion,
  DEFAULT_RELAYS_ARRAY,
  EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS,
  EXISTING_SESSION_RECONNECT_TIMEOUTS_MS,
  PROFILE_MISMATCH_MESSAGE,
  RELAY_UNION_CAP,
  debugReconnectTrace,
} from "../reconnect-dialog-utils.client";
import type { ExistingReconnectTrigger } from "../reconnect-lifecycle.client";

const PING_VERIFY_MS = 5000;

export interface RunExistingNostrConnectReconnectOptions {
  connectionView: ConnectionWithCurrentSession;
  expectedPubkeyHex: string | null;
  trigger: ExistingReconnectTrigger;
  runId: number;
  getIsRunStale: () => boolean;
  setCancel: (cancel: () => void) => void;
  setState: (
    s: "reconnecting_existing" | "failed" | "idle" | "connected"
  ) => void;
  setError: (e: string | null) => void;
  setExistingReconnectAttempt: (n: number) => void;
  onSuccess: (connectionId: string) => void;
}

export async function runExistingNostrConnectReconnect(
  options: RunExistingNostrConnectReconnectOptions
): Promise<void> {
  const {
    connectionView,
    expectedPubkeyHex,
    trigger: _trigger,
    runId: _runId,
    getIsRunStale,
    setCancel,
    setState,
    setError,
    setExistingReconnectAttempt,
    onSuccess,
  } = options;

  type Nip46NostrConnectConfig = Extract<
    ActiveSignerConfig,
    { type: "nip46"; method: "nostrconnect_uri" }
  >;
  const conn = connectionView.connection;
  const ncConfig = conn.config as Nip46NostrConnectConfig;
  const { uri, relays, clientSecretKeyHex } = ncConfig;
  const signerPubkeyHex =
    ncConfig.signerPubkey ??
    (conn.metadata.pubkey
      ? (convertToHex(conn.metadata.pubkey) ?? conn.metadata.pubkey)
      : null);

  setState("reconnecting_existing");
  setError(null);

  // Shared pool stays open for the app lifetime. The dialog's cancel can no
  // longer abort an in-flight WebSocket; attempts are bounded by timeoutMs.
  setCancel(() => {});

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
    const pool = getSharedPool();
    if (signerPubkeyHex || ncConfig.bunkerPointer) {
      const config: Nip46NostrConnectConfig = {
        ...ncConfig,
        relays: relaysToUse,
        signerPubkey: ncConfig.signerPubkey ?? signerPubkeyHex ?? undefined,
        bunkerPointer: ncConfig.bunkerPointer
          ? { ...ncConfig.bunkerPointer, relays: relaysToUse }
          : ncConfig.bunkerPointer,
      };
      const { signer, pubkey } = await createNip46SignerFromStoredConfig(
        config,
        { pool, timeoutMs }
      );
      return { signer, pubkey };
    }
    const { signer, pubkey } = await connectNip46WithNostrConnectUri({
      uri,
      clientSecretKey,
      pool,
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
    debugReconnectTrace("First existing-connection reconnect attempt failed", {
      error:
        firstError instanceof Error ? firstError.message : String(firstError),
    });
    let relaysSecond = relays;
    try {
      const unionRelays = buildRelayUnion(
        relays,
        DEFAULT_RELAYS_ARRAY,
        RELAY_UNION_CAP
      );
      if (unionRelays.length > 0) relaysSecond = unionRelays;
    } catch {
      // keep original
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

  if (getIsRunStale()) {
    try {
      await result.signer.close();
    } catch {
      // ignore
    }
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
  const updatedConfig: Nip46NostrConnectConfig = {
    ...ncConfig,
    relays: relaysUsed,
    signerPubkey: config.signerPubkey,
  };
  const connectionId = conn.id;
  updateSession(connectionId, {
    config: updatedConfig,
    metadata: {
      ...conn.metadata,
      pubkey,
      signerAppName: detectedAppName,
      status: "active",
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      lastError: null,
      relays: relaysUsed,
    },
  });

  recordConnectionEvent(connectionId, { type: "connected", pubkey });

  setActiveSignerConfig(config);
  cacheNip46SignerFromLogin(signer);

  if (typeof signer.ping === "function") {
    try {
      await Promise.race([
        signer.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Ping timeout")), PING_VERIFY_MS)
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

  if (getIsRunStale()) return;

  debugReconnectTrace("Existing-connection reconnect succeeded", {
    connectionId,
    pubkey,
  });
  setExistingReconnectAttempt(0);
  setState("connected");
  onSuccess(connectionId);
}
