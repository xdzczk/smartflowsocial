/**
 * Pure (non-React) connect and resume actions for the reconnect dialog.
 * All dependencies passed as arguments for testability.
 */

import { generateSecretKey } from "nostr-tools";

import type {
  ActiveSignerConfig,
  ConnectionEvent,
  ConnectionWithCurrentSession,
} from "~/features/auth/signer";
import { getSharedPool } from "~/features/nostr/shared-pool.client";

import {
  connectNip46WithBunkerInput,
  connectNip46WithNostrConnectUri,
} from "../nostr-signer.client";
import {
  PROFILE_MISMATCH_MESSAGE,
  RECONNECT_SUCCESS_TOAST_RETRY,
} from "../reconnect-dialog-utils.client";
import type { ReconnectState } from "../reconnect-state.client";
import {
  bunkerCanonicalKey,
  clearPendingReconnectStorage,
  createNip46NostrConnectUri,
  parseBunkerInput,
  parseRelayList,
  setPendingReconnect,
} from "../reconnect-uri.client";

export interface ConnectWithBunkerParams {
  bunkerInput: string;
  connectionLabel: string;
  expectedPubkeyHex: string | null;
  getActiveSession: () => ConnectionWithCurrentSession | null;
  setState: (s: ReconnectState) => void;
  setError: (e: string | null) => void;
  matchOrCreateSession: (
    config: ActiveSignerConfig,
    opts: { label?: string; signerPubkey: string }
  ) => ConnectionWithCurrentSession;
  setActiveSession: (id: string) => void;
  updateSession: (id: string, updates: Record<string, unknown>) => void;
  recordConnectionEvent: (id: string, event: ConnectionEvent) => void;
  setActiveSignerConfig: (config: ActiveSignerConfig) => void;
  detectSignerAppName: (config: ActiveSignerConfig) => string | null;
  parseSecretKeyHex: (hex: string) => Uint8Array;
  serializeSecretKey: (key: Uint8Array) => string;
  syncRelaysAfterReconnect: () => Promise<void>;
  onReconnectSuccess?: (connectionId: string) => void;
  onOpenChange: (open: boolean) => void;
  toastSuccess: (msg: string) => void;
}

export async function connectWithBunker(
  params: ConnectWithBunkerParams
): Promise<void> {
  const {
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
    syncRelaysAfterReconnect,
    onReconnectSuccess,
    onOpenChange,
    toastSuccess,
  } = params;

  setState("waiting");
  const trimmedBunker = bunkerInput.trim();
  const activeView = getActiveSession();
  const activeConfig = activeView?.connection.config;
  const bunkerConfig =
    activeConfig?.type === "nip46" && activeConfig.method === "bunker_input"
      ? activeConfig
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

  const view = matchOrCreateSession(config, {
    label: connectionLabel || undefined,
    signerPubkey: pubkey,
  });
  const connectionId = view.connection.id;
  setActiveSession(connectionId);

  const detectedAppName = detectSignerAppName(config);
  updateSession(connectionId, {
    metadata: {
      ...view.connection.metadata,
      pubkey,
      signerAppName: detectedAppName,
      status: "active",
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
    },
  });

  recordConnectionEvent(connectionId, { type: "connected", pubkey });

  setActiveSignerConfig(config);
  await syncRelaysAfterReconnect();
  setState("connected");
  toastSuccess(RECONNECT_SUCCESS_TOAST_RETRY);
  onReconnectSuccess?.(connectionId);
  onOpenChange(false);
}

export interface ConnectWithNostrConnectUriParams {
  relayList: string;
  connectionLabel: string;
  expectedPubkeyHex: string | null;
  getActiveSession: () => ConnectionWithCurrentSession | null;
  setState: (s: ReconnectState) => void;
  setError: (e: string | null) => void;
  setNostrConnectUri: (uri: string | null) => void;
  setCancel: (fn: () => void) => void;
  currentState: string;
  matchOrCreateSession: (
    config: ActiveSignerConfig,
    opts: { label?: string; signerPubkey: string }
  ) => ConnectionWithCurrentSession;
  setActiveSession: (id: string) => void;
  updateSession: (id: string, updates: Record<string, unknown>) => void;
  recordConnectionEvent: (id: string, event: ConnectionEvent) => void;
  setActiveSignerConfig: (config: ActiveSignerConfig) => void;
  detectSignerAppName: (config: ActiveSignerConfig) => string | null;
  serializeSecretKey: (key: Uint8Array) => string;
  syncRelaysAfterReconnect: () => Promise<void>;
  onReconnectSuccess?: (connectionId: string) => void;
  onOpenChange: (open: boolean) => void;
  toastSuccess: (msg: string) => void;
}

