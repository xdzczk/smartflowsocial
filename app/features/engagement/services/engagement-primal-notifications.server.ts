/**
 * Primal `get_notifications` payload parsing: flatten rows, kind-1 extraction,
 * strict quote-repost detection, and global mention list building.
 */

import { fetchFromCache } from "~/features/cache";
import { logError } from "~/lib/error-logger.server";

import {
  doesEventMentionUser,
  inferThreadRootEventIdFromTags,
  isQuotePost,
  shouldExcludeKind1FromGlobalMentionInbox,
} from "../engagement.server";
import type {
  NotificationEvent,
  NotificationMention,
  NostrTag,
} from "../types";

/** When `false`, skip Primal `get_notifications` (e.g. self-hosted cache without this API). */
export function isPrimalGetNotificationsCallEnabled(): boolean {
  return process.env["MENTIONS_USE_PRIMAL_GET_NOTIFICATIONS"] !== "false";
}

/**
 * Fetches global notifications; never throws. Used in parallel with other engagement work.
 */
export async function loadPrimalGetNotificationsResult(options: {
  pubkey: string;
  limit: number;
}): Promise<{
  data: unknown;
  getNotificationsFailed: boolean;
  primalNotificationsSkipped: boolean;
}> {
  if (!isPrimalGetNotificationsCallEnabled()) {
    return {
      data: [],
      getNotificationsFailed: false,
      primalNotificationsSkipped: true,
    };
  }
  try {
    const data = await fetchFromCache("get_notifications", {
      pubkey: options.pubkey,
      limit: options.limit,
    });
    return {
      data,
      getNotificationsFailed: false,
      primalNotificationsSkipped: false,
    };
  } catch (error) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      message:
        "Primal get_notifications request failed (relay fallback may be used)",
    });
    return {
      data: [],
      getNotificationsFailed: true,
      primalNotificationsSkipped: false,
    };
  }
}

/** Extract kind-1 event from Primal response item (EVENT tuple, raw event, or { event } wrapper). */
export function getKind1EventFromItem(
  item: unknown
): { kind: number; tags?: NostrTag[]; [key: string]: unknown } | null {
  let raw: unknown = item;
  if (
    typeof item === "object" &&
    item !== null &&
    !Array.isArray(item) &&
    "event" in item
  ) {
    raw = item.event;
  }
  if (
    Array.isArray(raw) &&
    raw[0] === "EVENT" &&
    typeof raw[2] === "object" &&
    raw[2] !== null &&
    !Array.isArray(raw[2])
  ) {
    const ev = raw[2] as { kind?: number; tags?: NostrTag[] };
    return ev.kind === 1
      ? (ev as { kind: number; tags?: NostrTag[]; [key: string]: unknown })
      : null;
  }
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    const ev = raw as { kind?: number; tags?: NostrTag[] };
    return ev.kind === 1
      ? (ev as { kind: number; tags?: NostrTag[]; [key: string]: unknown })
      : null;
  }
  return null;
}

/** Normalize Primal `get_notifications` payload to a list of row items. */
export function flattenPrimalNotificationItems(
  notificationsData: unknown
): unknown[] {
  let items: unknown[] = [];
  if (Array.isArray(notificationsData)) {
    if (notificationsData.length > 0) {
      const first: unknown = notificationsData[0];
      if (
        typeof first === "object" &&
        first !== null &&
        !Array.isArray(first) &&
        ("notifications" in first || "data" in first || "events" in first)
      ) {
        const obj = first as Record<string, unknown>;
        const notifications: unknown = obj["notifications"];
        const data: unknown = obj["data"];
        const events: unknown = obj["events"];
        if (Array.isArray(notifications)) items = notifications as unknown[];
        else if (Array.isArray(data)) items = data as unknown[];
        else if (Array.isArray(events)) items = events as unknown[];
      } else {
        items = notificationsData;
      }
    }
  } else if (
    notificationsData &&
    typeof notificationsData === "object" &&
    !Array.isArray(notificationsData)
  ) {
    const obj = notificationsData as Record<string, unknown>;
    if (Array.isArray(obj["notifications"])) items = obj["notifications"];
    else if (Array.isArray(obj["data"])) items = obj["data"];
    else if (Array.isArray(obj["events"])) items = obj["events"];
  }
  return items;
}

