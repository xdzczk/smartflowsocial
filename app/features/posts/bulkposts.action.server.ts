/**
 * Server-side action handlers for bulk posts
 * Extracted from dashboard.bulkposts.tsx
 */
import { json, redirect } from "@remix-run/node";
import { z } from "zod";

import { requireUserId } from "~/features/auth";
import type { NostrEvent, SignedEvent } from "~/features/nostr/types";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo } from "~/lib/error-logger.server";
import { RateLimitError } from "~/lib/errors";
import { recordPostScheduled } from "~/lib/metrics/business-metrics.server";
import { prisma } from "~/lib/prisma.server";
import { checkUserPostCreationLimit } from "~/lib/rate-limit.server";
import { nowMillis, fromUnixTimestamp, toPrismaDate } from "~/lib/temporal";
import {
  signAndScheduleSchema,
  saveAsDraftSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import {
  createPostWithOutbox,
  updatePost,
} from "~/models/post.commands.server";
import { isVideoUrl } from "~/utils/media-helpers";

import {
  createDraftGroupVersion,
  deleteDraftGroupPosts,
  getOrCreateDraftGroup,
  type BulkDraftSnapshotRow,
} from "./services/draft-group.server";
import { resolveQueueTypeId } from "./services/queue-type-resolver.server";
import { PostStateMachine } from "./state-machine/post-state-machine.server";
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
 * Handle file upload preview results from client-side upload system.
 * Accepts either fileUrls (array of URL arrays per post) or legacy uploadResults.
 */
export async function handleUploadImagesPreview(formData: FormData) {
  const startTime = nowMillis();
  try {
    const scheduledDates = formData.getAll("scheduledDates");
    const queueTypes = formData.getAll("queueTypes");

    const fileUrlsRaw = formData.get("fileUrls");
    if (typeof fileUrlsRaw === "string") {
      try {
        const parsed = JSON.parse(fileUrlsRaw) as unknown;
        if (!Array.isArray(parsed)) {
          return json({ error: "Invalid fileUrls format" }, { status: 400 });
        }
        const fileUrlsPerPost = parsed as string[][];
        if (
          fileUrlsPerPost.length !== scheduledDates.length ||
          fileUrlsPerPost.length !== queueTypes.length
        ) {
          return json(
            { error: "Mismatch between fileUrls and post data" },
            { status: 400 }
          );
        }
        const fileUrls = fileUrlsPerPost.map((urls, index) => ({
          fileUrl: Array.isArray(urls)
            ? urls.filter((u): u is string => typeof u === "string")
            : [],
          scheduledFor: String(scheduledDates[index] ?? ""),
        }));
        const totalTime = nowMillis() - startTime;
        logInfo("[BulkPosts] handleUploadImagesPreview (fileUrls) completed", {
          postCount: fileUrls.length,
          totalTimeMs: totalTime,
        });
        return json({ success: true, fileUrls });
      } catch {
        return json({ error: "Invalid fileUrls JSON" }, { status: 400 });
      }
    }

    // Legacy: uploadResults (one URL per post)
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
      return json(
        { error: "Upload results or fileUrls missing" },
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

    const fileUrls = uploadResults.map(
      (result: UploadResult, index: number) => ({
        fileUrl: (result.file?.url ?? "") ? [result.file?.url ?? ""] : [],
        scheduledFor: String(scheduledDates[index] ?? ""),
      })
    );

    const totalTime = nowMillis() - startTime;
    logInfo("[BulkPosts] handleUploadImagesPreview completed", {
      uploadResultsCount: uploadResults.length,
      totalTimeMs: totalTime,
    });

    return json({ success: true, fileUrls });
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

/**
 * Handle sign and schedule posts action
 */
/* eslint-disable-next-line sonarjs/cognitive-complexity -- Single handler with multiple branches; splitting would obscure flow */
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
    const repostSchedulesRaw = validatedData.repostSchedules;
    const quoteSchedulesRaw = validatedData.quoteSchedules;
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

    const createdPosts = await Promise.all(
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

        const fileUrlArr = fileUrls[index] ?? [];
        const fileUrl =
          Array.isArray(fileUrlArr) && fileUrlArr.length > 0 ? fileUrlArr : [];
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

        const firstUrl = fileUrl[0] ?? "";
        const isTextOnly = fileUrl.length === 0 || !firstUrl.trim();
        const isVideo = !isTextOnly && isVideoUrl(firstUrl);
        const postType = isTextOnly ? "TEXT" : isVideo ? "VIDEO" : "IMAGE";

        const originalPostId =
          index < originalPostIds.length ? originalPostIds[index] : undefined;

        // Use CreatePostUseCase for bulk post creation
        const createPostUseCase = new CreatePostUseCase();
        const result = await createPostUseCase.execute({
          userId,
          content,
          caption: captions[index] ?? undefined,
          fileUrl: isTextOnly ? [] : fileUrl,
          postType,
          queueType, // Pass queue type name - use case will resolve
          tags, // Tags extracted from signedEvent
          isRecyclable,
          signedEvent: signedEvent,
          nostrEvent: nostrEvents[index],
          scheduledFor: signedEvent.created_at, // Schedule for the timestamp in the event
          repost: signedEvent.kind === 6, // Mark as repost if it's kind 6
          isQuotedPost: isQuotePost, // Mark as quoted post
          repostOfPostId:
            mode === "repost" && originalPostId ? originalPostId : undefined,
          quoteOfPostId:
            mode === "quote" && originalPostId ? originalPostId : undefined,
          postKind:
            mode === "repost" ? "REPOST" : mode === "quote" ? "QUOTE" : "POST",
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

    const correlationId = getCorrelationId();
    const stateMachine = new PostStateMachine();

    for (let i = 0; i < createdPosts.length; i++) {
      const mainPost = createdPosts[i];
      if (!mainPost) continue;
      const queueTypeName = queueTypes[i] ?? "unassigned";
      const queueTypeId = await resolveQueueTypeId(
        userId,
        null,
        queueTypeName === "Unassigned" ? null : queueTypeName
      );
      const isRecyclableFlag = isRecyclableFlags[i];
      const isRecyclable =
        typeof isRecyclableFlag === "string"
          ? isRecyclableFlag === "true" ||
            String(isRecyclableFlag).toLowerCase() === "true"
          : Boolean(isRecyclableFlag);

      const repostStr = repostSchedulesRaw[i];
      if (repostStr && typeof repostStr === "string") {
        try {
          const repostList = JSON.parse(repostStr) as Array<{
            scheduledFor: number;
            signedEvent: SignedEvent;
          }>;
          if (Array.isArray(repostList)) {
            for (const item of repostList) {
              const repostScheduledForDate = toPrismaDate(
                fromUnixTimestamp(item.scheduledFor, "UTC")
              );
              const repostPost = await createPostWithOutbox(
                {
                  userId,
                  content: "",
                  caption: "",
                  fileUrl: [],
                  postType: mainPost.postType,
                  queueTypeId,
                  isRecyclable,
                  signedEvent: item.signedEvent,
                  scheduledFor: repostScheduledForDate,
                  tags: [],
                  repost: true,
                  isQuotedPost: false,
                  repostOfPostId: mainPost.id,
                  postKind: "REPOST",
                },
                item.scheduledFor,
                correlationId
              );
              await stateMachine.transition(
                repostPost.id,
                userId,
                "SCHEDULED",
                "Repost created with schedule"
              );
              recordPostScheduled(mainPost.postType);
            }
          }
        } catch (e) {
          logInfo("Bulk repost schedule parse/create failed", {
            index: i,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      const quoteStr = quoteSchedulesRaw[i];
      if (quoteStr && typeof quoteStr === "string") {
        try {
          const quoteList = JSON.parse(quoteStr) as Array<{
            scheduledFor: number;
            signedEvent: SignedEvent;
            caption?: string;
          }>;
          if (Array.isArray(quoteList)) {
            for (const item of quoteList) {
              const quoteScheduledForDate = toPrismaDate(
                fromUnixTimestamp(item.scheduledFor, "UTC")
              );
              const quoteCaption = item.caption ?? "";
              const quotePost = await createPostWithOutbox(
                {
                  userId,
                  content: quoteCaption,
                  caption: quoteCaption,
                  fileUrl: [],
                  postType: mainPost.postType,
                  queueTypeId,
                  isRecyclable,
                  signedEvent: item.signedEvent,
                  scheduledFor: quoteScheduledForDate,
                  tags: [],
                  repost: false,
                  isQuotedPost: true,
                  quoteOfPostId: mainPost.id,
                  postKind: "QUOTE",
                },
                item.scheduledFor,
                correlationId
              );
              await stateMachine.transition(
                quotePost.id,
                userId,
                "SCHEDULED",
                "Quote post created with schedule"
              );
              recordPostScheduled(mainPost.postType);
            }
          }
        } catch (e) {
          logInfo("Bulk quote schedule parse/create failed", {
            index: i,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    // If this is a recycle mode (posts have original post IDs), mark original posts as non-recyclable
    if (mode === "recycle" && originalPostIds.length > 0) {
      await markOriginalPostsAsNonRecyclable(originalPostIds, userId);
    }

    // Redirect back to bulk posts page with success info, or to scheduled page
    const createdPostCount = createdPosts.length;
    const firstPostId = createdPosts[0]?.id;
    const lastPost = createdPosts[createdPostCount - 1];
    const lastScheduledAt =
      lastPost?.scheduledAtUtc instanceof Date
        ? lastPost.scheduledAtUtc.toISOString()
        : typeof lastPost?.scheduledAtUtc === "string"
          ? lastPost.scheduledAtUtc
          : "";
    const queueSummary = queueTypes.reduce(
      (acc: Record<string, number>, name) => {
        const n = name || "unassigned";
        acc[n] = (acc[n] ?? 0) + 1;
        return acc;
      },
      {}
    );

    // If we have a first post ID, redirect to bulk posts page with success params
    // Otherwise, redirect to scheduled page
    if (firstPostId) {
      const baseUrl = `/dashboard/bulkposts`;
      const params = new URLSearchParams();
      if (mode) {
        params.set("mode", mode);
      }
      params.set("bulkScheduled", "true");
      params.set("count", createdPostCount.toString());
      params.set("firstPostId", firstPostId);
      if (lastScheduledAt) {
        params.set("lastScheduledAt", lastScheduledAt);
      }
      params.set("queueSummary", JSON.stringify(queueSummary));
      return redirect(`${baseUrl}?${params.toString()}`);
    }

    return redirect(`/dashboard/scheduled`);
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

/**
 * Handle save as draft action. Creates or updates a DraftGroup, sets draftGroupId on each post, and creates a DraftGroupVersion snapshot.
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
    const scheduledFors = validatedData.scheduledFor;
    const originalPostIds = validatedData.originalPostId.filter(
      (id: string) => id && id !== ""
    );
    const isRecyclableFlags = formData.getAll("isRecyclable");

    const groupIdParam = formData.get("groupId");
    const groupIdFromForm =
      typeof groupIdParam === "string" && groupIdParam.length > 0
        ? groupIdParam
        : null;

    const { groupId } = await getOrCreateDraftGroup(userId, groupIdFromForm);
    if (groupIdFromForm) {
      await deleteDraftGroupPosts(groupId, userId);
    }

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

    const snapshotRows: BulkDraftSnapshotRow[] = [];

    const _createdPosts = await Promise.all(
      fileUrls.map(async (fileUrlArr: string[], index: number) => {
        const caption = captions[index] ?? "";
        const queueType = queueTypes[index] ?? "unassigned";
        const scheduledForStr = scheduledFors[index] ?? "";
        const isRecyclableFlag = isRecyclableFlags[index];
        const isRecyclable =
          typeof isRecyclableFlag === "string"
            ? isRecyclableFlag === "true" ||
              String(isRecyclableFlag).toLowerCase() === "true"
            : Boolean(isRecyclableFlag);

        const queueTypeId = await resolveQueueTypeId(
          userId,
          null,
          queueType === "Unassigned" ? null : queueType
        );

        const urls = Array.isArray(fileUrlArr) ? fileUrlArr : [];
        const isTextOnly = urls.length === 0;
        const firstUrl = urls[0] ?? "";

        snapshotRows.push({
          caption,
          fileUrl: urls,
          queueTypeId,
          scheduledFor: scheduledForStr || null,
          sortOrder: index,
          isRecyclable,
        });

        const isVideo = !isTextOnly && isVideoUrl(firstUrl);
        const postType = isTextOnly ? "TEXT" : isVideo ? "VIDEO" : "IMAGE";

        const createPostUseCase = new CreatePostUseCase();
        const createResult = await createPostUseCase.execute({
          userId,
          content: caption,
          caption: caption,
          fileUrl: urls,
          postType,
          queueType,
          isRecyclable,
        });

        await prisma.post.update({
          where: { id: createResult.post.id, userId },
          data: { draftGroupId: groupId },
        });

        return createResult.post;
      })
    );

    await prisma.draftGroup.update({
      where: { id: groupId, userId },
      data: { updatedAt: new Date() },
    });
    await createDraftGroupVersion(groupId, snapshotRows, userId);

    if (mode === "recycle" && originalPostIds.length > 0) {
      await markOriginalPostsAsNonRecyclable(originalPostIds, userId, true);
    }

    return redirect(`/dashboard/drafts?tab=bulk`);
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
