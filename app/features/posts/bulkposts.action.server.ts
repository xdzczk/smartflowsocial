/**
 * Server-side action handlers for bulk posts
 * Extracted from dashboard.bulkposts.tsx
 */
import { json, redirect } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import type { NostrEvent, SignedEvent } from "~/features/nostr/types";
import { resolveQueueTypeId } from "~/features/posts/services/queue-type-resolver.server";
import { logInfo } from "~/lib/error-logger.server";
import { createPost, updatePost } from "~/models/post.commands.server";
import { isVideoUrl } from "~/utils/media-helpers";
/**
 * Upload result from client-side upload system
 */
interface UploadResult {
    success: boolean;
    file?: {
        url: string;
        size: number;
        name: string;
        extension: string;
        sha256?: string;
        mimeType?: string;
        provider: "S3" | "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR";
    };
    error?: string;
}

/**
 * Handle file upload preview results from client-side upload system
 */
export async function handleUploadImagesPreview(formData: FormData) {
    try {
        const uploadResultsStrRaw = formData.get("uploadResults");
        const uploadResultsStr = typeof uploadResultsStrRaw === "string" ? uploadResultsStrRaw : null;
        if (!uploadResultsStr) {
            const { ValidationError } = await import("~/lib/errors");
            throw new ValidationError("Missing uploadResults");
        }

        let uploadResults: UploadResult[];
        try {
            const parsed: unknown = JSON.parse(uploadResultsStr);
            if (Array.isArray(parsed)) {
                uploadResults = parsed as unknown as UploadResult[];
            } else {
                throw new Error("uploadResults must be an array");
            }
        } catch (parseError) {
            const { ValidationError } = await import("~/lib/errors");
            throw new ValidationError("Invalid uploadResults JSON format", {
                error: parseError instanceof Error ? parseError.message : String(parseError),
            });
        }

        const scheduledDates = formData.getAll("scheduledDates");
        const queueTypes = formData.getAll("queueTypes");

        const fileUrls = uploadResults.map((result: UploadResult, index: number) => ({
            fileUrl: result.file?.url ?? "",
            scheduledFor: scheduledDates[index],
            queueType: queueTypes[index],
        }));

        return json({ success: true, fileUrls });
    } catch (error) {
        const { handleActionError } = await import("~/lib/error-handler.server");
        return handleActionError(error);
    }
}

/**
 * Handle sign and schedule posts action
 */
