/**
 * LongFormPost State Validator
 *
 * Validates that longform posts have currentState set.
 * Flags are still present but should be synced with currentState.
 */

import { logWarning } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

import type { LongFormPostState } from "./longform-post-state";

export interface LongFormPostStateInconsistency {
  postId: string;
  userId: string;
  currentState: string | null;
  inconsistencies: string[];
}

/**
 * Validate that a longform post has currentState set
 * Flags have been removed - only currentState is used.
 */
export function validateLongFormPostStateConsistency(post: {
  id: string;
  userId: string;
  currentState: string | null;
}): LongFormPostStateInconsistency | null {
  if (!post.currentState || post.currentState.trim() === "") {
    return {
      postId: post.id,
      userId: post.userId,
      currentState: null,
      inconsistencies: ["currentState is null or empty"],
    };
  }

  // Validate state is one of the valid states
  const validStates: LongFormPostState[] = [
    "DRAFT",
    "SCHEDULED",
    "PUBLISHING",
    "PUBLISHED",
    "FAILED",
    "CANCELLED",
  ];
  if (!validStates.includes(post.currentState as LongFormPostState)) {
    return {
      postId: post.id,
      userId: post.userId,
      currentState: post.currentState,
      inconsistencies: [`Invalid currentState: ${post.currentState}`],
    };
  }

  return null;
}

/**
 * Validate all longform posts and return inconsistencies
 */
export async function validateAllLongFormPostStates(
  limit = 1000
): Promise<LongFormPostStateInconsistency[]> {
  const posts = await prisma.longFormPost.findMany({
    select: {
      id: true,
      userId: true,
      currentState: true,
    },
    take: limit,
  });

  const inconsistencies: LongFormPostStateInconsistency[] = [];

  for (const post of posts) {
    const inconsistency = validateLongFormPostStateConsistency(post);
    if (inconsistency) {
      inconsistencies.push(inconsistency);
    }
  }

  return inconsistencies;
}

/**
 * Fix inconsistencies by syncing flags with currentState
 */
export async function fixLongFormPostStateInconsistencies(
  inconsistencies: LongFormPostStateInconsistency[]
): Promise<{ fixed: number; errors: number }> {
  let fixed = 0;
  let errors = 0;

  for (const inconsistency of inconsistencies) {
    try {
      // Set default state to DRAFT if missing or invalid
      await prisma.longFormPost.update({
        where: { id: inconsistency.postId },
        data: {
          currentState: "DRAFT",
        },
      });
      fixed++;
    } catch (error) {
      logWarning("Failed to fix longform post state inconsistency", {
        postId: inconsistency.postId,
        error: error instanceof Error ? error.message : String(error),
      });
      errors++;
    }
  }

  return { fixed, errors };
}

/**
 * Backfill currentState for longform posts that don't have it set
 * Derives state from flags (reverse of deriveIs* functions)
 */
export async function backfillLongFormPostCurrentState(
  limit = 1000
): Promise<{ backfilled: number; errors: number }> {
  // Find posts without currentState or with invalid currentState
  // Note: currentState is non-nullable with default, but we check for empty string and invalid states
  const posts = await prisma.longFormPost.findMany({
    where: {
      OR: [
        { currentState: "" },
        {
          currentState: {
            notIn: [
              "DRAFT",
              "SCHEDULED",
              "PUBLISHING",
              "PUBLISHED",
              "FAILED",
              "CANCELLED",
            ] as string[],
          },
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      status: true,
    },
    take: limit,
  });

  let backfilled = 0;
  let errors = 0;

  for (const post of posts) {
    try {
      // Derive state from status enum (flags have been removed)
      let derivedState: LongFormPostState;

      if (post.status === "ACTIVE") {
        derivedState = "PUBLISHED";
      } else if (post.status === "SCHEDULED") {
        derivedState = "SCHEDULED";
      } else {
        derivedState = "DRAFT";
      }

      await prisma.longFormPost.update({
        where: { id: post.id },
        data: {
          currentState: derivedState,
        },
      });

      backfilled++;
    } catch (error) {
      logWarning("Failed to backfill longform post state", {
        postId: post.id,
        error: error instanceof Error ? error.message : String(error),
      });
      errors++;
    }
  }

  return { backfilled, errors };
}
