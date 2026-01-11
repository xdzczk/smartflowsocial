/**
 * Post State Machine
 *
 * Defines valid states and transitions for post lifecycle.
 * Prevents invalid state transitions and provides audit trail.
 */

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
  DRAFT: ["SCHEDULED", "PUBLISHED", "CANCELLED"],
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
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
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
    timestamp: new Date(),
  };
}

/**
 * Get valid next states for a given state
 */
export function getValidNextStates(state: PostState): PostState[] {
  return VALID_TRANSITIONS[state] ?? [];
}
