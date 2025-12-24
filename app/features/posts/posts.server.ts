import { json } from "@remix-run/node";
import { combineContent } from "~/features/posts/combined.server";
import { getPostStats } from "~/features/posts/stats.server";
import {
    schedulePost,
    cancelScheduledPost,
} from "~/features/posts/queues.server";
import {
    getScheduledLongFormPosts,
    deleteLongFormPost,
    updateLongFormPost,
    getLongFormPost as getLongFormPostModel,
    getPublishedLongFormPosts
} from "~/models/longformpost.server";
import {
    getScheduledPosts,
    deletePost,
    reschedulePost,
    getPostById,
    updatePost,
    getPostedPosts,
    getRecyclablePosts,
    getPostsByIds,
    // schedulePost, // Removed from here
    // cancelScheduledPost // Removed from here
} from "~/models/post.server";
import {
    getUserHashTags,
    getUserById,
    getQueueTypes,
    getUserHashTagPresets,
} from "~/models/user.server";

// --- Scheduled Posts Logic ---

export async function getScheduledDashboardData({ userId, queueType }: { userId: string, queueType: string }) {
    const [posts, allLongformPosts, user, queueTypes, hashTagPresets] =
        await Promise.all([
            getScheduledPosts({ userId, queueType }),
            getScheduledLongFormPosts({ userId }),
            getUserById(userId),
            getQueueTypes(userId),
            getUserHashTagPresets(userId),
        ]);

    // Filter longform posts by queue type if specific queue is selected
    const longformPosts =
        queueType === "all"
            ? allLongformPosts
            : allLongformPosts.filter((post) => post.queueType?.name === queueType);

    // Combine posts and longform posts for the "All" tab
    const allContent = combineContent(
        posts,
        longformPosts,
        "scheduledFor",
        "asc",
    );

    return {
        posts,
        longformPosts,
        allContent,
        user,
        queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
        selectedQueueType: queueType,
        hashTagPresets,
    };
}

