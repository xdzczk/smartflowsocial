/**
 * Server-side action handlers for posted posts
 * Extracted from dashboard.posted.tsx
 */
import { json } from "@remix-run/node";
import { nip19 } from "nostr-tools";

import { requireUserId } from "~/features/auth/session.server";
import { logError } from "~/lib/error-logger.server";
import {
    deleteLongFormPost,
    getLongFormPostsByIds,
} from "~/models/longformpost.server";
import {
    deletePost,
    getPostsByIds,
} from "~/models/post.server";

// Type for mixed content items (posts and longform posts)
interface MixedContentItem {
    id: string;
    type: "post" | "longform";
}

/**
 * Handle delete post action
 */
async function handleDelete(formData: FormData, userId: string) {
    const postId = formData.get("postId") as string;
    await deletePost({ id: postId, userId });
    return json({ success: true });
}

/**
 * Handle delete longform post action
 */
async function handleDeleteLongForm(formData: FormData, userId: string) {
    const postId = formData.get("postId") as string;
    await deleteLongFormPost({ id: postId, userId });
    return json({ success: true });
}

/**
 * Handle bulk delete posts action
 */
async function handleBulkDelete(formData: FormData, userId: string) {
    const postIds = JSON.parse(formData.get("postIds") as string);
    await Promise.all(postIds.map((id: string) => deletePost({ id, userId })));
    return json({ success: true });
}

/**
 * Handle bulk delete longform posts action
 */
async function handleBulkDeleteLongForm(formData: FormData, userId: string) {
    const postIds = JSON.parse(formData.get("postIds") as string);
    await Promise.all(postIds.map((id: string) => deleteLongFormPost({ id, userId })));
    return json({ success: true });
}

/**
 * Handle bulk delete mixed content (posts and longform posts)
 */
async function handleBulkDeleteMixed(formData: FormData, userId: string) {
    const itemData: MixedContentItem[] = JSON.parse(formData.get("itemData") as string);
    const promises = itemData.map((item) => {
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
    const postIds = JSON.parse(formData.get("postIds") as string);
    const postsData = await getPostsByIds({ ids: postIds, userId });
    return json({ repostData: postsData });
}

/**
 * Handle bulk scheduled repost action
 */
async function handleBulkScheduledRepost(formData: FormData, userId: string) {
    const postIds = JSON.parse(formData.get("postIds") as string);
    const postsData = await getPostsByIds({ ids: postIds, userId });
    return json({ scheduledRepostData: postsData });
}

/**
 * Handle bulk quote action
 */
async function handleBulkQuote(formData: FormData, userId: string) {
    const postIds = JSON.parse(formData.get("postIds") as string);
    const postsData = await getPostsByIds({ ids: postIds, userId });

    // Transform posts data into quote post format
    const quotePostsData = postsData.map((post) => ({
        caption: "", // Empty caption - user can add content
        fileUrl: post.fileUrl || "",
        queueType: post.queueTypeId || "unassigned",
        scheduledFor: "",
        originalPostId: post.id,
        originalEventId: post.signedEvent?.id,
        originalEventPubkey: post.signedEvent?.pubkey,
        isQuotePost: true,
        originalCaption: post.caption || "",
    }));

    return json({ quotePostData: quotePostsData });
}

/**
 * Handle single repost action
 */
async function handleRepost(formData: FormData, userId: string) {
    const postId = formData.get("postId") as string;

    try {
        // Get the original post data
        const postsData = await getPostsByIds({ ids: [postId], userId });
        if (!postsData || postsData.length === 0) {
            return json({ error: "Post not found" }, { status: 404 });
        }

        const originalPost = postsData[0];
        const originalEvent = originalPost.signedEvent;

        // Create kind 6 repost event structure according to NIP-18
        const kind6EventData = {
            kind: 6,
            content: "", // Empty content as recommended by NIP-18
            tags: [
                // e tag with the id of the note being reposted and relay URL
                ["e", originalEvent.id, "wss://relay.primal.net"],
                // p tag with the pubkey of the event being reposted
                ["p", originalEvent.pubkey],
            ],
            created_at: Math.floor(Date.now() / 1000),
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
                message: error.message || "Failed to create repost",
            },
            { status: 500 }
        );
    }
}

/**
 * Handle single quote action
 */
async function handleQuote(formData: FormData, userId: string) {
    const postId = formData.get("postId") as string;

    try {
        // Get the original post data
        const postsData = await getPostsByIds({ ids: [postId], userId });
        if (!postsData || postsData.length === 0) {
            return json({ error: "Post not found" }, { status: 404 });
        }

        const originalPost = postsData[0];
        const originalEvent = originalPost.signedEvent;

        // Create quote post data for bulk posts page
        const quotePostData = {
            caption: "", // Empty caption - user can add content
            fileUrl: originalPost.fileUrl || "",
            queueType: originalPost.queueTypeId || "unassigned",
            scheduledFor: "",
            originalPostId: originalPost.id,
            originalEventId: originalEvent.id,
            originalEventPubkey: originalEvent.pubkey,
            isQuotePost: true,
            originalCaption: originalPost.caption || "",
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
                message: error.message || "Failed to create quote post",
            },
            { status: 500 }
        );
    }
}

