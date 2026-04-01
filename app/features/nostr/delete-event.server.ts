import type { NostrEvent } from "~/features/nostr/types";
import type {
  LongFormDeleteRequestedPayload,
  PostDeleteRequestedPayload,
} from "~/infra/outbox/outbox.server";
import { BRAND_DELETE_REASON } from "~/lib/brand";

const NOSTR_DELETE_EVENT_KIND = 5;
const DEFAULT_DELETE_REASON = BRAND_DELETE_REASON;

interface Kind5DeletionDraft {
  unsignedEvent: NostrEvent;
  expectedPubkey: string;
}

function normalizeReason(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_DELETE_REASON;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildPostKind5DeleteDraft(
  payload: PostDeleteRequestedPayload,
  createdAtSec?: number
): Kind5DeletionDraft | null {
  if (
    !isNonEmptyString(payload.originalEventId) ||
    !isNonEmptyString(payload.originalEventPubkey)
  ) {
    return null;
  }

  return {
    expectedPubkey: payload.originalEventPubkey,
    unsignedEvent: {
      kind: NOSTR_DELETE_EVENT_KIND,
      created_at: createdAtSec ?? Math.floor(Date.now() / 1000),
      tags: [["e", payload.originalEventId]],
      content: normalizeReason(payload.reason),
    },
  };
}

export function buildLongFormKind5DeleteDraft(
  payload: LongFormDeleteRequestedPayload,
  createdAtSec?: number
): Kind5DeletionDraft | null {
  if (
    !isNonEmptyString(payload.aCoordinate) ||
    !isNonEmptyString(payload.originalEventPubkey)
  ) {
    return null;
  }

  const tags: string[][] = [["a", payload.aCoordinate]];
  if (isNonEmptyString(payload.originalEventId)) {
    tags.push(["e", payload.originalEventId]);
  }

  return {
    expectedPubkey: payload.originalEventPubkey,
    unsignedEvent: {
      kind: NOSTR_DELETE_EVENT_KIND,
      created_at: createdAtSec ?? Math.floor(Date.now() / 1000),
      tags,
      content: normalizeReason(payload.reason),
    },
  };
}
