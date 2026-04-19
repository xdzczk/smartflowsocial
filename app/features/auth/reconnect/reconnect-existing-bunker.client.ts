/**
 * Run existing bunker session reconnect (pool, retries, timeouts).
 * No React; callbacks for state and signer/session updates.
 */

import {
  cacheNip46SignerFromLogin,
  createNip46SignerFromStoredConfig,
  detectSignerAppName,
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

import {
  EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS,
  EXISTING_SESSION_RECONNECT_TIMEOUTS_MS,
  PROFILE_MISMATCH_MESSAGE,
  debugReconnectTrace,
} from "../reconnect-dialog-utils.client";
import type { ExistingReconnectTrigger } from "../reconnect-lifecycle.client";
import { parseBunkerInput } from "../reconnect-uri.client";

const PING_VERIFY_MS = 5000;

export interface RunExistingBunkerReconnectOptions {
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
  syncRelaysAfterReconnect: () => Promise<void>;
  onSuccess: (connectionId: string) => void;
}

export async function runExistingBunkerReconnect(
  options: RunExistingBunkerReconnectOptions
): Promise<void> {
  const {
    connectionView,
    expectedPubkeyHex,
    runId: _runId,
    getIsRunStale,
    setCancel,
    setState,
    setError,
    setExistingReconnectAttempt,
    syncRelaysAfterReconnect,
    onSuccess,
  } = options;

  type Nip46BunkerConfig = Extract<
    ActiveSignerConfig,
    { type: "nip46"; method: "bunker_input" }
  >;
  const bunkerConfig = connectionView.connection.config as Nip46BunkerConfig;
  const { bunkerInput: storedBunkerInput } = bunkerConfig;

  const bp = await parseBunkerInput(storedBunkerInput);
  if (!bp) throw new Error("Invalid bunker input");

  setState("reconnecting_existing");
  setError(null);

  // The shared pool is owned by the app and never closed mid-flight, so the
  // dialog's "cancel" can no longer kill in-flight WebSockets. Connect
  // attempts are bounded by their timeoutMs; if the user cancels, the awaited
  // promise still resolves at timeout. Pass a noop so legacy callers are
  // satisfied.
  setCancel(() => {});

  const tryConnect = async (
    timeoutMs: number
  ): Promise<{
    signer: Awaited<
      ReturnType<typeof createNip46SignerFromStoredConfig>
    >["signer"];
    pubkey: string;
  }> => {
    const pool = getSharedPool();
    const { signer, pubkey } = await createNip46SignerFromStoredConfig(
      bunkerConfig,
      { pool, timeoutMs }
    );
    return { signer, pubkey };
  };

  let result: Awaited<ReturnType<typeof tryConnect>>;
  try {
    setExistingReconnectAttempt(1);
    result = await tryConnect(EXISTING_SESSION_RECONNECT_TIMEOUTS_MS[0]);
  } catch (firstError) {
    debugReconnectTrace(
      "First existing-connection bunker reconnect attempt failed",
      {
        error:
          firstError instanceof Error ? firstError.message : String(firstError),
      }
    );
    await new Promise((resolve) =>
      setTimeout(resolve, EXISTING_SESSION_RECONNECT_RETRY_DELAY_MS)
    );
    try {
      setExistingReconnectAttempt(2);
      result = await tryConnect(EXISTING_SESSION_RECONNECT_TIMEOUTS_MS[1]);
    } catch {
      debugReconnectTrace(
        "Second existing-connection bunker reconnect attempt failed"
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
    debugReconnectTrace(
      "Existing-connection bunker reconnect pubkey mismatch",
      { expectedPubkeyHex, receivedPubkey: pubkey }
    );
    try {
      await signer.close();
    } catch {
      // ignore
    }
    setError(PROFILE_MISMATCH_MESSAGE);
    setState("failed");
    return;
  }

  // Preserve any persisted relay override (from `switch_relays` or a previous
  // login) and otherwise fall back to the bunker URL's relays. Keeping
  // `relays` populated avoids helpers that read `cfg.relays` ever seeing an
  // empty list and treating the transport as dead.
  const reconnectBunkerRelays =
    bunkerConfig.relays?.filter((r) => r.startsWith("wss://")) ??
    bp.relays.map((r) => r.trim()).filter((r) => r.startsWith("wss://"));
  const config: ActiveSignerConfig = {
    type: "nip46",
    method: "bunker_input",
    bunkerInput: storedBunkerInput,
    clientSecretKeyHex: bunkerConfig.clientSecretKeyHex,
    ...(reconnectBunkerRelays.length > 0 && { relays: reconnectBunkerRelays }),
  };

  const connectionId = connectionView.connection.id;
  const detectedAppName = detectSignerAppName(config);
  updateSession(connectionId, {
    metadata: {
      ...connectionView.connection.metadata,
      pubkey,
      signerAppName: detectedAppName,
      status: "active",
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      lastError: null,
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

  await syncRelaysAfterReconnect();
  if (getIsRunStale()) return;

  debugReconnectTrace("Existing-connection bunker reconnect succeeded", {
    connectionId,
    pubkey,
  });
  setExistingReconnectAttempt(0);
  setState("connected");
  onSuccess(connectionId);
}