/**
 * Handle longform repost action
 */
async function handleLongformRepost(formData: FormData, userId: string) {
    const postId = formData.get("postId") as string;

    try {
        // Get the original longform post data
        const longformData = await getLongFormPostsByIds({
            ids: [postId],
            userId,
        });
        if (!longformData || longformData.length === 0) {
            return json({ error: "Longform post not found" }, { status: 404 });
        }

        const originalPost = longformData[0];
        const originalEvent = originalPost.signedEvent;

        if (!originalEvent || !originalEvent.id) {
            return json(
                { error: "Longform post has no associated NOSTR event" },
                { status: 400 }
            );
        }

        // Create naddr1 identifier for the longform post
        // For longform posts (kind 30023), we need to create an naddr from the event data
        const dTag = originalEvent.tags?.find((tag: string[]) => tag[0] === "d")?.[1] || "";
        const naddr = nip19.naddrEncode({
            identifier: dTag,
            pubkey: originalEvent.pubkey,
            kind: 30023,
            relays: ["wss://relay.primal.net"],
        });

        // Create kind 1 repost event data (not kind 6 - this is for longform content)
        const kind1EventData = {
            kind: 1,
            content: `nostr:${naddr}`, // Just the naddr reference for simple repost
            tags: [
                // Reference the original longform post
                [
                    "a",
                    `30023:${originalEvent.pubkey}:${dTag}`,
                    "wss://relay.primal.net",
                ],
                // p tag with the pubkey of the event being reposted
                ["p", originalEvent.pubkey],
            ],
            created_at: Math.floor(Date.now() / 1000),
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
            longformPostId: formData.get("longformPostId") as string,
            message: "Longform repost error",
        });
        return json(
            {
                error: true,
                message: error.message || "Failed to create longform repost",
            },
            { status: 500 }
        );
    }
}

/**
 * Handle longform quote action
 */
async function handleLongformQuote(formData: FormData, userId: string) {
    const postId = formData.get("postId") as string;

    try {
        // Get the original longform post data
        const longformData = await getLongFormPostsByIds({
            ids: [postId],
            userId,
        });
        if (!longformData || longformData.length === 0) {
            return json({ error: "Longform post not found" }, { status: 404 });
        }

        const originalPost = longformData[0];
        const originalEvent = originalPost.signedEvent;

        if (!originalEvent || !originalEvent.id) {
            return json(
                { error: "Longform post has no associated NOSTR event" },
                { status: 400 }
            );
        }

        // Create naddr1 identifier for the longform post
        const dTag = originalEvent.tags?.find((tag: string[]) => tag[0] === "d")?.[1] || "";
        const naddr = nip19.naddrEncode({
            identifier: dTag,
            pubkey: originalEvent.pubkey,
            kind: 30023,
            relays: ["wss://relay.primal.net"],
        });

        // Create quote post data for bulk posts page with naddr reference
        const quotePostData = {
            caption: `nostr:${naddr}`, // Include naddr reference for quote post
            fileUrl: "", // No file URL for text-based quote
            queueType: originalPost.queueTypeId || "unassigned",
            scheduledFor: "",
            originalPostId: originalPost.id,
            originalEventId: originalEvent.id,
            originalEventPubkey: originalEvent.pubkey,
            isQuotePost: true,
            isLongformQuote: true,
            originalTitle: originalPost.title || "",
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
                message: error.message || "Failed to create longform quote post",
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
