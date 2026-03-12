import type {
  ConnectionStatus,
  ConnectionLogEntry,
  RemoteSignerConnectionMetadata,
  ConnectionWithCurrentSession,
} from "./remote-signer-sessions.client";
import {
  getActiveConnection,
  getSessionByIdLegacy,
  startNewSessionForConnection,
  endCurrentSessionForConnection,
  updateSession,
  addConnectionLog,
} from "./remote-signer-sessions.client";

export type ConnectionEvent =
  | { type: "connected"; pubkey: string; duration?: number }
  | { type: "disconnected"; reason?: string }
  | { type: "error"; error: string }
  | { type: "health_check"; healthy: boolean; error?: string }
  | { type: "reconnect"; success: boolean; error?: string }
  | { type: "signed"; kind?: number };

export function getConnectionStatus(connectionId: string): ConnectionStatus {
  const view = getSessionByIdLegacy(connectionId);
  return view?.connection.metadata.status ?? "inactive";
}

export function updateConnectionStatus(
  connectionId: string,
  status: ConnectionStatus,
  metadata?: Partial<RemoteSignerConnectionMetadata>
): void {
  const view = getSessionByIdLegacy(connectionId);
  if (!view) return;

  updateSession(connectionId, {
    metadata: {
      ...view.connection.metadata,
      ...metadata,
      status,
    },
  });
}

function handleConnectedEvent(
  connectionId: string,
  view: ConnectionWithCurrentSession,
  event: Extract<ConnectionEvent, { type: "connected" }>
): {
  logType: ConnectionLogEntry["type"];
  logStatus: ConnectionLogEntry["status"];
  message: string;
  details: Record<string, unknown>;
} {
  const message = `Connected successfully${event.duration ? ` (${event.duration}ms)` : ""}`;
  const details: Record<string, unknown> = { pubkey: event.pubkey };
  if (event.duration) details["duration"] = event.duration;

  updateSession(connectionId, {
    metadata: {
      ...view.connection.metadata,
      status: "active",
      pubkey: event.pubkey,
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      lastError: null,
    },
  });

  return { logType: "connect", logStatus: "success", message, details };
}

function handleDisconnectedEvent(
  connectionId: string,
  view: ConnectionWithCurrentSession,
  event: Extract<ConnectionEvent, { type: "disconnected" }>
): {
  logType: ConnectionLogEntry["type"];
  logStatus: ConnectionLogEntry["status"];
  message: string;
  details: Record<string, unknown>;
} {
  const message = event.reason
    ? `Disconnected: ${event.reason}`
    : "Disconnected";
  const details: Record<string, unknown> = {};
  if (event.reason) details["reason"] = event.reason;

  updateSession(connectionId, {
    metadata: {
      ...view.connection.metadata,
      status: "disconnected",
      lastActivityAt: Date.now(),
    },
  });

  return { logType: "disconnect", logStatus: "success", message, details };
}

function handleErrorEvent(
  connectionId: string,
  view: ConnectionWithCurrentSession,
  event: Extract<ConnectionEvent, { type: "error" }>
): {
  logType: ConnectionLogEntry["type"];
  logStatus: ConnectionLogEntry["status"];
  message: string;
  details: Record<string, unknown>;
} {
  const message = `Error: ${event.error}`;
  const details: Record<string, unknown> = { error: event.error };

  updateSession(connectionId, {
    metadata: {
      ...view.connection.metadata,
      status: "disconnected",
      lastError: event.error,
      lastActivityAt: Date.now(),
    },
  });

  return {
    logType: "error",
    logStatus: "failure",
    message,
    details,
  };
}

function handleHealthCheckEvent(
  connectionId: string,
  view: ConnectionWithCurrentSession,
  event: Extract<ConnectionEvent, { type: "health_check" }>
): {
  logType: ConnectionLogEntry["type"];
  logStatus: ConnectionLogEntry["status"];
  message: string;
  details: Record<string, unknown>;
} {
  const message = event.healthy
    ? "Health check passed"
    : `Health check failed${event.error ? `: ${event.error}` : ""}`;
  const details: Record<string, unknown> = {};
  if (event.error) details["error"] = event.error;

  if (event.healthy) {
    updateSession(connectionId, {
      metadata: {
        ...view.connection.metadata,
        status: "active",
        lastActivityAt: Date.now(),
        lastError: null,
      },
    });
  } else {
    updateSession(connectionId, {
      metadata: {
        ...view.connection.metadata,
        status: "stale",
        lastError: event.error ?? "Health check failed",
        lastActivityAt: Date.now(),
      },
    });
  }

  return {
    logType: "health_check",
    logStatus: event.healthy ? "success" : "failure",
    message,
    details,
  };
}

