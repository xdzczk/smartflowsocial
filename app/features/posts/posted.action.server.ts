/**
 * Server-side action handlers for posted posts
 * Extracted from dashboard.posted.tsx
 */
import { json } from "@remix-run/node";
import { nip19 } from "nostr-tools";

import { requireUserId } from "~/features/auth/session.server";
import { logError } from "~/lib/error-logger.server";
import { nowSeconds } from "~/lib/temporal";
import {
  bulkRepostSchema,
  bulkScheduledRepostSchema,
  bulkQuoteSchema,
  repostSchema,
  quoteSchema,
  longformRepostSchema,
  longformQuoteSchema,
  deletePostSchema,
  deleteLongFormPostSchema,
  bulkDeletePostsSchema,
  bulkDeleteLongFormPostsSchema,
  bulkDeleteMixedSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import {
  deleteLongFormPost,
  getLongFormPostsByIds,
} from "~/models/longformpost.server";
import { deletePost } from "~/models/post.commands.server";
import { getPostsByIds } from "~/models/post.queries.server";

const ERROR_POST_NOT_FOUND = "Post not found";
const ERROR_LONGFORM_POST_NOT_FOUND = "Longform post not found";
const DEFAULT_RELAY = "wss://relay.primal.net";
const DEFAULT_QUEUE_TYPE = "unassigned";

/**
 * Handle delete post action
 */
async function handleDelete(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, deletePostSchema);
  if (!result.success) {
    return result.response;
  }
  await deletePost({ id: result.data.postId, userId });
  return json({ success: true });
}

/**
 * Handle delete longform post action
 */
async function handleDeleteLongForm(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, deleteLongFormPostSchema);
  if (!result.success) {
    return result.response;
  }
  await deleteLongFormPost({ id: result.data.postId, userId });
  return json({ success: true });
}

/**
 * Handle bulk delete posts action
 */
async function handleBulkDelete(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, bulkDeletePostsSchema);
  if (!result.success) {
    return result.response;
  }
  await Promise.all(
    result.data.postIds.map((id: string) => deletePost({ id, userId }))
  );
  return json({ success: true });
}

/**
 * Handle bulk delete longform posts action
 */
async function handleBulkDeleteLongForm(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(
    formData,
    bulkDeleteLongFormPostsSchema
  );
  if (!result.success) {
    return result.response;
  }
  await Promise.all(
    result.data.postIds.map((id: string) => deleteLongFormPost({ id, userId }))
  );
  return json({ success: true });
}

/**
 * Handle bulk delete mixed content (posts and longform posts)
 */
async function handleBulkDeleteMixed(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, bulkDeleteMixedSchema);
  if (!result.success) {
    return result.response;
  }
  const promises = result.data.itemData.map((item) => {
    if (item.type === "post") {
      return deletePost({ id: item.id, userId });
    } else {
      return deleteLongFormPost({ id: item.id, userId });
    }
  });
  await Promise.all(promises);
  return json({ success: true });
}

/**
 * Handle bulk repost action
 */
async function handleBulkRepost(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, bulkRepostSchema);
  if (!result.success) {
    return result.response;
  }
  const postsData = await getPostsByIds({ ids: result.data.postIds, userId });
  return json({ repostData: postsData });
}

/**
 * Handle bulk scheduled repost action
 */
async function handleBulkScheduledRepost(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, bulkScheduledRepostSchema);
  if (!result.success) {
    return result.response;
  }
  const postsData = await getPostsByIds({ ids: result.data.postIds, userId });
  return json({ scheduledRepostData: postsData });
}

/**
 * Handle bulk quote action
 */
