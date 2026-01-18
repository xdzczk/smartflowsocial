/**
 * Post State Machine
 *
 * Defines valid states and transitions for post lifecycle.
 * Prevents invalid state transitions and provides audit trail.
 */

import { nowUTC, toDate } from "~/lib/temporal";

export type PostState =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

export interface PostStateTransition {
  from: PostState;
  to: PostState;
  reason: string;
  timestamp: Date;
}

/**
 * Valid state transitions map
 */
const VALID_TRANSITIONS: Record<PostState, PostState[]> = {
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
export function canTransition(from: PostState, to: PostState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Create a state transition (throws if invalid)
 */
export function transitionPost(
  currentState: PostState,
  targetState: PostState,
  reason: string
): PostStateTransition {
  if (!canTransition(currentState, targetState)) {
    throw new Error(
      `Invalid transition from ${currentState} to ${targetState}. Reason: ${reason}`
    );
  }

  return {
    from: currentState,
    to: targetState,
    reason,
    timestamp: toDate(nowUTC()),
  };
}

/**
 * Get valid next states for a given state
 */
export function getValidNextStates(state: PostState): PostState[] {
  return VALID_TRANSITIONS[state];
}

/**
 * Helper functions to derive boolean flags from currentState
 * These functions make currentState the single source of truth
 */

/**
 * Check if post is in draft state
 */
export function isDraftState(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: PostState | string
): boolean {
  return state === "DRAFT";
}

/**
 * Check if post is scheduled
 */
export function isScheduledState(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: PostState | string
): boolean {
  return state === "SCHEDULED";
}

/**
 * Check if post is currently publishing
 */
export function isPublishingState(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: PostState | string
): boolean {
  return state === "PUBLISHING";
}

/**
 * Check if post is published
 */
export function isPublishedState(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: PostState | string
): boolean {
  return state === "PUBLISHED";
}

/**
 * Check if post failed
 */
export function isFailedState(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: PostState | string
): boolean {
  return state === "FAILED";
}

/**
 * Check if post is cancelled
 */
export function isCancelledState(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  state: PostState | string
): boolean {
  return state === "CANCELLED";
}

/**
 * Derive isPosted flag from currentState
 * Published posts are considered "posted"
 */

export function deriveIsPosted(
  currentState: string | null | undefined
): boolean {
  if (!currentState) return false;
  return isPublishedState(currentState);
}

/**
 * Derive isScheduled flag from currentState
 * Scheduled or publishing posts are considered "scheduled"
 */

export function deriveIsScheduled(
  currentState: string | null | undefined
): boolean {
  if (!currentState) return false;
  return isScheduledState(currentState) || isPublishingState(currentState);
}

/**
 * Derive draft flag from currentState
 * Only DRAFT state is considered a draft
 */

export function deriveIsDraft(
  currentState: string | null | undefined
): boolean {
  if (!currentState) return true; // Default to draft if no state
  return isDraftState(currentState);
}

/**
 * Get human-readable status text from currentState
 */
export function getStatusTextFromState(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- string is included for runtime safety with database values
  currentState: PostState | string | null | undefined
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
      return "Posted";
    case "FAILED":
      return "Failed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Unknown";
  }
}
