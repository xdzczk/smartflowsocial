/**
 * LongFormPost shared helpers - used by both commands and queries.
 * Exports: type guards, JSON→SignedEvent conversion, delete reference extraction,
 * outbox constraint error detection, and Nostr delete-events flag.
 */

import type { Prisma } from "@prisma/client";

import type { SignedEvent } from "~/features/nostr/types";
import { BRAND_DELETE_REASON } from "~/lib/brand";
import { env } from "~/lib/env.server";

export const DELETE_EVENT_SCHEMA_VERSION = "1.0";
export const DEFAULT_DELETE_REASON = BRAND_DELETE_REASON;

export function isNostrDeleteEventsEnabled(): boolean {
  const raw = env.ENABLE_NOSTR_DELETE_EVENTS;
  if (!raw) return false;
  return ["1", "true", "yes", "y", "on", "enabled"].includes(
    raw.trim().toLowerCase()
  );
}

export function isOutboxEventTypeConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error.message.includes("OutboxEvent_eventType_check")) {
    return true;
  }
  const errWithCause = error as Error & {
    cause?: { originalCode?: string; message?: string };
  };
  const cause = errWithCause.cause;
  if (!cause) {
    return false;
  }
  return (
    cause.originalCode === "23514" &&
    String(cause.message ?? "").includes("OutboxEvent_eventType_check")
  );
}

/**
 * Type guard to check if a value is a SignedEvent
 */
export function isSignedEvent(value: unknown): value is SignedEvent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const event = value as Record<string, unknown>;

  if (
    !("id" in event) ||
    !("pubkey" in event) ||
    !("created_at" in event) ||
    !("kind" in event) ||
    !("tags" in event) ||
    !("content" in event) ||
    !("sig" in event)
  ) {
    return false;
  }

  return (
    typeof event["id"] === "string" &&
    typeof event["pubkey"] === "string" &&
    typeof event["created_at"] === "number" &&
    typeof event["kind"] === "number" &&
    Array.isArray(event["tags"]) &&
    typeof event["content"] === "string" &&
    typeof event["sig"] === "string"
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

export function extractLongFormDeleteReference(post: {
  signedEvent: Prisma.JsonValue | null;
  nostrEvent: Prisma.JsonValue | null;
  nostrEventId: string | null;
}): {
  originalEventPubkey: string;
  originalEventId?: string;
  aCoordinate: string;
} | null {
  const signed = toSignedEvent(post.signedEvent);
  const rawNostr =
    post.nostrEvent && typeof post.nostrEvent === "object"
      ? (post.nostrEvent as { id?: unknown; pubkey?: unknown; tags?: unknown })
      : null;
  const pubkey =
    signed?.pubkey ??
    (rawNostr && typeof rawNostr.pubkey === "string" ? rawNostr.pubkey : null);
  if (!pubkey) return null;

  const tags = Array.isArray(signed?.tags)
    ? signed.tags
    : Array.isArray(rawNostr?.tags)
      ? (rawNostr.tags as unknown[])
      : [];
  const dTagEntry = tags.find(
    (tag): tag is string[] =>
      Array.isArray(tag) &&
      tag.length >= 2 &&
      tag[0] === "d" &&
      typeof tag[1] === "string" &&
      tag[1].trim().length > 0
  );
  if (!dTagEntry?.[1]) return null;

  const originalEventId =
    signed?.id ??
    (rawNostr && typeof rawNostr.id === "string" ? rawNostr.id : null) ??
    post.nostrEventId ??
    undefined;

  return {
    originalEventPubkey: pubkey,
    originalEventId,
    aCoordinate: `30023:${pubkey}:${dTagEntry[1]}`,
  };
}
