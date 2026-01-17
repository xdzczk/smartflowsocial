/**
 * LongFormPost State Machine
 *
 * Defines valid states and transitions for longform post lifecycle.
 * Prevents invalid state transitions and provides audit trail.
 */

export type LongFormPostState =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export interface LongFormPostStateTransition {
  from: LongFormPostState;
  to: LongFormPostState;
  reason: string;
  timestamp?: Date;
}

/**
 * Valid state transitions map
 */
const VALID_TRANSITIONS: Record<LongFormPostState, LongFormPostState[]> = {
  DRAFT: ["SCHEDULED", "PUBLISHED", "PUBLISHING", "CANCELLED", "FAILED"],
  SCHEDULED: ["PUBLISHING", "CANCELLED", "DRAFT"],
  PUBLISHING: ["PUBLISHED", "FAILED"],
  PUBLISHED: [], // Terminal state
  FAILED: ["SCHEDULED", "DRAFT", "CANCELLED"],
  CANCELLED: [], // Terminal state
};

/**
 * Check if a state transition is valid
 */
export function canTransitionLongFormPost(
  from: LongFormPostState,
  to: LongFormPostState
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Create a state transition (throws if invalid)
 */
export function transitionLongFormPost(
  currentState: LongFormPostState,
  targetState: LongFormPostState,
  reason: string
): LongFormPostStateTransition {
  if (!canTransitionLongFormPost(currentState, targetState)) {
    throw new Error(
      `Invalid state transition from ${currentState} to ${targetState}. Reason: ${reason}`
    );
  }

  return {
    from: currentState,
    to: targetState,
    reason,
  };
}

/**
 * Check if state is DRAFT
 */
export function isDraftStateLongForm(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: LongFormPostState | string | null | undefined
): boolean {
  if (!state) return true; // Default to draft if no state
  return state === "DRAFT";
}

/**
 * Check if state is SCHEDULED
 */
export function isScheduledStateLongForm(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: LongFormPostState | string | null | undefined
): boolean {
  if (!state) return false;
  return state === "SCHEDULED";
}

/**
 * Check if state is PUBLISHING
 */
export function isPublishingStateLongForm(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: LongFormPostState | string | null | undefined
): boolean {
  if (!state) return false;
  return state === "PUBLISHING";
}

/**
 * Check if state is PUBLISHED
 */
export function isPublishedStateLongForm(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: LongFormPostState | string | null | undefined
): boolean {
  if (!state) return false;
  return state === "PUBLISHED";
}

/**
 * Check if state is FAILED
 */
export function isFailedStateLongForm(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: LongFormPostState | string | null | undefined
): boolean {
  if (!state) return false;
  return state === "FAILED";
}

/**
 * Check if state is CANCELLED
 */
export function isCancelledStateLongForm(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: LongFormPostState | string | null | undefined
): boolean {
  if (!state) return false;
  return state === "CANCELLED";
}

/**
 * Derive isPublished flag from currentState
 * Published posts are considered "published"
 */
export function deriveIsPublishedLongForm(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  currentState: LongFormPostState | string | null | undefined
): boolean {
  if (!currentState) return false;
  return isPublishedStateLongForm(currentState);
}

/**
 * Derive isScheduled flag from currentState
 * Scheduled or publishing posts are considered "scheduled"
 */
export function deriveIsScheduledLongForm(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  currentState: LongFormPostState | string | null | undefined
): boolean {
  if (!currentState) return false;
  return (
    isScheduledStateLongForm(currentState) ||
    isPublishingStateLongForm(currentState)
  );
}

/**
 * Derive draft flag from currentState
 * Only DRAFT state is considered a draft
 */
export function deriveIsDraftLongForm(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  currentState: LongFormPostState | string | null | undefined
): boolean {
  if (!currentState) return true; // Default to draft if no state
  return isDraftStateLongForm(currentState);
}

/**
 * Get human-readable status text from currentState
 */
export function getStatusTextFromStateLongForm(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  currentState: LongFormPostState | string | null | undefined
): string {
  if (!currentState) return "Draft";

  switch (currentState) {
    case "DRAFT":
      return "Draft";
    case "SCHEDULED":
      return "Scheduled";
    case "PUBLISHING":
      return "Publishing";
    case "PUBLISHED":
      return "Published";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Unknown";
  }
}