async function handleBulkQuote(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, bulkQuoteSchema);
  if (!result.success) {
    return result.response;
  }
  const postsData = await getPostsByIds({ ids: result.data.postIds, userId });

  // Transform posts data into quote post format
  const quotePostsData = postsData.map((post) => {
    const signedEvent = post.signedEvent;
    let eventId: string | undefined;
    let eventPubkey: string | undefined;

    if (
      signedEvent &&
      typeof signedEvent === "object" &&
      !Array.isArray(signedEvent)
    ) {
      if ("id" in signedEvent && typeof signedEvent["id"] === "string") {
        eventId = signedEvent["id"];
      }
      if (
        "pubkey" in signedEvent &&
        typeof signedEvent["pubkey"] === "string"
      ) {
        eventPubkey = signedEvent["pubkey"];
      }
    }

    const fileUrl = Array.isArray(post.fileUrl)
      ? (post.fileUrl[0] ?? "")
      : typeof post.fileUrl === "string"
        ? post.fileUrl
        : "";
    const caption = typeof post.caption === "string" ? post.caption : "";
    const queueTypeId =
      typeof post.queueTypeId === "string" ? post.queueTypeId : null;

    return {
      caption: "", // Empty caption - user can add content
      fileUrl,
      queueType: queueTypeId ?? DEFAULT_QUEUE_TYPE,
      scheduledFor: "",
      originalPostId: post.id,
      originalEventId: eventId,
      originalEventPubkey: eventPubkey,
      isQuotePost: true,
      originalCaption: caption,
    };
  });

  return json({ quotePostData: quotePostsData });
}

/**
 * Handle single repost action
 */
async function handleRepost(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, repostSchema);
  if (!result.success) {
    return result.response;
  }
  const postId = result.data.postId;

  try {
    // Get the original post data
    const postsData = await getPostsByIds({ ids: [postId], userId });
    if (postsData.length === 0) {
      return json({ error: ERROR_POST_NOT_FOUND }, { status: 404 });
    }

    const originalPost = postsData[0];
    if (!originalPost) {
      return json({ error: ERROR_POST_NOT_FOUND }, { status: 404 });
    }
    const originalEvent = originalPost.signedEvent;

    if (
      !originalEvent ||
      typeof originalEvent !== "object" ||
      Array.isArray(originalEvent) ||
      !("id" in originalEvent) ||
      !("pubkey" in originalEvent)
    ) {
      return json({ error: "Invalid event data" }, { status: 400 });
    }

    const eventIdValue = originalEvent["id"];
    const eventPubkeyValue = originalEvent["pubkey"];
    const eventId =
      typeof eventIdValue === "string" ? eventIdValue : String(eventIdValue);
    const eventPubkey =
      typeof eventPubkeyValue === "string"
        ? eventPubkeyValue
        : String(eventPubkeyValue);

    // Create kind 6 repost event structure according to NIP-18
    const kind6EventData = {
      kind: 6,
      content: "", // Empty content as recommended by NIP-18
      tags: [
        // e tag with the id of the note being reposted and relay URL
        ["e", eventId, DEFAULT_RELAY],
        // p tag with the pubkey of the event being reposted
        ["p", eventPubkey],
      ],
      created_at: nowSeconds(),
    };

    // Return the unsigned event data for client-side signing
    return json({
      repostEventData: kind6EventData,
      originalPost: originalPost,
    });
  } catch (error: unknown) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      postId: formData.get("postId") as string,
      message: "Repost error",
    });
    return json(
      {
        error: true,
        message:
          error instanceof Error ? error.message : "Failed to create repost",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle single quote action
 */
async function handleQuote(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, quoteSchema);
  if (!result.success) {
    return result.response;
  }
  const postId = result.data.postId;

  try {
    // Get the original post data
    const postsData = await getPostsByIds({ ids: [postId], userId });
    if (postsData.length === 0) {
      return json({ error: ERROR_POST_NOT_FOUND }, { status: 404 });
    }

    const originalPost = postsData[0];
    if (!originalPost) {
      return json({ error: ERROR_POST_NOT_FOUND }, { status: 404 });
    }
    const originalEvent = originalPost.signedEvent;

    if (
      !originalEvent ||
      typeof originalEvent !== "object" ||
      Array.isArray(originalEvent) ||
      !("id" in originalEvent) ||
      !("pubkey" in originalEvent)
    ) {
      return json({ error: "Invalid event data" }, { status: 400 });
    }

    const eventIdValue = originalEvent["id"];
    const eventPubkeyValue = originalEvent["pubkey"];
    const eventId =
      typeof eventIdValue === "string" ? eventIdValue : String(eventIdValue);
    const eventPubkey =
      typeof eventPubkeyValue === "string"
        ? eventPubkeyValue
        : String(eventPubkeyValue);

    // Create quote post data for bulk posts page
    const quotePostData = {
      caption: "", // Empty caption - user can add content
      fileUrl: originalPost.fileUrl[0] ?? "",
      queueType: (originalPost.queueTypeId ?? "") || DEFAULT_QUEUE_TYPE,
      scheduledFor: "",
      originalPostId: originalPost.id,
      originalEventId: eventId,
      originalEventPubkey: eventPubkey,
      isQuotePost: true,
      originalCaption: originalPost.caption ?? "",
    };

    return json({ quotePostData: [quotePostData] });
  } catch (error: unknown) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      postId: formData.get("postId") as string,
      message: "Quote post error",
    });
    return json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create quote post",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle longform repost action
 */