export async function handleSignAndSchedule(
    formData: FormData,
    userId: string,
    mode: string | null
) {
    try {
        // Parse signed events with error handling
        let signedEvents: SignedEvent[];
        try {
            const signedEventsRaw = formData.getAll("signedEvents");
            signedEvents = signedEventsRaw
                .map((event) => {
                    const parsed: unknown = typeof event === "string" ? JSON.parse(event) : null;
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        return parsed as unknown as SignedEvent;
                    }
                    throw new Error("Invalid signed event format");
                });
        } catch (parseError) {
            const { ValidationError } = await import("~/lib/errors");
            throw new ValidationError("Invalid signedEvents JSON format", {
                error: parseError instanceof Error ? parseError.message : String(parseError),
            });
        }

        let nostrEvents: NostrEvent[];
        try {
            const nostrEventsRaw = formData.getAll("nostrEvent");
            nostrEvents = nostrEventsRaw
                .map((event) => {
                    const parsed: unknown = typeof event === "string" ? JSON.parse(event) : null;
                    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                        return parsed as unknown as NostrEvent;
                    }
                    throw new Error("Invalid nostr event format");
                });
        } catch (parseError) {
            const { ValidationError } = await import("~/lib/errors");
            throw new ValidationError("Invalid nostrEvent JSON format", {
                error: parseError instanceof Error ? parseError.message : String(parseError),
            });
        }

        let captions: string[];
        try {
            const captionsRaw = formData.getAll("caption");
            captions = captionsRaw
                .map((caption) => {
                    const parsed: unknown = typeof caption === "string" ? JSON.parse(caption) : null;
                    if (typeof parsed === "string") {
                        return parsed;
                    }
                    if (Array.isArray(parsed)) {
                        return parsed.join(" ");
                    }
                    return String(parsed ?? "");
                });
        } catch (parseError) {
            const { ValidationError } = await import("~/lib/errors");
            throw new ValidationError("Invalid caption JSON format", {
                error: parseError instanceof Error ? parseError.message : String(parseError),
            });
        }

        let fileUrls: string[];
        try {
            const fileUrlValues = formData.getAll("fileUrl");
            fileUrls = fileUrlValues.map((url) => {
                const urlStr = typeof url === "string" ? url : String(url);
                const parsed: unknown = JSON.parse(urlStr);
                return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
            }).flat();
        } catch (parseError) {
            const { ValidationError } = await import("~/lib/errors");
            throw new ValidationError("Invalid fileUrl JSON format", {
                error: parseError instanceof Error ? parseError.message : String(parseError),
            });
        }

    const queueTypes = formData.getAll("queueType");
    const isRecyclableFlags = formData.getAll("isRecyclable");
    const originalPostIds = formData
        .getAll("originalPostId")
        .filter((id) => id && id !== "");


    await Promise.all(
        signedEvents.map(async (signedEvent, index) => {
            // Parse content assuming format: "caption imageUrl1 imageUrl2 ..."
            let content = "";
            if (signedEvent.content && typeof signedEvent.content === "string") {
                const contentParts = signedEvent.content.split(" ");
                content = contentParts
                    .filter((part: string) => !part.startsWith("http"))
                    .join(" ");
            }

            // For recycled posts, use the caption as content if content is empty
            if (!content && captions[index]) {
                content = captions[index];
            }

            const fileUrl = fileUrls[index];
            const tags = signedEvent.tags.map((tagArray: string[]) => tagArray[1]);
            const queueType = (queueTypes[index] as string) || "unassigned";
            const isRecyclableFlag = isRecyclableFlags[index];
            const isRecyclable =
                isRecyclableFlag === "true" ||
                String(isRecyclableFlag).toLowerCase() === "true";

            // Enhanced detection for quote posts
            const hasEventTags = signedEvent.tags.some(
                (tag: string[]) => tag[0] === "e" && tag[3] === "mention"
            );
            const isQuotePost =
                mode === "quote" ||
                (signedEvent.kind === 1 && hasEventTags);
            logInfo("Calculated isQuotePost", {
                isQuotePost,
                mode,
                hasEventTags,
                userId,
            });

            // Determine post type based on file URL
            const isVideo = isVideoUrl(fileUrl);
            const postType = isVideo ? "VIDEO" : "IMAGE";

            // Resolve queue type ID in feature layer (business logic)
            const resolvedQueueTypeId = await resolveQueueTypeId(userId, null, queueType);

            const post = await createPost({
                userId,
                content,
                fileUrl: [fileUrl],
                scheduledFor: signedEvent.created_at.toString(),
                nostrEventId: signedEvent.id,
                signedEvent: signedEvent,
                nostrEvent: nostrEvents[index],
                tags: tags,
                caption: captions[index],
                isScheduled: true,
                isPosted: false,
                postType: postType,
                queueTypeId: resolvedQueueTypeId,
                repost: signedEvent.kind === 6, // Mark as repost if it's kind 6
                isQuotedPost: isQuotePost, // Use the calculated value
                isRecyclable,
            });

            logInfo("Created post", {
                postId: post?.id,
                index,
                queueTypeId: post?.queueTypeId,
                userId,
            });
            return post;
        })
    );

        // If this is a recycle mode (posts have original post IDs), mark original posts as non-recyclable
        if (mode === "recycle" && originalPostIds.length > 0) {
            await markOriginalPostsAsNonRecyclable(originalPostIds as string[], userId);
        }

        return redirect(`/dashboard/scheduled`);
    } catch (error) {
        const { handleActionError } = await import("~/lib/error-handler.server");
        return handleActionError(error);
    }
}

/**
 * Handle save as draft action
 */
