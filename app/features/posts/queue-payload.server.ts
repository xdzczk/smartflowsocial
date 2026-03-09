/**
 * Queue payload and event helpers for queue workers.
 * Extracted from queues.server.ts to keep worker file focused on orchestration.
 */

import type { SignedEvent } from "~/features/nostr/types";
import { fromPrismaDate, toUnixTimestamp } from "~/lib/temporal";

import type { Prisma } from "./data/posts-prisma-types.server";

export interface PostData {
  id: string;
  userId: string;
  signedEvent: Prisma.JsonValue;
  scheduledFor: string;
}

/**
 * Extract scheduledFor value from post object, handling both legacy and new fields
 */
export async function extractScheduledFor(
  post: Record<string, unknown>
): Promise<string | null> {
  if ("scheduledAtUtc" in post && post["scheduledAtUtc"] instanceof Date) {
    return Math.floor(post["scheduledAtUtc"].getTime() / 1000).toString();
  }

  if (!("scheduledFor" in post)) {
    return null;
  }

  const scheduledForValue = post["scheduledFor"];
  if (scheduledForValue instanceof Date) {
    return Math.floor(scheduledForValue.getTime() / 1000).toString();
  }

  if (typeof scheduledForValue !== "string") {
    return null;
  }

  if (/^\d+$/.test(scheduledForValue)) {
    return scheduledForValue;
  }

  try {
    const { fromISOString } = await import("~/lib/temporal");
    const zonedDateTime = fromISOString(scheduledForValue, "UTC");
    return String(toUnixTimestamp(zonedDateTime));
  } catch {
    try {
      const { fromDate } = await import("~/lib/temporal");
      const date = new Date(scheduledForValue);
      if (!isNaN(date.getTime())) {
        const zonedDateTime = fromDate(date, "UTC");
        return String(toUnixTimestamp(zonedDateTime));
      }
    } catch {
      // If parsing fails, leave as is
    }
  }

  return null;
}

export async function extractPostData(post: unknown): Promise<PostData | null> {
  if (typeof post !== "object" || post === null) {
    return null;
  }

  const postId = "id" in post && typeof post.id === "string" ? post.id : null;
  const postUserId =
    "userId" in post && typeof post.userId === "string" ? post.userId : null;
  const postSignedEvent = "signedEvent" in post ? post.signedEvent : null;

  const postScheduledFor = await extractScheduledFor(
    post as Record<string, unknown>
  );

  if (!postUserId || !postSignedEvent || !postScheduledFor || !postId) {
    return null;
  }

  return {
    id: postId,
    userId: postUserId,
    signedEvent: postSignedEvent,
    scheduledFor: postScheduledFor,
  };
}

/**
 * Type guard to check if value is a SignedEvent
 */
export function isSignedEvent(value: unknown): value is SignedEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "pubkey" in value &&
    "created_at" in value &&
    "kind" in value &&
    "tags" in value &&
    "content" in value &&
    "sig" in value
  );
}

/**
 * Convert Prisma JsonValue to SignedEvent if valid
 */
export function toSignedEvent(
  value: Prisma.JsonValue | null | undefined
): SignedEvent | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return isSignedEvent(value) ? value : null;
}

export function computeScheduledForUnix(
  scheduledAtUtc: Date | null | undefined
): number {
  if (!scheduledAtUtc) return Math.floor(Date.now() / 1000);
  const zoned = fromPrismaDate(scheduledAtUtc, "UTC");
  return zoned ? toUnixTimestamp(zoned) : Math.floor(Date.now() / 1000);
}

/** Delay helper for retries */
export function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