async function handleLongformRepost(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, longformRepostSchema);
  if (!result.success) {
    return result.response;
  }
  const longformPostId = result.data.longformPostId;

  try {
    // Get the original longform post data
    const longformData = await getLongFormPostsByIds({
      ids: [longformPostId],
      userId,
    });
    if (longformData.length === 0) {
      return json({ error: ERROR_LONGFORM_POST_NOT_FOUND }, { status: 404 });
    }

    const originalPost = longformData[0];
    if (!originalPost) {
      return json({ error: ERROR_LONGFORM_POST_NOT_FOUND }, { status: 404 });
    }
    const originalEvent = originalPost.signedEvent;

    if (
      !originalEvent ||
      typeof originalEvent !== "object" ||
      !("id" in originalEvent) ||
      !("pubkey" in originalEvent)
    ) {
      return json(
        { error: "Longform post has no associated NOSTR event" },
        { status: 400 }
      );
    }

    const _eventId =
      typeof originalEvent["id"] === "string"
        ? originalEvent["id"]
        : String(originalEvent["id"]);
    const eventPubkey =
      typeof originalEvent["pubkey"] === "string"
        ? originalEvent["pubkey"]
        : String(originalEvent["pubkey"]);
    const eventTags = Array.isArray(originalEvent["tags"])
      ? originalEvent["tags"]
      : [];

    // Create naddr1 identifier for the longform post
    // For longform posts (kind 30023), we need to create an naddr from the event data
    const dTagMatch = eventTags.find(
      (tag: unknown) => Array.isArray(tag) && tag[0] === "d"
    );
    const dTag =
      (Array.isArray(dTagMatch) && dTagMatch[1] ? String(dTagMatch[1]) : "") ||
      "";
    const naddr = nip19.naddrEncode({
      identifier: typeof dTag === "string" ? dTag : String(dTag),
      pubkey: eventPubkey,
      kind: 30023,
      relays: [DEFAULT_RELAY],
    });

    // Create kind 1 repost event data (not kind 6 - this is for longform content)
    const kind1EventData = {
      kind: 1,
      content: `nostr:${naddr}`, // Just the naddr reference for simple repost
      tags: [
        // Reference the original longform post
        ["a", `30023:${eventPubkey}:${dTag}`, DEFAULT_RELAY],
        // p tag with the pubkey of the event being reposted
        ["p", eventPubkey],
      ],
      created_at: nowSeconds(),
    };

    // Return the unsigned event data for client-side signing
    return json({
      longformRepostEventData: kind1EventData,
      originalPost: originalPost,
      naddr: naddr,
    });
  } catch (error: unknown) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      longformPostId,
      message: "Longform repost error",
    });
    return json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create longform repost",
      },
      { status: 500 }
    );
  }
}

/**
 * Handle longform quote action
 */