function handleReconnectEvent(
  connectionId: string,
  view: ConnectionWithCurrentSession,
  event: Extract<ConnectionEvent, { type: "reconnect" }>
): {
  logType: ConnectionLogEntry["type"];
  logStatus: ConnectionLogEntry["status"];
  message: string;
  details: Record<string, unknown>;
} {
  const message = event.success
    ? "Reconnected successfully"
    : `Reconnect failed${event.error ? `: ${event.error}` : ""}`;
  const details: Record<string, unknown> = {};
  if (event.error) details["error"] = event.error;

  if (event.success) {
    updateSession(connectionId, {
      metadata: {
        ...view.connection.metadata,
        status: "active",
        lastActivityAt: Date.now(),
        lastError: null,
      },
    });
  } else {
    updateSession(connectionId, {
      metadata: {
        ...view.connection.metadata,
        status: "disconnected",
        lastError: event.error ?? "Reconnect failed",
        lastActivityAt: Date.now(),
      },
    });
  }

  return {
    logType: "reconnect",
    logStatus: event.success ? "success" : "failure",
    message,
    details,
  };
}

function signKindToLabel(kind: number): string {
  switch (kind) {
    case 1:
      return "note";
    case 6:
      return "repost";
    case 16:
      return "repost";
    case 30023:
      return "article";
    default:
      return "event";
  }
}

function handleSignedEvent(
  connectionId: string,
  view: ConnectionWithCurrentSession,
  event: Extract<ConnectionEvent, { type: "signed" }>
): {
  logType: ConnectionLogEntry["type"];
  logStatus: ConnectionLogEntry["status"];
  message: string;
  details: Record<string, unknown>;
} {
  const kind = event.kind ?? 1;
  const label = signKindToLabel(kind);
  const message = `Signed ${label}`;
  const details: Record<string, unknown> = { kind };

  updateSession(connectionId, {
    metadata: {
      ...view.connection.metadata,
      lastActivityAt: Date.now(),
    },
  });

  return {
    logType: "sign",
    logStatus: "success",
    message,
    details,
  };
}

/**
 * Record a connection event for the given connection (by id).
 * For "connected": starts a new session then logs into it.
 * For "disconnected": logs into current session then ends that session.
 */
export function recordConnectionEvent(
  connectionId: string,
  event: ConnectionEvent
): void {
  const view = getSessionByIdLegacy(connectionId);
  if (!view) return;

  if (event.type === "connected") {
    startNewSessionForConnection(connectionId);
  }

  const viewAfterConnect = getSessionByIdLegacy(connectionId);
  if (!viewAfterConnect) return;

  let result: {
    logType: ConnectionLogEntry["type"];
    logStatus: ConnectionLogEntry["status"];
    message: string;
    details: Record<string, unknown>;
  };

  switch (event.type) {
    case "connected":
      result = handleConnectedEvent(connectionId, viewAfterConnect, event);
      break;
    case "disconnected":
      result = handleDisconnectedEvent(connectionId, viewAfterConnect, event);
      break;
    case "error":
      result = handleErrorEvent(connectionId, viewAfterConnect, event);
      break;
    case "health_check":
      result = handleHealthCheckEvent(connectionId, viewAfterConnect, event);
      break;
    case "reconnect":
      result = handleReconnectEvent(connectionId, viewAfterConnect, event);
      break;
    case "signed":
      result = handleSignedEvent(connectionId, viewAfterConnect, event);
      break;
  }

  addConnectionLog(connectionId, {
    type: result.logType,
    status: result.logStatus,
    message: result.message,
    details:
      Object.keys(result.details).length > 0 ? result.details : undefined,
  });

  if (event.type === "disconnected") {
    endCurrentSessionForConnection(connectionId);
  }
}

// Initialize event listeners for connection state changes
if (typeof window !== "undefined") {
  window.addEventListener("nostr-connection-stale", (() => {
    const active = getActiveConnection();
    if (active) {
      recordConnectionEvent(active.id, {
        type: "health_check",
        healthy: false,
        error: "Connection stale",
      });
    }
  }) as EventListener);

  window.addEventListener("nostr-connection-healthy", (() => {
    const active = getActiveConnection();
    if (active) {
      recordConnectionEvent(active.id, {
        type: "health_check",
        healthy: true,
      });
    }
  }) as EventListener);
}
