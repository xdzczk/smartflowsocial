/**
 * Server-side action handlers for bulk posts
 * Extracted from dashboard.bulkposts.tsx
 */
import { json, redirect } from "@remix-run/node";
import { z } from "zod";

import { requireUserId } from "~/features/auth";
import type { NostrEvent, SignedEvent } from "~/features/nostr/types";
import { logInfo } from "~/lib/error-logger.server";
import { RateLimitError } from "~/lib/errors";
import { checkUserPostCreationLimit } from "~/lib/rate-limit.server";
import {
  signAndScheduleSchema,
  saveAsDraftSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { updatePost } from "~/models/post.commands.server";
import { isVideoUrl } from "~/utils/media-helpers";

import { CreatePostUseCase } from "./use-cases/create-post.use-case.server";

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
  const startTime = Date.now();
  try {
    // Optimize: Parse JSON first for large datasets to avoid full Zod validation overhead
    const uploadResultsRaw = formData.get("uploadResults");
    let uploadResults: UploadResult[] = [];

    if (typeof uploadResultsRaw === "string") {
      try {
        const parsed = JSON.parse(uploadResultsRaw) as unknown;
        if (Array.isArray(parsed)) {
          uploadResults = parsed as UploadResult[];
        } else {
          return json(
            { error: "Invalid upload results format" },
            { status: 400 }
          );
        }
      } catch {
        return json({ error: "Invalid upload results JSON" }, { status: 400 });
      }
    } else {
      return json({ error: "Upload results missing" }, { status: 400 });
    }

    // Get arrays directly (faster than full Zod validation for large arrays)
    const scheduledDates = formData.getAll("scheduledDates");
    const queueTypes = formData.getAll("queueTypes");

    // Basic validation
    if (uploadResults.length === 0) {
      return json(
        { error: "At least one upload result is required" },
        { status: 400 }
      );
    }

    if (
      scheduledDates.length !== uploadResults.length ||
      queueTypes.length !== uploadResults.length
    ) {
      return json(
        { error: "Mismatch between upload results and post data" },
        { status: 400 }
      );
    }

    const parseTime = Date.now() - startTime;
    console.info(
      `[BulkPosts Server] Parsed ${uploadResults.length} upload results in ${parseTime}ms`
    );

    const fileUrls = uploadResults.map(
      (result: UploadResult, index: number) => ({
        fileUrl: result.file?.url ?? "",
        scheduledFor: String(scheduledDates[index] ?? ""),
        queueType: String(queueTypes[index] ?? ""),
      })
    );

    const totalTime = Date.now() - startTime;
    console.info(
      `[BulkPosts Server] handleUploadImagesPreview completed in ${totalTime}ms`
    );

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
    const scheduleSchema = z
      .object({
        _action: z.literal("sign_and_schedule"),
      })
      .merge(signAndScheduleSchema);

    const result = validateFormDataOrRespond(formData, scheduleSchema);
    if (!result.success) {
      return result.response;
    }

    const validatedData = result.data;
    const signedEvents = validatedData.signedEvents as SignedEvent[];
    const nostrEvents = validatedData.nostrEvent as NostrEvent[];
    const captions = validatedData.caption;
    const fileUrls = validatedData.fileUrl;
    const queueTypes = validatedData.queueType;
    const isRecyclableFlags = validatedData.isRecyclable;
    const originalPostIds = validatedData.originalPostId.filter(
      (id: string) => id && id !== ""
    );

    // Check per-user post creation rate limit before processing
    const postCount = signedEvents.length;
    const rateLimitCheck = await checkUserPostCreationLimit(
      userId,
      postCount,
      60, // 60 minute window
      2000 // Max 2000 posts per hour
    );

    if (!rateLimitCheck.allowed) {
      throw new RateLimitError(
        rateLimitCheck.error ??
          "Post creation limit exceeded. Please try again later.",
        {
          remaining: rateLimitCheck.remaining,
          resetTime: rateLimitCheck.resetTime,
          requested: postCount,
        }
      );
    }

    logInfo("Bulk post creation rate limit check passed", {
      userId,
      postCount,
      remaining: rateLimitCheck.remaining,
      resetTime: rateLimitCheck.resetTime,
    });

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
        if (!fileUrl) {
          throw new Error(`File URL is missing for post at index ${index}`);
        }
        const tags = signedEvent.tags
          .map((tagArray: string[]) => tagArray[1])
          .filter((tag): tag is string => typeof tag === "string");
        const queueType = queueTypes[index] ?? "unassigned";
        const isRecyclableFlag = isRecyclableFlags[index];
        const isRecyclable =
          typeof isRecyclableFlag === "string"
            ? isRecyclableFlag === "true" ||
              String(isRecyclableFlag).toLowerCase() === "true"
            : Boolean(isRecyclableFlag);

        // Enhanced detection for quote posts
        const hasEventTags = signedEvent.tags.some(
          (tag: string[]) => tag[0] === "e" && tag[3] === "mention"
        );
        const isQuotePost =
          mode === "quote" || (signedEvent.kind === 1 && hasEventTags);
        logInfo("Calculated isQuotePost", {
          isQuotePost,
          mode,
          hasEventTags,
          userId,
        });

        // Determine post type based on file URL
        const isVideo = isVideoUrl(fileUrl);
        const postType = isVideo ? "VIDEO" : "IMAGE";

        // Use CreatePostUseCase for bulk post creation
        const createPostUseCase = new CreatePostUseCase();
        const result = await createPostUseCase.execute({
          userId,
          content,
          caption: captions[index] ?? undefined,
          fileUrl: [fileUrl],
          postType,
          queueType, // Pass queue type name - use case will resolve
          tags, // Tags extracted from signedEvent
          isRecyclable,
          signedEvent: signedEvent,
          nostrEvent: nostrEvents[index],
          scheduledFor: signedEvent.created_at, // Schedule for the timestamp in the event
          repost: signedEvent.kind === 6, // Mark as repost if it's kind 6
          isQuotedPost: isQuotePost, // Mark as quoted post
        });

        logInfo("Created post", {
          postId: result.post.id,
          index,
          queueTypeId: result.post.queueTypeId,
          userId,
        });
        return result.post;
      })
    );

    // If this is a recycle mode (posts have original post IDs), mark original posts as non-recyclable
    if (mode === "recycle" && originalPostIds.length > 0) {
      await markOriginalPostsAsNonRecyclable(originalPostIds, userId);
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
    const draftSchema = z
      .object({
        _action: z.literal("save_as_draft"),
      })
      .merge(saveAsDraftSchema);

    const result = validateFormDataOrRespond(formData, draftSchema);
    if (!result.success) {
      return result.response;
    }

    const validatedData = result.data;
    const fileUrls = validatedData.fileUrl;
    const captions = validatedData.caption;
    const queueTypes = validatedData.queueType;
    const _scheduledFors = validatedData.scheduledFor;
    const originalPostIds = validatedData.originalPostId.filter(
      (id: string) => id && id !== ""
    );
    const isRecyclableFlags = formData.getAll("isRecyclable");

    // Check per-user post creation rate limit before processing
    const postCount = fileUrls.length;
    const rateLimitCheck = await checkUserPostCreationLimit(
      userId,
      postCount,
      60, // 60 minute window
      2000 // Max 2000 posts per hour
    );

    if (!rateLimitCheck.allowed) {
      throw new RateLimitError(
        rateLimitCheck.error ??
          "Post creation limit exceeded. Please try again later.",
        {
          remaining: rateLimitCheck.remaining,
          resetTime: rateLimitCheck.resetTime,
          requested: postCount,
        }
      );
    }

    logInfo("Bulk draft creation rate limit check passed", {
      userId,
      postCount,
      remaining: rateLimitCheck.remaining,
      resetTime: rateLimitCheck.resetTime,
    });

    await Promise.all(
      fileUrls.map(async (fileUrl: string, index: number) => {
        const caption = captions[index] ?? "";
        const queueType = queueTypes[index] ?? "unassigned";
        const isRecyclableFlag = isRecyclableFlags[index];
        const isRecyclable =
          typeof isRecyclableFlag === "string"
            ? isRecyclableFlag === "true" ||
              String(isRecyclableFlag).toLowerCase() === "true"
            : Boolean(isRecyclableFlag);

        // Determine post type based on file URL
        const isVideo = isVideoUrl(fileUrl);
        const postType = isVideo ? "VIDEO" : "IMAGE";

        // Use CreatePostUseCase for bulk draft creation
        const createPostUseCase = new CreatePostUseCase();
        const result = await createPostUseCase.execute({
          userId,
          content: caption,
          caption: caption,
          fileUrl: [fileUrl],
          postType,
          queueType, // Pass queue type name - use case will resolve
          isRecyclable,
          // No scheduledFor = draft
        });

        return result.post;
      })
    );

    // If this is a recycle mode (posts have original post IDs) and user saved as draft,
    // we might still want to mark them as non-recyclable to prevent confusion
    if (mode === "recycle" && originalPostIds.length > 0) {
      await markOriginalPostsAsNonRecyclable(originalPostIds, userId, true);
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
  isDraft = false
) {
  logInfo(
    `Marking original posts as non-recyclable${isDraft ? " (draft)" : ""}`,
    {
      originalPostIds,
      userId,
      isDraft,
    }
  );

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
