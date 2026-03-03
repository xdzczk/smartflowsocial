import type {
  ConnectionStatus,
  ConnectionLogEntry,
  RemoteSignerSession,
} from "~/lib/remote-signer-sessions.client";
import {
  getActiveConnection,
  getSessionByIdLegacy,
  startNewSessionForConnection,
  endCurrentSessionForConnection,
  updateSession,
  addConnectionLog,
} from "~/lib/remote-signer-sessions.client";

export type ConnectionEvent =
  | { type: "connected"; pubkey: string; duration?: number }
  | { type: "disconnected"; reason?: string }
  | { type: "error"; error: string }
  | { type: "health_check"; healthy: boolean; error?: string }
  | { type: "reconnect"; success: boolean; error?: string }
  | { type: "signed"; kind?: number };

export function getConnectionStatus(connectionId: string): ConnectionStatus {
  const connectionView = getSessionByIdLegacy(connectionId);
  return connectionView?.metadata.status ?? "inactive";
}

export function updateConnectionStatus(
  connectionId: string,
  status: ConnectionStatus,
  metadata?: Partial<RemoteSignerSession["metadata"]>
): void {
  const connectionView = getSessionByIdLegacy(connectionId);
  if (!connectionView) {
    return;
  }

  updateSession(connectionId, {
    metadata: {
      ...connectionView.metadata,
      ...metadata,
      status,
    },
  });
}

/** @deprecated Use getConnectionStatus(connectionId). */
export function getSessionStatus(connectionId: string): ConnectionStatus {
  return getConnectionStatus(connectionId);
}

/** @deprecated Use updateConnectionStatus(connectionId, ...). */
export function updateSessionStatus(
  connectionId: string,
  status: ConnectionStatus,
  metadata?: Partial<RemoteSignerSession["metadata"]>
): void {
  updateConnectionStatus(connectionId, status, metadata);
}

function handleConnectedEvent(
  connectionId: string,
  connectionView: RemoteSignerSession,
  event: Extract<ConnectionEvent, { type: "connected" }>
): {
  logType: ConnectionLogEntry["type"];
  logStatus: ConnectionLogEntry["status"];
  message: string;
  details: Record<string, unknown>;
} {
  const message = `Connected successfully${event.duration ? ` (${event.duration}ms)` : ""}`;
  const details: Record<string, unknown> = { pubkey: event.pubkey };
  if (event.duration) {
    details["duration"] = event.duration;
  }

  updateSession(connectionId, {
    metadata: {
      ...connectionView.metadata,
      status: "active",
      pubkey: event.pubkey,
      connectedAt: Date.now(),
      lastActivityAt: Date.now(),
      lastError: null,
    },
  });

  return {
    logType: "connect",
    logStatus: "success",
    message,
    details,
  };
}

function handleDisconnectedEvent(
  connectionId: string,
  connectionView: RemoteSignerSession,
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
  if (event.reason) {
    details["reason"] = event.reason;
  }

  updateSession(connectionId, {
    metadata: {
      ...connectionView.metadata,
      status: "disconnected",
      lastActivityAt: Date.now(),
    },
  });

  return {
    logType: "disconnect",
    logStatus: "success",
    message,
    details,
  };
}

function handleErrorEvent(
  connectionId: string,
  connectionView: RemoteSignerSession,
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
      ...connectionView.metadata,
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
  connectionView: RemoteSignerSession,
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
  if (event.error) {
    details["error"] = event.error;
  }

  if (event.healthy) {
    updateSession(connectionId, {
      metadata: {
        ...connectionView.metadata,
        status: "active",
        lastActivityAt: Date.now(),
        lastError: null,
      },
    });
  } else {
    updateSession(connectionId, {
      metadata: {
        ...connectionView.metadata,
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
  connectionView: RemoteSignerSession,
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
  if (event.error) {
    details["error"] = event.error;
  }

  if (event.success) {
    updateSession(connectionId, {
      metadata: {
        ...connectionView.metadata,
        status: "active",
        lastActivityAt: Date.now(),
        lastError: null,
      },
    });
  } else {
    updateSession(connectionId, {
      metadata: {
        ...connectionView.metadata,
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
  connectionView: RemoteSignerSession,
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
      ...connectionView.metadata,
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
  const connectionView = getSessionByIdLegacy(connectionId);
  if (!connectionView) {
    return;
  }

  if (event.type === "connected") {
    startNewSessionForConnection(connectionId);
  }

  const connectionViewAfterConnect = getSessionByIdLegacy(connectionId);
  if (!connectionViewAfterConnect) {
    return;
  }

  let result: {
    logType: ConnectionLogEntry["type"];
    logStatus: ConnectionLogEntry["status"];
    message: string;
    details: Record<string, unknown>;
  };

  switch (event.type) {
    case "connected":
      result = handleConnectedEvent(
        connectionId,
        connectionViewAfterConnect,
        event
      );
      break;
    case "disconnected":
      result = handleDisconnectedEvent(
        connectionId,
        connectionViewAfterConnect,
        event
      );
      break;
    case "error":
      result = handleErrorEvent(
        connectionId,
        connectionViewAfterConnect,
        event
      );
      break;
    case "health_check":
      result = handleHealthCheckEvent(
        connectionId,
        connectionViewAfterConnect,
        event
      );
      break;
    case "reconnect":
      result = handleReconnectEvent(
        connectionId,
        connectionViewAfterConnect,
        event
      );
      break;
    case "signed":
      result = handleSignedEvent(
        connectionId,
        connectionViewAfterConnect,
        event
      );
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