async function handleLongformQuote(formData: FormData, userId: string) {
  const result = validateFormDataOrRespond(formData, longformQuoteSchema);
  if (!result.success) {
    return result.response;
  }
  const postId = result.data.postId;

  try {
    // Get the original longform post data
    const longformData = await getLongFormPostsByIds({
      ids: [postId],
      userId,
    });
    if (longformData.length === 0) {
      return json({ error: ERROR_LONGFORM_POST_NOT_FOUND }, { status: 404 });
    }

    const originalPost = longformData[0];
    if (!originalPost) {
      return json({ error: ERROR_LONGFORM_POST_NOT_FOUND }, { status: 404 });
    }
    const originalEvent = originalPost.signedEvent;

    if (
      !originalEvent ||
      typeof originalEvent !== "object" ||
      !("id" in originalEvent) ||
      !("pubkey" in originalEvent)
    ) {
      return json(
        { error: "Longform post has no associated NOSTR event" },
        { status: 400 }
      );
    }

    const eventId =
      typeof originalEvent["id"] === "string"
        ? originalEvent["id"]
        : String(originalEvent["id"]);
    const eventPubkey =
      typeof originalEvent["pubkey"] === "string"
        ? originalEvent["pubkey"]
        : String(originalEvent["pubkey"]);
    const eventTags = Array.isArray(originalEvent["tags"])
      ? originalEvent["tags"]
      : [];

    // Create naddr1 identifier for the longform post
    const dTagMatch = eventTags.find(
      (tag: unknown) => Array.isArray(tag) && tag[0] === "d"
    );
    const dTag =
      (Array.isArray(dTagMatch) && dTagMatch[1] ? String(dTagMatch[1]) : "") ||
      "";
    const naddr = nip19.naddrEncode({
      identifier: typeof dTag === "string" ? dTag : String(dTag),
      pubkey: eventPubkey,
      kind: 30023,
      relays: [DEFAULT_RELAY],
    });

    // Create quot??post data for bulk posts page with naddr reference
    const quotePostData = {
      caption: `nostr:${naddr}`, // Include naddr reference for quote post
      fileUrl: "", // No file URL for text-based quote
      queueType: originalPost.queueTypeId ?? DEFAULT_QUEUE_TYPE,
      scheduledFor: "",
      originalPostId: originalPost.id,
      originalEventId: eventId,
      originalEventPubkey: eventPubkey,
      isQuotePost: true,
      isLongformQuote: true,
      originalTitle: originalPost.title ?? "",
      naddr: naddr,
    };

    return json({ longformQuotePostData: [quotePostData] });
  } catch (error: unknown) {
    logError(error instanceof Error ? error : new Error(String(error)), {
      userId,
      longformPostId: formData.get("longformPostId") as string,
      message: "Longform quote post error",
    });
    return json(
      {
        error: true,
        message:
          error instanceof Error
            ? error.message
            : "Failed to create longform quote post",
      },
      { status: 500 }
    );
  }
}

/**
 * Main action handler for posted posts
 */
export async function postedPostsAction({ request }: { request: Request }) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const _action = formData.get("_action");

  switch (_action) {
    case "delete":
      return handleDelete(formData, userId);
    case "deleteLongForm":
      return handleDeleteLongForm(formData, userId);
    case "bulkDelete":
      return handleBulkDelete(formData, userId);
    case "bulkDeleteLongForm":
      return handleBulkDeleteLongForm(formData, userId);
    case "bulkDeleteMixed":
      return handleBulkDeleteMixed(formData, userId);
    case "bulkRepost":
      return handleBulkRepost(formData, userId);
    case "bulkScheduledRepost":
      return handleBulkScheduledRepost(formData, userId);
    case "bulkQuote":
      return handleBulkQuote(formData, userId);
    case "repost":
      return handleRepost(formData, userId);
    case "quote":
      return handleQuote(formData, userId);
    case "longformRepost":
      return handleLongformRepost(formData, userId);
    case "longformQuote":
      return handleLongformQuote(formData, userId);
    default:
      return json({ error: "Invalid action" }, { status: 400 });
  }
}
