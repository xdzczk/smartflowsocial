/**
 * Types and constants for remote signer sessions.
 * No runtime behaviour; shared by storage and API layers.
 */

import type { ActiveSignerConfig } from "./nostr-signer-storage.client";

export type ConnectionStatus = "active" | "disconnected" | "stale" | "inactive";

export interface ConnectionLogEntry {
  id: string;
  timestamp: number;
  type:
    | "connect"
    | "disconnect"
    | "error"
    | "health_check"
    | "reconnect"
    | "sign";
  status: "success" | "failure" | "timeout";
  message: string;
  details?: Record<string, unknown>;
}

/** Connection-level metadata (no event history). */
export interface RemoteSignerConnectionMetadata {
  status: ConnectionStatus;
  signerAppName: string | null;
  pubkey: string | null;
  relays: string[];
  connectedAt: number | null;
  lastActivityAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
}

/** A NIP-46 connection (config + metadata). Contains multiple sessions over time. */
export interface RemoteSignerConnection {
  id: string;
  label: string;
  config: ActiveSignerConfig;
  metadata: RemoteSignerConnectionMetadata;
  /** Session we are currently logging to (null if disconnected). */
  currentSessionId: string | null;
}

/** One time-bound session under a connection; has its own event log. */
export interface RemoteSignerSessionRecord {
  id: string;
  connectionId: string;
  startedAt: number;
  endedAt: number | null;
  history: ConnectionLogEntry[];
}

/**
 * Legacy view: connection + current session history. Used by getActiveSession/getSessionById
 * until all call sites use connections and sessions.
 */
export interface RemoteSignerSession {
  id: string;
  label: string;
  config: ActiveSignerConfig;
  metadata: RemoteSignerConnectionMetadata;
  history: ConnectionLogEntry[];
}

export interface MatchOrCreateSessionOptions {
  label?: string;
  signerPubkey?: string | null;
}

/** Legacy v1 storage (flat sessions with history on each). */
export interface RemoteSignerSessionsStorageV1 {
  sessions: RemoteSignerSession[];
  activeSessionId: string | null;
  version: 1;
}

/** V2 storage: connections and sessions. */
export interface RemoteSignerSessionsStorageV2 {
  version: 2;
  connections: RemoteSignerConnection[];
  sessions: RemoteSignerSessionRecord[];
  activeConnectionId: string | null;
}

export const STORAGE_KEY_PREFIX = "__smartflow_remote_signer_sessions_v1";
export const STORAGE_KEY_V2_PREFIX = "__smartflow_remote_signer_sessions_v2";
export const MAX_HISTORY_ENTRIES = 100;
export const MAX_SESSIONS_PER_CONNECTION = 20;
export const ACTIVE_SESSION_CHANGED_EVENT =
  "remote-signer-active-session-changed";
export const ACTIVE_CONNECTION_CHANGED_EVENT =
  "remote-signer-active-connection-changed";