/**
 * True when this row is a kind-1 quote repost that p-tags the user.
 * Requires an `e` tag with marker `mention` plus the same content heuristic as thread quote detection.
 */
export function isPrimalItemQuoteRepostMentioningUser(
  item: unknown,
  userPubkeyHex: string
): boolean {
  const event = getKind1EventFromItem(item);
  if (!event) return false;
  const ev = event as {
    id?: unknown;
    pubkey?: unknown;
    content?: unknown;
    kind?: number;
    tags?: NostrTag[];
  };
  if (
    !ev.id ||
    typeof ev.id !== "string" ||
    !ev.pubkey ||
    typeof ev.pubkey !== "string" ||
    typeof ev.content !== "string"
  ) {
    return false;
  }
  const authorLower = (ev.pubkey ?? "").toLowerCase();
  const userLower = userPubkeyHex.toLowerCase();
  if (authorLower === userLower) return false;
  const tags = Array.isArray(ev.tags) ? ev.tags : [];
  const pTagsWithUser = tags.filter(
    (tag: NostrTag) =>
      tag[0] === "p" && (tag[1] ?? "").toLowerCase() === userLower
  );
  if (pTagsWithUser.length === 0) return false;

  const eTags = tags.filter((tag: NostrTag) => tag[0] === "e");
  for (const eTag of eTags) {
    const marker = (eTag[3] ?? "").toLowerCase();
    if (marker !== "mention") continue;
    if (
      isQuotePost(
        {
          content: ev.content,
          tags: tags,
          kind: ev.kind,
          id: ev.id,
          pubkey: ev.pubkey,
        },
        eTag
      )
    ) {
      return true;
    }
  }
  return false;
}

export function extractQuoteRepostEventsFromPrimal(
  notificationsData: unknown,
  userPubkeyHex: string
): NotificationEvent[] {
  const items = flattenPrimalNotificationItems(notificationsData);
  if (items.length === 0) return [];
  const result: NotificationEvent[] = [];
  for (const item of items) {
    if (Array.isArray(item) && item[0] === "EOSE") continue;
    if (!isPrimalItemQuoteRepostMentioningUser(item, userPubkeyHex)) continue;
    const event = getKind1EventFromItem(item);
    if (
      event &&
      typeof event === "object" &&
      "id" in event &&
      "pubkey" in event
    )
      result.push(event as unknown as NotificationEvent);
  }
  return result;
}

export function buildGlobalMentionNotificationsFromPrimal(
  notificationsData: unknown,
  userPubkeyHex: string,
  excludeEventIds: Set<string>,
  userPublishedEventIds: Set<string>
): NotificationMention[] {
  const items = flattenPrimalNotificationItems(notificationsData);
  const userLower = userPubkeyHex.toLowerCase();
  const result: NotificationMention[] = [];

  for (const item of items) {
    if (Array.isArray(item) && item[0] === "EOSE") continue;
    const ev = getKind1EventFromItem(item);
    if (!ev) continue;
    const eventId = ev["id"];
    const authorPk = ev["pubkey"];
    if (typeof eventId !== "string" || typeof authorPk !== "string") {
      continue;
    }
    if (authorPk.toLowerCase() === userLower) continue;
    if (excludeEventIds.has(eventId)) continue;

    const rawContent = ev["content"];
    const content = typeof rawContent === "string" ? rawContent : "";
    const tags = Array.isArray(ev.tags) ? ev.tags : [];
    if (!doesEventMentionUser(content, tags, userPubkeyHex)) continue;
    if (shouldExcludeKind1FromGlobalMentionInbox(tags, userPublishedEventIds)) {
      continue;
    }

    const createdAtRaw = ev["created_at"];
    const createdAt =
      typeof createdAtRaw === "number"
        ? createdAtRaw
        : typeof createdAtRaw === "string"
          ? parseInt(createdAtRaw, 10) || 0
          : 0;

    const originalEventId = inferThreadRootEventIdFromTags(tags, eventId);

    result.push({
      type: "mention",
      id: eventId,
      eventId,
      content,
      createdAt,
      pubkey: authorPk,
      originalEventId,
    });
  }

  return result.sort((x, y) => y.createdAt - x.createdAt);
}
