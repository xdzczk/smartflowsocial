/**
 * Derives content type vs relationship semantics for Post Detail Modal (V2.2).
 * Pure functions  -  safe for client and server.
 */

import * as nip27 from "nostr-tools/nip27";

import type { SignedEvent } from "~/features/nostr/types";

import type { PostDetailModalPost } from "./post-detail-helpers";
import {
  getPostKind,
  getPrimaryNoteText,
  getThreadGroupId,
} from "./post-detail-helpers";
import type { PostDetailContentVariant } from "./resolve-post-detail-variant";
import { isPostPoll } from "./resolve-post-detail-variant";

export type PostDetailContentType = "post" | "poll" | "article";

export type PostDetailRelationshipType =
  | "original"
  | "reply"
  | "quote"
  | "repost"
  | "thread_item";

/** Spec labels for header chip (relationship); omit when original. */
export const RELATIONSHIP_CHIP_LABEL: Record<
  Exclude<PostDetailRelationshipType, "original">,
  string
> = {
  reply: "Reply",
  quote: "Quote",
  repost: "Repost",
  thread_item: "Thread item",
};

function getSignedEvent(post: PostDetailModalPost): SignedEvent | null {
  const se = post.signedEvent;
  if (!se || typeof se !== "object" || !("kind" in se)) return null;
  const k = (se as { kind?: unknown }).kind;
  if (typeof k !== "number") return null;
  return se as SignedEvent;
}

