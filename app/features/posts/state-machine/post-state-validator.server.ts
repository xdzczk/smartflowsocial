/**
 * Post State Validator
 *
 * Validates that posts have currentState set.
 * Flags have been removed - only currentState is used.
 */

import { logWarning } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

import type { PostState } from "./post-state";

export interface StateInconsistency {
  postId: string;
  userId: string;
  currentState: string | null;
  inconsistencies: string[];
}

/**
 * Validate that a post has currentState set
 */
export function validatePostStateConsistency(post: {
  id: string;
  userId: string;
  currentState: string | null;
}): StateInconsistency | null {
  if (!post.currentState || post.currentState.trim() === "") {
    return {
      postId: post.id,
      userId: post.userId,
      currentState: null,
      inconsistencies: ["currentState is null or empty"],
    };
  }

  // Validate state is one of the valid states
  const validStates: PostState[] = [
    "DRAFT",
    "SCHEDULED",
    "PUBLISHING",
    "PUBLISHED",
    "FAILED",
    "CANCELLED",
  ];
  if (!validStates.includes(post.currentState as PostState)) {
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
 * Validate all posts and return inconsistencies
 */
export async function validateAllPostStates(
  limit = 1000
): Promise<StateInconsistency[]> {
  const posts = await prisma.post.findMany({
    select: {
      id: true,
      userId: true,
      currentState: true,
    },
    take: limit,
  });

  const inconsistencies: StateInconsistency[] = [];

  for (const post of posts) {
    const inconsistency = validatePostStateConsistency(post);
    if (inconsistency) {
      inconsistencies.push(inconsistency);
    }
  }

  return inconsistencies;
}

/**
 * Fix inconsistencies by setting default state
 */
export async function fixPostStateInconsistencies(
  inconsistencies: StateInconsistency[]
): Promise<{ fixed: number; errors: number }> {
  let fixed = 0;
  let errors = 0;

  for (const inconsistency of inconsistencies) {
    try {
      // Set default state to DRAFT if missing or invalid
      await prisma.post.update({
        where: { id: inconsistency.postId },
        data: {
          currentState: "DRAFT",
        },
      });
      fixed++;
    } catch (error) {
      logWarning("Failed to fix post state inconsistency", {
        postId: inconsistency.postId,
        error: error instanceof Error ? error.message : String(error),
      });
      errors++;
    }
  }

  return { fixed, errors };
}

/**
 * Backfill currentState for posts that don't have it set
 * Derives state from status enum (flags have been removed)
 */
export async function backfillCurrentState(
  limit = 1000
): Promise<{ backfilled: number; errors: number }> {
  // Find posts without currentState or with invalid currentState
  // Note: currentState is non-nullable with default, but we check for empty string and invalid states
  const posts = await prisma.post.findMany({
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
      scheduledAtUtc: true,
      publishedAt: true,
    },
    take: limit,
  });

  let backfilled = 0;
  let errors = 0;

  for (const post of posts) {
    try {
      // Derive state from publishedAt and scheduledAtUtc (flags have been removed)
      let derivedState: PostState;

      if (post.publishedAt) {
        derivedState = "PUBLISHED";
      } else if (post.scheduledAtUtc) {
        derivedState = "SCHEDULED";
      } else {
        derivedState = "DRAFT";
      }

      await prisma.post.update({
        where: { id: post.id },
        data: {
          currentState: derivedState,
        },
      });

      backfilled++;
    } catch (error) {
      logWarning("Failed to backfill post state", {
        postId: post.id,
        error: error instanceof Error ? error.message : String(error),
      });
      errors++;
    }
  }

  return { backfilled, errors };
}