export async function handleScheduledPostAction(formData: FormData, userId: string) {
    const postId = formData.get("postId") as string;
    const _action = formData.get("_action");

    if (_action === "delete") {
        await deletePost({ id: postId, userId });
        return json({ success: true });
    }

    if (_action === "deleteLongForm") {
        await deleteLongFormPost({ id: postId, userId });
        return json({ success: true });
    }

    if (_action === "bulkDelete") {
        const postIds = JSON.parse(formData.get("postIds") as string);
        await Promise.all(postIds.map((id: string) => deletePost({ id, userId })));
        return json({ success: true });
    }

    if (_action === "bulkDeleteLongForm") {
        const postIds = JSON.parse(formData.get("postIds") as string);
        await Promise.all(postIds.map((id: string) => deleteLongFormPost({ id, userId })));
        return json({ success: true });
    }

    if (_action === "bulkDeleteMixed") {
        const itemData = JSON.parse(formData.get("itemData") as string);
        const promises = itemData.map((item: { id: string; type: string }) => {
            if (item.type === "post") {
                return deletePost({ id: item.id, userId });
            } else {
                return deleteLongFormPost({ id: item.id, userId });
            }
        });
        await Promise.all(promises);
        return json({ success: true });
    }

    // Reschedule a regular post (with optional re-signed event)
    if (_action === "reschedule") {
        const newTime = formData.get("newTime") as string;
        const overrideQueue = formData.get("overrideQueue") === "true";
        const signedEventStr = formData.get("signedEvent") as string;
        const nostrEventStr = formData.get("nostrEvent") as string;
        const queueTypeId = formData.get("queueTypeId") as string;

        if (!postId || !newTime) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        const originalPost = await getPostById({ id: postId, userId });
        if (!originalPost) {
            return json({ error: "Post not found" }, { status: 404 });
        }

        await cancelScheduledPost(postId);

        let parsedSignedEvent = null;
        let parsedNostrEvent = null;
        if (signedEventStr && nostrEventStr) {
            try {
                parsedSignedEvent = JSON.parse(signedEventStr);
                parsedNostrEvent = JSON.parse(nostrEventStr);
            } catch (e) {
                console.error("Error parsing signed events:", e);
            }
        }

        const updatedPost = await reschedulePost({
            id: postId,
            userId,
            newScheduledFor: newTime,
            overrideQueue,
            queueTypeId,
        });

        if (parsedSignedEvent && parsedNostrEvent) {
            const finalPost = await reschedulePost({
                id: postId,
                userId,
                newScheduledFor: newTime,
                overrideQueue: false,
                signedEvent: null,
                nostrEvent: null,
            });

            await schedulePost(
                postId,
                userId,
                parsedSignedEvent,
                parseInt(newTime),
            );

            return json({ success: true, post: finalPost, signed: true });
        }

        return json({ success: true, post: updatedPost, needsSigning: true });
    }

    // Reschedule a longform post (with optional re-signed event)
    if (_action === "rescheduleLongform") {
        const newTime = formData.get("newTime") as string;
        const signedEventStr = formData.get("signedEvent") as string;
        const nostrEventStr = formData.get("nostrEvent") as string;

        if (!postId || !newTime) {
            return json({ error: "Missing required fields" }, { status: 400 });
        }

        const originalPost = await getLongFormPostModel({ id: postId, userId });
        if (!originalPost) {
            return json({ error: "Longform post not found" }, { status: 404 });
        }

        let parsedSignedEvent = null;
        let parsedNostrEvent = null;
        if (signedEventStr && nostrEventStr) {
            try {
                parsedSignedEvent = JSON.parse(signedEventStr);
                parsedNostrEvent = JSON.parse(nostrEventStr);
            } catch (e) {
                console.error("Error parsing signed events:", e);
            }
        }

        const updatedPost = await updateLongFormPost({
            id: postId,
            userId,
            publishedAt: new Date(parseInt(newTime) * 1000),
            status: "SCHEDULED",
            signedEvent: parsedSignedEvent,
            nostrEvent: parsedNostrEvent,
        });

        return json({
            success: true,
            post: updatedPost,
            signed: !!parsedSignedEvent,
        });
    }

    // Edit a regular post's content/media/hashtags and re-sign
    if (_action === "editPost") {
        const caption = (formData.get("caption") ?? "") as string;
        const fileUrl = (formData.get("fileUrl") ?? "") as string;
        const hashtags = (formData.get("hashtags") ?? "") as string;
        const signedEventStr = formData.get("signedEvent") as string;
        const nostrEventStr = formData.get("nostrEvent") as string;
        const queueTypeId = formData.get("queueTypeId") as string || null;
        const scheduledFor = formData.get("scheduledFor") as string || null;
        const hashTagPresetId = formData.get("hashTagPresetId") as string || null;

        if (!postId) {
            return json({ error: "Missing postId" }, { status: 400 });
        }

        let parsedSignedEvent = null;
        let parsedNostrEvent = null;
        if (signedEventStr && nostrEventStr) {
            try {
                parsedSignedEvent = JSON.parse(signedEventStr);
                parsedNostrEvent = JSON.parse(nostrEventStr);
            } catch (e) {
                console.error("Error parsing signed events:", e);
            }
        }

        let parsedFileUrl = [];
        if (fileUrl) {
            try {
                parsedFileUrl = JSON.parse(fileUrl);
            } catch (e) {
                console.error("Error parsing fileUrl:", e);
                parsedFileUrl = [];
            }
        }

        const updated = await updatePost({
            id: postId,
            userId,
            data: {
                caption,
                fileUrl: parsedFileUrl,
                tags: hashtags ? hashtags.toString().split(' ').filter(tag => tag.trim()) : [],
                queueTypeId,
                scheduledFor: scheduledFor ? Number(scheduledFor) : undefined,
                signedEvent: parsedSignedEvent || undefined,
                nostrEvent: parsedNostrEvent || undefined,
                hashTagPresetId,
            },
        });

        if (scheduledFor && parsedSignedEvent) {
            await cancelScheduledPost(postId);
            await schedulePost(
                postId,
                userId,
                parsedSignedEvent,
                Number(scheduledFor),
            );
        }

        return json({
            success: true,
            post: updated,
            signed: !!parsedSignedEvent,
        });
    }

    // Edit a longform post's content and re-sign
    if (_action === "editLongform") {
        const title = (formData.get("title") ?? "") as string;
        const summary = (formData.get("summary") ?? "") as string;
        const content = (formData.get("content") ?? "") as string;
        const image = (formData.get("image") ?? "") as string;
        const signedEventStr = formData.get("signedEvent") as string;
        const nostrEventStr = formData.get("nostrEvent") as string;
        const scheduledFor = formData.get("scheduledFor") as string || null;

        if (!postId) {
            return json({ error: "Missing postId" }, { status: 400 });
        }

        let parsedSignedEvent = null;
        let parsedNostrEvent = null;
        if (signedEventStr && nostrEventStr) {
            try {
                parsedSignedEvent = JSON.parse(signedEventStr);
                parsedNostrEvent = JSON.parse(nostrEventStr);
            } catch (e) {
                console.error("Error parsing signed events:", e);
            }
        }

        const updated = await updateLongFormPost({
            id: postId,
            userId,
            title,
            summary,
            content,
            image,
            publishedAt: scheduledFor
                ? new Date(Number(scheduledFor) * 1000)
                : undefined,
            status: "SCHEDULED",
            signedEvent: parsedSignedEvent || undefined,
            nostrEvent: parsedNostrEvent || undefined,
        });

        return json({
            success: true,
            post: updated,
            signed: !!parsedSignedEvent,
        });
    }

    return json({ error: "Invalid action" }, { status: 400 });
}

// --- Posted Posts Logic ---

