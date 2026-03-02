export type ExistingReconnectTrigger =
  | "initial"
  | "foreground_resume"
  | "manual_retry";

export function isConnectionLifecycleErrorMessage(message: string): boolean {
  const msgLower = message.toLowerCase();
  return (
    msgLower.includes("subscription closed") ||
    msgLower.includes("websocket") ||
    msgLower.includes("connection") ||
    msgLower.includes("timeout") ||
    msgLower.includes("closed")
  );
}

export function shouldCancelExistingReconnectOnHidden(state: string): boolean {
  return state === "reconnecting_existing";
}

export function shouldResumeExistingReconnectOnVisible(input: {
  openMode: "default" | "new_session";
  wasHiddenDuringExistingReconnect: boolean;
  inFlightExistingReconnect: boolean;
  hasValidExistingSession: boolean;
}): boolean {
  return (
    input.openMode !== "new_session" &&
    input.wasHiddenDuringExistingReconnect &&
    !input.inFlightExistingReconnect &&
    input.hasValidExistingSession
  );
}

export function shouldDeferExistingReconnectTerminalError(input: {
  lifecycleError: boolean;
  wasHiddenDuringExistingReconnect: boolean;
  trigger: ExistingReconnectTrigger;
  foregroundResumeAttemptFailed: boolean;
}): boolean {
  if (!input.lifecycleError || !input.wasHiddenDuringExistingReconnect) {
    return false;
  }

  if (input.trigger === "foreground_resume") {
    return false;
  }

  return !input.foregroundResumeAttemptFailed;
}

export function isExistingReconnectRunStale(input: {
  currentRunId: number;
  runId: number;
}): boolean {
  return input.currentRunId !== input.runId;
}
