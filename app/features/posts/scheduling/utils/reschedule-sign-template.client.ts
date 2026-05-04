/**
 * Build unsigned Nostr events for reschedule when the stored signature was cleared
 * (e.g. queue resume with a new slot). The reschedule modal normally clones `signedEvent`;
 * when that field is null we reconstruct from persisted post fields.
 */

import type { SignedEvent } from "~/features/nostr/types";
import type { LongFormPostData, PostData } from "~/features/posts/types";
import {
  appendMediaUrlsForSigning,
  stripAttachmentTokens,
} from "~/features/posts/utils/inline-tokens";
import {
  buildKind6RepostEvent,
  buildLongformQuoteEvent,
  buildQuoteEvent,
} from "~/features/posts/utils/repost-quote-events.client";
import { sanitizeMarkdown } from "~/lib/markdown-sanitize";

export interface UnsignedNostrEventTemplate {
  content: string;
  created_at: number;
  kind: number;
  tags: string[][];
}

function buildHashtagTags(tags: string[]): string[][] {
  return tags
    .filter((t) => t.trim().length > 0)
    .map((t) => ["t", t.replace(/^#/, "").toLowerCase()]);
}

function buildRegularPostTemplate(
  post: PostData,
  newTimeUnix: number,
  includeHashtagsInNoteBody: boolean
): UnsignedNostrEventTemplate | { error: string } {
  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- PostData optional fields differ by route */
  if (post.postType === "POLL") {
    return {
      error:
        "Polls must be re-signed from the editor. Open Edit and schedule again.",
    };
  }
  if (post.replyToEventId || post.postKind === "REPLY") {
    return {
      error:
        "This reply must be re-signed from the editor. Choose Edit from the menu.",
    };
  }

  const caption = stripAttachmentTokens(post.caption ?? "").trim();
  const urls = Array.isArray(post.fileUrl) ? post.fileUrl : [];
  const rawTags = post.tags ?? [];
  const hashtagStr = rawTags
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");
  const bodyBase =
    includeHashtagsInNoteBody && hashtagStr
      ? `${caption}\n${hashtagStr}`
      : caption;
  const contentToSign = appendMediaUrlsForSigning(bodyBase, urls);
  const tags = buildHashtagTags(rawTags);

  /* eslint-enable @typescript-eslint/no-unnecessary-condition */
  return {
    content: contentToSign,
    created_at: newTimeUnix,
    kind: 1,
    tags,
  };
}

function buildLongformTemplate(
  post: LongFormPostData,
  newTimeUnix: number
): UnsignedNostrEventTemplate | { error: string } {
  /* eslint-disable @typescript-eslint/no-unnecessary-condition -- longform fields optional in loaders */
  const raw = post.content ?? "";
  const content = sanitizeMarkdown(raw);
  const tags: string[][] = [
    ["d", post.id],
    ["title", post.title ?? ""],
    ["summary", post.summary ?? ""],
  ];
  if (post.image?.trim()) {
    tags.push(["image", post.image.trim()]);
  }
  tags.push(["published_at", String(newTimeUnix)]);
  for (const t of post.tags ?? []) {
    if (t.trim()) tags.push(["t", t.trim().toLowerCase()]);
  }

  /* eslint-enable @typescript-eslint/no-unnecessary-condition */
  return {
    content,
    created_at: newTimeUnix,
    kind: 30023,
    tags,
  };
}

/**
 * Returns an unsigned event template suitable for `nostrAdapter.signEvent`, or an error message.
 */
export function buildUnsignedEventTemplateForReschedule(params: {
  post: PostData | LongFormPostData;
  isLongform: boolean;
  newTimeUnix: number;
  includeHashtagsInNoteBody: boolean;
  repostSourceSignedEvent: SignedEvent | null | undefined;
  quoteSourceSignedEvent: SignedEvent | null | undefined;
  quoteLongFormSourceSignedEvent: SignedEvent | null | undefined;
}): UnsignedNostrEventTemplate | { error: string } {
  const {
    post,
    isLongform,
    newTimeUnix,
    includeHashtagsInNoteBody,
    repostSourceSignedEvent,
    quoteSourceSignedEvent,
    quoteLongFormSourceSignedEvent,
  } = params;

  if (isLongform && "title" in post) {
    return buildLongformTemplate(post, newTimeUnix);
  }

  const p = post as PostData;

  if (p.postKind === "REPOST") {
    if (!repostSourceSignedEvent) {
      return {
        error:
          "Could not load the original note for this repost. Re-sign the source post first, or open Edit.",
      };
    }
    return buildKind6RepostEvent(repostSourceSignedEvent, newTimeUnix);
  }

  if (p.postKind === "QUOTE") {
    const tagArray = buildHashtagTags(p.tags);
    const caption = stripAttachmentTokens(p.caption ?? "").trim();

    if (p.quoteOfLongFormPostId) {
      if (!quoteLongFormSourceSignedEvent) {
        return {
          error:
            "Could not load the quoted article’s signature. Re-sign the long-form post first, or open Edit.",
        };
      }
      return buildLongformQuoteEvent(
        quoteLongFormSourceSignedEvent,
        caption,
        newTimeUnix,
        tagArray
      );
    }

    if (!quoteSourceSignedEvent) {
      return {
        error:
          "Could not load the quoted note for re-signing. Open Edit to re-sign.",
      };
    }
    return buildQuoteEvent(
      quoteSourceSignedEvent,
      caption,
      newTimeUnix,
      tagArray
    );
  }

  return buildRegularPostTemplate(p, newTimeUnix, includeHashtagsInNoteBody);
}
