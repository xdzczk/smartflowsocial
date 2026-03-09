/**
 * Upload state machine: states, transitions, and guards.
 * Use for UI or orchestration that needs explicit upload state.
 */

export type UploadState =
  | "idle"
  | "validating"
  | "uploading"
  | "success"
  | "error";

export type UploadEvent =
  | { type: "START" }
  | { type: "VALIDATION_PASSED" }
  | { type: "VALIDATION_FAILED"; error?: string }
  | { type: "UPLOAD_COMPLETE" }
  | { type: "UPLOAD_FAILED"; error?: string }
  | { type: "RESET" };

const TRANSITIONS: Record<
  UploadState,
  Partial<Record<UploadEvent["type"], UploadState>>
> = {
  idle: {
    START: "validating",
  },
  validating: {
    VALIDATION_PASSED: "uploading",
    VALIDATION_FAILED: "error",
    RESET: "idle",
  },
  uploading: {
    UPLOAD_COMPLETE: "success",
    UPLOAD_FAILED: "error",
    RESET: "idle",
  },
  success: {
    RESET: "idle",
  },
  error: {
    START: "validating",
    RESET: "idle",
  },
};

export function transition(
  state: UploadState,
  event: UploadEvent
): UploadState {
  const next = TRANSITIONS[state][event.type];
  return next ?? state;
}

export function canStart(state: UploadState): boolean {
  return state === "idle" || state === "error";
}

export function canRetry(state: UploadState): boolean {
  return state === "error";
}

export function isTerminal(state: UploadState): boolean {
  return state === "success" || state === "error";
}

export function isInProgress(state: UploadState): boolean {
  return state === "validating" || state === "uploading";
}