function contentEmbedsQuotedId(
  content: string | undefined,
  quotedEventIdHex: string | undefined
): boolean {
  if (!content || !quotedEventIdHex) return false;
  try {
    for (const block of nip27.parse(content)) {
      if (block.type !== "reference") continue;
      const ptr = block.pointer;
      if (
        "id" in ptr &&
        typeof ptr.id === "string" &&
        ptr.id === quotedEventIdHex
      ) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Matches `isQuotePost` in engagement.server.ts (client-safe duplicate).
 */
export function isQuoteLikeKind1(
  event: { content?: string; tags?: string[][] },
  targetETag: string[] | undefined
): boolean {
  if (!targetETag) return false;
  const marker = targetETag[3];
  if (marker !== "mention") return false;
  const eventContent = event.content ?? "";
  const quotedId = targetETag[1];
  return (
    eventContent.includes("nostr:nevent") ||
    eventContent.includes("nostr:note") ||
    eventContent.includes("nostr:naddr") ||
    contentEmbedsQuotedId(eventContent, quotedId)
  );
}

function findMentionETag(tags: string[][] | undefined): string[] | undefined {
  const eTags = (tags ?? []).filter((t) => t[0] === "e");
  return eTags.find(
    (t) => typeof t[3] === "string" && t[3].toLowerCase() === "mention"
  );
}

function getKind6RepostedEventId(se: SignedEvent): string | null {
  if (se.kind !== 6) return null;
  const eTag = se.tags.find((t) => t[0] === "e");
  const id = eTag?.[1];
  return typeof id === "string" && id.length > 0 ? id : null;
}

function getQuotedEventIdFromKind1(se: SignedEvent): string | null {
  if (se.kind !== 1) return null;
  const mention = findMentionETag(se.tags);
  const id = mention?.[1];
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** NIP-10: prefer explicit reply marker, else last e tag, else first. */
function inferReplyParentEventId(se: SignedEvent): string | null {
  if (se.kind !== 1) return null;
  const eTags = se.tags.filter((t) => t[0] === "e");
  const replyTag = [...eTags]
    .reverse()
    .find((t) => typeof t[3] === "string" && t[3].toLowerCase() === "reply");
  if (replyTag?.[1]) return replyTag[1];
  const rootTag = eTags.find(
    (t) => typeof t[3] === "string" && t[3].toLowerCase() === "root"
  );
  if (rootTag?.[1]) return rootTag[1];
  if (eTags.length === 1 && eTags[0]?.[1]) return eTags[0][1];
  return null;
}

function firstPTagPubkey(se: SignedEvent | null): string | null {
  if (!se?.tags) return null;
  const p = se.tags.find((t) => t[0] === "p");
  const pk = p?.[1];
  return typeof pk === "string" && pk.length > 0 ? pk : null;
}

function hasQuoteForeignKeys(post: PostDetailModalPost): boolean {
  if ("quoteOfPostId" in post && post.quoteOfPostId) return true;
  if ("quoteOfLongFormPostId" in post && post.quoteOfLongFormPostId)
    return true;
  return false;
}

function hasRepostForeignKeys(post: PostDetailModalPost): boolean {
  return Boolean("repostOfPostId" in post && post.repostOfPostId);
}

function hasReplyForeignKeys(post: PostDetailModalPost): boolean {
  if ("replyToEventId" in post && post.replyToEventId) return true;
  if ("replyToPostId" in post && post.replyToPostId) return true;
  return false;
}

export function derivePostDetailSemantics(args: {
  post: PostDetailModalPost;
  type: "draft" | "published" | "scheduled";
  nip88PollsEnabled: boolean;
  layoutVariant: PostDetailContentVariant;
}): {
  contentType: PostDetailContentType;
  relationshipType: PostDetailRelationshipType;
  relationshipChipLabel: string | null;
  parentEventId: string | null;
  quotedEventId: string | null;
  repostedEventId: string | null;
  /** First p tag on source / parent for display hints */
  relatedPubkeyHex: string | null;
} {
  const { post, type, nip88PollsEnabled, layoutVariant } = args;

  const contentType: PostDetailContentType = isPostPoll({
    nip88PollsEnabled,
    post,
    type,
  })
    ? "poll"
    : "post";

  const se = getSignedEvent(post);
  const postKind = getPostKind(post);
  const threadGroupId = getThreadGroupId(post);

  const repostedFromKind6 = se ? getKind6RepostedEventId(se) : null;
  const isKind6 = se?.kind === 6;

  // 1–2: Repost
  if (
    isKind6 ||
    repostedFromKind6 ||
    postKind === "REPOST" ||
    (post.repost === true && hasRepostForeignKeys(post))
  ) {
    return {
      contentType,
      relationshipType: "repost",
      relationshipChipLabel: RELATIONSHIP_CHIP_LABEL.repost,
      parentEventId: null,
      quotedEventId: null,
      repostedEventId: repostedFromKind6,
      relatedPubkeyHex: firstPTagPubkey(se),
    };
  }

  // 3–4: Quote (DB or NIP-10 mention + quote body)
  const mentionTag = se ? findMentionETag(se.tags) : undefined;
  const quoteFromEvent =
    se?.kind === 1 &&
    mentionTag &&
    isQuoteLikeKind1({ content: se.content, tags: se.tags }, mentionTag);

  if (
    postKind === "QUOTE" ||
    hasQuoteForeignKeys(post) ||
    Boolean(quoteFromEvent)
  ) {
    const quotedEventId =
      (se ? getQuotedEventIdFromKind1(se) : null) ??
      (mentionTag?.[1] && typeof mentionTag[1] === "string"
        ? mentionTag[1]
        : null);
    return {
      contentType,
      relationshipType: "quote",
      relationshipChipLabel: RELATIONSHIP_CHIP_LABEL.quote,
      parentEventId: null,
      quotedEventId,
      repostedEventId: null,
      relatedPubkeyHex: firstPTagPubkey(se),
    };
  }

  // 5: Thread item (composed thread segments)
  if (threadGroupId || postKind === "THREAD" || layoutVariant === "thread") {
    return {
      contentType,
      relationshipType: "thread_item",
      relationshipChipLabel: RELATIONSHIP_CHIP_LABEL.thread_item,
      parentEventId: null,
      quotedEventId: null,
      repostedEventId: null,
      relatedPubkeyHex: null,
    };
  }

  // 6–7: Reply (quote branch above already returned when NIP-10 quote)
  if (
    postKind === "REPLY" ||
    hasReplyForeignKeys(post) ||
    (se?.kind === 1 && inferReplyParentEventId(se))
  ) {
    const replyRaw = "replyToEventId" in post ? post.replyToEventId : undefined;
    const replyToId =
      typeof replyRaw === "string" && replyRaw.length > 0 ? replyRaw : null;
    const inferredParent = se?.kind === 1 ? inferReplyParentEventId(se) : null;
    const parentEventId = replyToId ?? inferredParent;
    return {
      contentType,
      relationshipType: "reply",
      relationshipChipLabel: RELATIONSHIP_CHIP_LABEL.reply,
      parentEventId,
      quotedEventId: null,
      repostedEventId: null,
      relatedPubkeyHex: firstPTagPubkey(se),
    };
  }

  return {
    contentType,
    relationshipType: "original",
    relationshipChipLabel: null,
    parentEventId: null,
    quotedEventId: null,
    repostedEventId: null,
    relatedPubkeyHex: null,
  };
}

/** Primary header label: Post | Poll (not relationship  -  use chip for that). */
export function getPrimaryContentTypeLabel(args: {
  innerVariant: Exclude<PostDetailContentVariant, "thread">;
}): string {
  if (args.innerVariant === "poll") return "Poll";
  return "Post";
}

const ULTRA_COMPACT_MAX_CHARS = 110;

/**
 * Ultra-compact layout: very short text-only originals (spec: ~80–120 chars, 1–2 lines).
 */
export function shouldUseUltraCompactLayout(args: {
  relationshipType: PostDetailRelationshipType;
  innerVariant: Exclude<PostDetailContentVariant, "thread">;
  layoutVariant: PostDetailContentVariant;
  post: PostDetailModalPost;
  nip88PollsEnabled: boolean;
  type: "draft" | "published" | "scheduled";
}): boolean {
  const {
    relationshipType,
    innerVariant,
    layoutVariant,
    post,
    nip88PollsEnabled,
    type,
  } = args;

  if (layoutVariant !== "text") return false;
  if (innerVariant !== "text") return false;
  if (relationshipType !== "original") return false;
  if (
    isPostPoll({
      nip88PollsEnabled,
      post,
      type,
    })
  )
    return false;

  const text = getPrimaryNoteText(post);
  if (!text || text.length > ULTRA_COMPACT_MAX_CHARS) return false;
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length > 2) return false;
  if (post.fileUrl && post.fileUrl.length > 0) return false;

  return true;
}

/** Heuristic: long / hex-like tags belong in Technical details, not Overview. */
export function isTechnicalTag(tag: string): boolean {
  const t = tag.trim();
  if (t.length >= 48) return true;
  if (/^[0-9a-f]{32,}$/i.test(t)) return true;
  if (t.startsWith("client_") || t.startsWith("sf_")) return true;
  return false;
}

export function partitionTags(tags: string[] | undefined): {
  userTags: string[];
  technicalTags: string[];
} {
  if (!tags?.length) return { userTags: [], technicalTags: [] };
  const userTags: string[] = [];
  const technicalTags: string[] = [];
  for (const tag of tags) {
    if (isTechnicalTag(tag)) technicalTags.push(tag);
    else userTags.push(tag);
  }
  return { userTags, technicalTags };
}
