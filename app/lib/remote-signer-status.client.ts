import type {
  ConnectionStatus,
  ConnectionLogEntry,
  RemoteSignerSession,
} from "~/lib/remote-signer-sessions.client";
import {
  getActiveSession,
  getSessionById,
  updateSession,
  addConnectionLog,
} from "~/lib/remote-signer-sessions.client";

export type ConnectionEvent =
  | { type: "connected"; pubkey: string; duration?: number }
  | { type: "disconnected"; reason?: string }
  | { type: "error"; error: string }
  | { type: "health_check"; healthy: boolean; error?: string }
  | { type: "reconnect"; success: boolean; error?: string };

export function getSessionStatus(sessionId: string): ConnectionStatus {
  const session = getSessionById(sessionId);
  return session?.metadata.status ?? "inactive";
}

export function updateSessionStatus(
  sessionId: string,
  status: ConnectionStatus,
  metadata?: Partial<RemoteSignerSession["metadata"]>
): void {
  const session = getSessionById(sessionId);
  if (!session) {
    return;
  }

  updateSession(sessionId, {
    metadata: {
      ...session.metadata,
      ...metadata,
      status,
    },
  });
}

function handleConnectedEvent(
  sessionId: string,
  session: RemoteSignerSession,
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

  updateSession(sessionId, {
    metadata: {
      ...session.metadata,
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
  sessionId: string,
  session: RemoteSignerSession,
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

  updateSession(sessionId, {
    metadata: {
      ...session.metadata,
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
  sessionId: string,
  session: RemoteSignerSession,
  event: Extract<ConnectionEvent, { type: "error" }>
): {
  logType: ConnectionLogEntry["type"];
  logStatus: ConnectionLogEntry["status"];
  message: string;
  details: Record<string, unknown>;
} {
  const message = `Error: ${event.error}`;
  const details: Record<string, unknown> = { error: event.error };

  updateSession(sessionId, {
    metadata: {
      ...session.metadata,
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
  sessionId: string,
  session: RemoteSignerSession,
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
    updateSession(sessionId, {
      metadata: {
        ...session.metadata,
        status: "active",
        lastActivityAt: Date.now(),
        lastError: null,
      },
    });
  } else {
    updateSession(sessionId, {
      metadata: {
        ...session.metadata,
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
  sessionId: string,
  session: RemoteSignerSession,
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
    updateSession(sessionId, {
      metadata: {
        ...session.metadata,
        status: "active",
        lastActivityAt: Date.now(),
        lastError: null,
      },
    });
  } else {
    updateSession(sessionId, {
      metadata: {
        ...session.metadata,
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

export function recordConnectionEvent(
  sessionId: string,
  event: ConnectionEvent
): void {
  const session = getSessionById(sessionId);
  if (!session) {
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
      result = handleConnectedEvent(sessionId, session, event);
      break;
    case "disconnected":
      result = handleDisconnectedEvent(sessionId, session, event);
      break;
    case "error":
      result = handleErrorEvent(sessionId, session, event);
      break;
    case "health_check":
      result = handleHealthCheckEvent(sessionId, session, event);
      break;
    case "reconnect":
      result = handleReconnectEvent(sessionId, session, event);
      break;
  }

  addConnectionLog(sessionId, {
    type: result.logType,
    status: result.logStatus,
    message: result.message,
    details:
      Object.keys(result.details).length > 0 ? result.details : undefined,
  });
}

// Initialize event listeners for connection state changes
if (typeof window !== "undefined") {
  // Listen to nostr-connection-stale event
  window.addEventListener("nostr-connection-stale", (() => {
    const activeSession = getActiveSession();
    if (activeSession) {
      recordConnectionEvent(activeSession.id, {
        type: "health_check",
        healthy: false,
        error: "Connection stale",
      });
    }
  }) as EventListener);

  // Listen to nostr-connection-healthy event
  window.addEventListener("nostr-connection-healthy", (() => {
    const activeSession = getActiveSession();
    if (activeSession) {
      recordConnectionEvent(activeSession.id, {
        type: "health_check",
        healthy: true,
      });
    }
  }) as EventListener);
}
