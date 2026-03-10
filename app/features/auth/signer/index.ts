/**
 * Auth signer public API (Nostr signer management, remote signer sessions, health, reconnect).
 * Re-exports from feature modules for a single entry point.
 */

// Nostr signer manager (storage, connection, keys)
export {
  getActiveSignerConfig,
  setActiveSignerConfig,
  clearActiveSignerConfig,
  getActiveSigner,
  cacheNip46SignerFromLogin,
  createNip46SignerFromStoredConfig,
  recordSuccessfulSign,
  resetCachedSigner,
  syncRelaysWithRemoteSigner,
  teardownActiveNip46Signer,
  teardownVisibilityHandler,
  tryBackgroundReconnect,
  getWindowNostrLikeSigner,
  getActiveSignerPubkeyHint,
  STORAGE_KEY,
  NOSTR_CONNECTION_HEALTHY_EVENT,
  SIGNER_CONFIG_HYDRATED_EVENT,
  isMobile,
  parseSecretKeyHex,
  serializeSecretKey,
} from "./nostr-signer-manager.client";
export type { ActiveSignerConfig } from "./nostr-signer-manager.client";

// Remote signer sessions
export {
  setCurrentUserNpub,
  getAllConnections,
  getActiveConnection,
  getActiveConnectionId,
  getConnectionById,
  getSessionsForConnection,
  getSessionById,
  getCurrentSessionForConnection,
  startNewSessionForConnection,
  endCurrentSessionForConnection,
  createConnection,
  updateConnection,
  updateSessionRecord,
  removeConnection,
  setActiveConnection,
  clearActiveConnection,
  addConnectionLog,
  getSessionHistory,
  getAllSessions,
  getActiveSession,
  getSessionByIdLegacy,
  findMatchingConnectionForConfig,
  findMatchingSessionForConfig,
  matchOrCreateConnection,
  matchOrCreateSession,
  createSession,
  updateSession,
  setActiveSession,
  clearActiveSession,
  removeSession,
  getConnectionHistory,
  detectSignerAppName,
  maskConnectionUri,
} from "./remote-signer-sessions.client";
export type {
  ConnectionStatus,
  ConnectionLogEntry,
  RemoteSignerConnectionMetadata,
  RemoteSignerConnection,
  RemoteSignerSessionRecord,
  RemoteSignerSession,
} from "./remote-signer-sessions.client";

// Remote signer status
export {
  getConnectionStatus,
  updateConnectionStatus,
  recordConnectionEvent,
  getSessionStatus,
  updateSessionStatus,
} from "./remote-signer-status.client";
export type { ConnectionEvent } from "./remote-signer-status.client";

// Remote signer health
export { testConnection } from "./remote-signer-health.client";
export type { ConnectionHealthResult } from "./remote-signer-health.client";

// Remote signer reconnect (events)
export {
  REMOTE_SIGNER_TIMEOUT_EVENT,
  OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
  emitRemoteSignerTimeoutEvent,
  emitOpenRemoteSignerReconnectDialogEvent,
} from "./remote-signer-reconnect.client";
export type {
  RemoteSignerTimeoutEventDetail,
  ReconnectDialogOpenMode,
  OpenRemoteSignerReconnectDialogEventDetail,
} from "./remote-signer-reconnect.client";

// Primary signer failover
export {
  fetchPrimarySignerProfile,
  clearPrimarySignerProfileCache,
  testPrimarySignerProfileConnection,
  attemptPrimarySignerFailover,
} from "./primary-signer-failover.client";

// Primary signer profile (types + guard)
export type { PrimarySignerProfile } from "./primary-signer-profile";
export { isPrimarySignerProfile } from "./primary-signer-profile";

// Migration (for root entry - run on load)
export { migrateExistingConfig } from "./remote-signer-sessions-migration.client";
