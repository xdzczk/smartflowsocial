/**
 * Reconnect dialog state machine: states and transitions.
 * Controller dispatches actions; this module holds the state type and transition logic.
 */

export type ReconnectState =
  | "idle"
  | "reconnecting_existing"
  | "uri_ready"
  | "waiting"
  | "connected"
  | "failed";

export type ReconnectAction =
  | { type: "reset" }
  | { type: "start_reconnecting_existing" }
  | { type: "set_uri_ready" }
  | { type: "set_waiting" }
  | { type: "set_connected" }
  | { type: "set_failed" }
  | { type: "set_idle"; clearError?: boolean }
  | { type: "set_error"; error: string | null };

export const RECONNECT_INITIAL_STATE: ReconnectState = "idle";

export function reconnectReducer(
  state: ReconnectState,
  action: ReconnectAction
): ReconnectState {
  switch (action.type) {
    case "reset":
      return "idle";
    case "start_reconnecting_existing":
      return "reconnecting_existing";
    case "set_uri_ready":
      return "uri_ready";
    case "set_waiting":
      return "waiting";
    case "set_connected":
      return "connected";
    case "set_failed":
      return "failed";
    case "set_idle":
      return "idle";
    case "set_error":
      return "failed";
    default:
      return state;
  }
}

/** Helpers for common transitions (controller can use dispatch or these). */
export const reconnectTransitions = {
  toIdle: (): ReconnectAction => ({ type: "set_idle" }),
  toReconnectingExisting: (): ReconnectAction => ({
    type: "start_reconnecting_existing",
  }),
  toWaiting: (): ReconnectAction => ({ type: "set_waiting" }),
  toConnected: (): ReconnectAction => ({ type: "set_connected" }),
  toFailed: (): ReconnectAction => ({ type: "set_failed" }),
  toError: (error: string | null): ReconnectAction => ({
    type: "set_error",
    error,
  }),
  reset: (): ReconnectAction => ({ type: "reset" }),
} as const;

export function isReconnectingExisting(state: ReconnectState): boolean {
  return state === "reconnecting_existing";
}

export function isWaiting(state: ReconnectState): boolean {
  return state === "waiting";
}

export function isIdle(state: ReconnectState): boolean {
  return state === "idle";
}