export async function connectWithNostrConnectUri(
  params: ConnectWithNostrConnectUriParams
): Promise<void> {
  const {
    relayList,
    connectionLabel,
    expectedPubkeyHex,
    getActiveSession: _getActiveSession,
    setState,
    setError,
    setNostrConnectUri,
    setCancel,
    currentState: _currentState,
    matchOrCreateSession,
    setActiveSession,
    updateSession,
    recordConnectionEvent,
    setActiveSignerConfig,
    detectSignerAppName,
    serializeSecretKey,
    syncRelaysAfterReconnect,
    onReconnectSuccess,
    onOpenChange,
    toastSuccess,
  } = params;

  const relays = parseRelayList(relayList);
  const created = createNip46NostrConnectUri(relays);

  setNostrConnectUri(created.uri);
  setState("waiting");
  setPendingReconnect(created.uri, created.clientSecretKey, created.relays);

  setCancel(() => {
    try {
      created.pool.close(created.relays);
    } catch {
      // ignore
    }
  });

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

  const view = matchOrCreateSession(config, {
    label: connectionLabel || undefined,
    signerPubkey: pubkey,
  });
  const connectionId = view.connection.id;
  setActiveSession(connectionId);

  const detectedAppName = detectSignerAppName(config);
  updateSession(connectionId, {
    metadata: {
      ...view.connection.metadata,
      pubkey,
      signerAppName: detectedAppName,
      status: "active",
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
    },
  });

  recordConnectionEvent(connectionId, { type: "connected", pubkey });

  setActiveSignerConfig(config);
  await syncRelaysAfterReconnect();
  clearPendingReconnectStorage();
  setState("connected");
  toastSuccess(RECONNECT_SUCCESS_TOAST_RETRY);
  onReconnectSuccess?.(connectionId);
  onOpenChange(false);
}

export interface ResumeWithPendingUriParams {
  connectionLabel: string;
  expectedPubkeyHex: string | null;
  getPendingReconnect: () => {
    uri: string;
    clientSecretKey: Uint8Array;
    relays: string[];
  } | null;
  getActiveSession: () => ConnectionWithCurrentSession | null;
  setState: (s: ReconnectState) => void;
  setError: (e: string | null) => void;
  setNostrConnectUri: (uri: string | null) => void;
  setCancel: (fn: () => void) => void;
  currentState: string;
  matchOrCreateSession: (
    config: ActiveSignerConfig,
    opts: { label?: string; signerPubkey: string }
  ) => ConnectionWithCurrentSession;
  setActiveSession: (id: string) => void;
  updateSession: (id: string, updates: Record<string, unknown>) => void;
  recordConnectionEvent: (id: string, event: ConnectionEvent) => void;
  setActiveSignerConfig: (config: ActiveSignerConfig) => void;
  detectSignerAppName: (config: ActiveSignerConfig) => string | null;
  serializeSecretKey: (key: Uint8Array) => string;
  syncRelaysAfterReconnect: () => Promise<void>;
  onReconnectSuccess?: (connectionId: string) => void;
  onOpenChange: (open: boolean) => void;
  toastSuccess: (msg: string) => void;
}

export async function resumeWithPendingUri(
  params: ResumeWithPendingUriParams
): Promise<void> {
  const pending = params.getPendingReconnect();
  if (!pending) return;

  const {
    connectionLabel,
    expectedPubkeyHex,
    getActiveSession,
    setState,
    setError,
    setNostrConnectUri,
    setCancel,
    currentState,
    matchOrCreateSession,
    setActiveSession,
    updateSession,
    recordConnectionEvent,
    setActiveSignerConfig,
    detectSignerAppName,
    serializeSecretKey,
    syncRelaysAfterReconnect,
    onReconnectSuccess,
    onOpenChange,
    toastSuccess,
  } = params;

  setError(null);
  setNostrConnectUri(pending.uri);
  setState("waiting");

  const pool = getSharedPool();
  // Shared pool is owned by the app and never closed mid-flight; cancel is a
  // noop for the WebSocket layer and the connect call falls back to its own
  // timeout. Keep the callback so legacy state stays consistent.
  setCancel(() => {});

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

    const view = matchOrCreateSession(config, {
      label: connectionLabel || undefined,
      signerPubkey: pubkey,
    });
    const connectionId = view.connection.id;
    setActiveSession(connectionId);

    const detectedAppName = detectSignerAppName(config);
    updateSession(connectionId, {
      metadata: {
        ...view.connection.metadata,
        pubkey,
        signerAppName: detectedAppName,
        status: "active",
        connectedAt: Date.now(),
        lastActivityAt: Date.now(),
      },
    });

    recordConnectionEvent(connectionId, { type: "connected", pubkey });

    setActiveSignerConfig(config);
    await syncRelaysAfterReconnect();
    clearPendingReconnectStorage();
    setState("connected");
    toastSuccess(RECONNECT_SUCCESS_TOAST_RETRY);
    onReconnectSuccess?.(connectionId);
    onOpenChange(false);
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : "Failed to reconnect signer";
    const msgLower = errorMessage.toLowerCase();
    const isConnectionError =
      msgLower.includes("subscription closed") ||
      msgLower.includes("websocket") ||
      msgLower.includes("connection");
    const hasPending = params.getPendingReconnect() !== null;

    if (isConnectionError && hasPending && currentState === "waiting") {
      return;
    }

    setError(errorMessage);
    setState("failed");

    const activeView = getActiveSession();
    if (activeView) {
      recordConnectionEvent(activeView.connection.id, {
        type: "error",
        error: errorMessage,
      });
    }
  }
}