export async function handleSaveAsDraft(
    formData: FormData,
    userId: string,
    mode: string | null
) {
    try {
        let fileUrls: string[];
        try {
            const fileUrlsRaw = formData.getAll("fileUrl");
            fileUrls = fileUrlsRaw.map((url) => {
                const parsed: unknown = typeof url === "string" ? JSON.parse(url) : null;
                    if (Array.isArray(parsed)) {
                        return parsed as unknown as string[];
                }
                return [];
            }).flat();
        } catch (parseError) {
            const { ValidationError } = await import("~/lib/errors");
            throw new ValidationError("Invalid fileUrl JSON format", {
                error: parseError instanceof Error ? parseError.message : String(parseError),
            });
        }

        let captions: string[];
        try {
            const captionsRaw = formData.getAll("caption");
            captions = captionsRaw
                .map((caption) => {
                    const parsed: unknown = typeof caption === "string" ? JSON.parse(caption) : null;
                    if (typeof parsed === "string") {
                        return parsed;
                    }
                    if (Array.isArray(parsed)) {
                        return parsed.join(" ");
                    }
                    return String(parsed ?? "");
                });
        } catch (parseError) {
            const { ValidationError } = await import("~/lib/errors");
            throw new ValidationError("Invalid caption JSON format", {
                error: parseError instanceof Error ? parseError.message : String(parseError),
            });
        }
    const queueTypes = formData.getAll("queueType");
    const isRecyclableFlags = formData.getAll("isRecyclable");
    const originalPostIds = formData
        .getAll("originalPostId")
        .filter((id) => id && id !== "");

    await Promise.all(
        fileUrls.map(async (fileUrl, index) => {
            const caption = captions[index];
            const queueType = (queueTypes[index] as string) || "unassigned";
            const isRecyclableFlag = isRecyclableFlags[index];
            const isRecyclable =
                isRecyclableFlag === "true" ||
                String(isRecyclableFlag).toLowerCase() === "true";

            // Determine post type based on file URL
            const isVideo = isVideoUrl(fileUrl);
            const postType = isVideo ? "VIDEO" : "IMAGE";

            // Resolve queue type ID in feature layer (business logic)
            const resolvedQueueTypeId = await resolveQueueTypeId(userId, null, queueType);

            const post = await createPost({
                userId,
                content: caption,
                caption: caption,
                fileUrl: [fileUrl],
                isScheduled: false,
                isPosted: false,
                postType: postType,
                tags: [],
                queueTypeId: resolvedQueueTypeId,
                draft: true,
                isRecyclable,
            });

            return post;
        })
    );

        // If this is a recycle mode (posts have original post IDs) and user saved as draft,
        // we might still want to mark them as non-recyclable to prevent confusion
        if (mode === "recycle" && originalPostIds.length > 0) {
            await markOriginalPostsAsNonRecyclable(originalPostIds as string[], userId, true);
        }

        return redirect(`/dashboard/drafts`);
    } catch (error) {
        const { handleActionError } = await import("~/lib/error-handler.server");
        return handleActionError(error);
    }
}

/**
 * Mark original posts as non-recyclable after recycling/reposting
 */
async function markOriginalPostsAsNonRecyclable(
    originalPostIds: string[],
    userId: string,
    isDraft = false,
) {
    logInfo(`Marking original posts as non-recyclable${isDraft ? " (draft)" : ""}`, {
        originalPostIds,
        userId,
        isDraft,
    });

    // Update all original posts to mark them as non-recyclable
    await Promise.all(
        originalPostIds.map(async (originalPostId) => {
            try {
                await updatePost({
                    id: originalPostId,
                    userId,
                    data: { isRecyclable: false },
                });
                logInfo(`Marked post as non-recyclable${isDraft ? " (draft)" : ""}`, {
                    postId: originalPostId,
                    userId,
                    isDraft,
                });
            } catch (error) {
                // Log but don't throw - marking as non-recyclable is non-critical
                const { logWarning } = await import("~/lib/error-logger.server");
                logWarning(`Failed to mark post as non-recyclable`, {
                    postId: originalPostId,
                    userId,
                    isDraft,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        })
    );
}

/**
 * Main action handler for bulk posts
 */
export async function bulkPostsAction({ request }: { request: Request }) {
    try {
        const userId = await requireUserId(request);
        if (!userId) {
            const { AuthenticationError } = await import("~/lib/errors");
            throw new AuthenticationError("User not authenticated");
        }

        const url = new URL(request.url);
        const mode = url.searchParams.get("mode");

        const formData = await request.formData();
        const _action = formData.get("_action");

        // Handle file upload results from client-side upload system
        if (_action === "_upload_images_preview") {
            return handleUploadImagesPreview(formData);
        }

        // Sign and schedule posts
        if (_action === "sign_and_schedule") {
            return handleSignAndSchedule(formData, userId, mode);
        }

        // Save as draft
        if (_action === "save_as_draft") {
            return handleSaveAsDraft(formData, userId, mode);
        }

        const { ValidationError } = await import("~/lib/errors");
        throw new ValidationError("Invalid action", { action: _action });
    } catch (error) {
        const { handleActionError } = await import("~/lib/error-handler.server");
        return handleActionError(error);
    }
}