export async function getPostedDashboardData({
    userId,
    params,
    url
}: {
    userId: string;
    params: { queueType?: string };
    url: URL;
}) {
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = 50;
    const queueType = params.queueType || "all";

    const [{ posts, pagination }, allLongformResult, user, queueTypes] =
        await Promise.all([
            getPostedPosts({
                userId,
                page,
                limit,
                queueType,
            }),
            getPublishedLongFormPosts({ userId, page, limit }),
            getUserById(userId),
            getQueueTypes(userId),
        ]);

    const longformResult = {
        ...allLongformResult,
        posts:
            queueType === "all"
                ? allLongformResult.posts
                : allLongformResult.posts.filter(
                    (post) => post.queueType?.name === queueType,
                ),
    };

    const allContent = combineContent(
        posts,
        longformResult.posts,
        "postedAt",
        "desc",
    );

    const eventIds = posts.map((post) => (post.signedEvent as { id: string }).id);
    const stats = await getPostStats(eventIds);

    return {
        posts,
        longformPosts: longformResult.posts,
        allContent,
        longformPagination: longformResult.pagination,
        pagination,
        stats,
        user,
        queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
        selectedQueueType: queueType,
    };
}

// --- Recyclable Posts Logic ---

export async function getRecyclableDashboardData({
    userId,
    params,
    url
}: {
    userId: string;
    params: { queueType?: string };
    url: URL;
}) {
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = 50;
    const queueType = params.queueType || "all";

    const [{ posts, pagination }, user, queueTypes] = await Promise.all([
        getRecyclablePosts({
            userId,
            page,
            limit,
            queueType,
        }),
        getUserById(userId),
        getQueueTypes(userId),
    ]);

    // Get event IDs from signedEvent.id
    const eventIds = posts.map((post) => post.signedEvent.id);

    // Use the extracted stats fetching logic
    const stats = await getPostStats(eventIds);

    return {
        posts,
        pagination,
        stats,
        user,
        queueTypes: queueTypes.filter((qt) => qt.isEnabled !== false),
        selectedQueueType: queueType,
    };
}

export async function handleRecyclablePostAction(formData: FormData, userId: string) {
    const postId = formData.get("postId") as string;
    const _action = formData.get("_action");

    if (_action === "delete") {
        await deletePost({ id: postId, userId });
        return json({ success: true });
    }

    if (_action === "bulkDelete") {
        const postIds = JSON.parse(formData.get("postIds") as string);
        await Promise.all(postIds.map((id: string) => deletePost({ id, userId })));
        return json({ success: true });
    }

    if (_action === "bulkRepost") {
        const postIds = JSON.parse(formData.get("postIds") as string);
        const postsData = await getPostsByIds({ ids: postIds, userId });
        return json({ repostData: postsData });
    }

    if (_action === "bulkScheduledRepost") {
        const postIds = JSON.parse(formData.get("postIds") as string);
        const postsData = await getPostsByIds({ ids: postIds, userId });
        return json({ scheduledRepostData: postsData });
    }

    if (_action === "bulkQuote") {
        const postIds = JSON.parse(formData.get("postIds") as string);
        const postsData = await getPostsByIds({ ids: postIds, userId });

        // Transform posts data into quote post format
        const quotePostsData = postsData.map((post) => ({
            caption: "", // Empty caption - user can add content
            fileUrl: post.fileUrl || "",
            queueType: post.queueType || "unassigned",
            scheduledFor: "",
            originalPostId: post.id,
            originalEventId: post.signedEvent?.id,
            originalEventPubkey: post.signedEvent?.pubkey,
            isQuotePost: true,
            originalCaption: post.caption || "",
        }));

        return json({ quotePostData: quotePostsData });
    }

    if (_action === "repost") {
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
        } catch (error: any) {
            console.error("Repost error:", error);
            return json(
                {
                    error: true,
                    message: error.message || "Failed to create repost",
                },
                { status: 500 },
            );
        }
    }

    if (_action === "quote") {
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
                queueType: originalPost.queueType || "unassigned",
                scheduledFor: "",
                originalPostId: originalPost.id,
                originalEventId: originalEvent.id,
                originalEventPubkey: originalEvent.pubkey,
                isQuotePost: true,
                originalCaption: originalPost.caption || "",
            };

            return json({ quotePostData: [quotePostData] });
        } catch (error: any) {
            console.error("Quote post error:", error);
            return json(
                {
                    error: true,
                    message: error.message || "Failed to create quote post",
                },
                { status: 500 },
            );
        }
    }


    return json({ error: "Invalid action" }, { status: 400 });
}

export async function getBulkPostsDashboardData(userId: string) {
    const [tags, queueTypes, hashTagPresets] = await Promise.all([
        getUserHashTags(userId),
        getQueueTypes(userId),
        getUserHashTagPresets(userId),
    ]);


    // Split tags string into array and sort alphabetically
    const tagsArray = tags
        ? tags.split(/\s+/).filter(t => t.trim()).sort((a, b) => a.localeCompare(b))
        : [];

    // Calculate initial mode based on hash tag presets
    const mode = hashTagPresets.length > 0 ? "preset" : "manual";

    return {
        tags: tagsArray,
        queueTypes: queueTypes.filter(qt => qt.isEnabled !== false),
        hashTagPresets,
        mode
    };
}
