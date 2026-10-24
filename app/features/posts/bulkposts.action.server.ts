/**
 * Server-side action handlers for bulk posts
 * Extracted from dashboard.bulkposts.tsx
 */
import { json, redirect } from "@remix-run/node";
import { z } from "zod";

import { requireUserId } from "~/features/auth";
import type { NostrEvent, SignedEvent } from "~/features/nostr/types";
import { getUserSubscription } from "~/features/payments/data/payment.queries.server";
import { bulkBlockedMessage } from "~/features/payments/entitlements/entitlement-messages";
import { getPlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";
import {
  assertScheduleCapacity,
  ScheduleCapExceededError,
} from "~/features/payments/entitlements/schedule-cap-policy.server";
import {
  getUserPlanType,
  type UserSubscription,
} from "~/features/payments/types";
import { createPostWithOutbox, updatePost } from "~/features/posts/server";
import {
  createDraftGroupVersion,
  deleteDraftGroupPosts,
  getOrCreateDraftGroup,
  type BulkDraftSnapshotRow,
} from "~/features/posts/server/drafts";
import { getCorrelationId } from "~/lib/correlation-context.server";
import { logInfo } from "~/lib/error-logger.server";
import { RateLimitError } from "~/lib/errors";
import { recordPostScheduled } from "~/lib/metrics/business-metrics.server";
import { checkUserPostCreationLimit } from "~/lib/rate-limit.server";
import { nowMillis, fromUnixTimestamp, toPrismaDate } from "~/lib/temporal";
import {
  signAndScheduleSchema,
  saveAsDraftSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { isVideoUrl } from "~/utils/media-helpers";

import { CreatePostUseCase } from "./composer/index.server";
import { updateDraftGroup as updateDraftGroupRow } from "./repositories/draft-data.server";
import { updatePost as updatePostInRepo } from "./repositories/post-queries-data.server";
import { signedFollowUpPersistence } from "./scheduling/signed-follow-up";
import { resolveQueueTypeId } from "./services/queue-type-resolver.server";
import { PostStateMachine } from "./state-machine/post-state-machine.server";

function getSignedEventIdFromUnknown(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!("id" in value)) return null;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function toUnixSeconds(value: unknown): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : Math.floor(value.getTime() / 1000);
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? null
      : Math.floor(parsed.getTime() / 1000);
  }
  return null;
}

function countSerializedScheduleEntries(values: unknown[]): number {
  let count = 0;
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) continue;
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) {
        count += parsed.length;
      }
    } catch {
      // Ignore malformed follow-up payloads; downstream validation handles them.
    }
  }
  return count;
}

/**
 * Handle file upload preview: accepts fileUrls (array of URL arrays per post).
 * Returns 400 if fileUrls is missing or invalid.
 */
export async function handleUploadImagesPreview(formData: FormData) {
  const startTime = nowMillis();
  try {
    const scheduledDates = formData.getAll("scheduledDates");
    const queueTypes = formData.getAll("queueTypes");

    const fileUrlsRaw = formData.get("fileUrls");
    if (typeof fileUrlsRaw !== "string") {
      return json(
        { error: "fileUrls is required (JSON array of URL arrays per post)" },
        { status: 400 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(fileUrlsRaw);
    } catch {
      return json({ error: "Invalid fileUrls JSON" }, { status: 400 });
    }

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
    logInfo("[BulkPosts] handleUploadImagesPreview completed", {
      postCount: fileUrls.length,
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
    const nominalScheduledForRaw = validatedData.nominalScheduledFor;
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

    const subRow = await getUserSubscription(userId);
    const userSub: UserSubscription | null = subRow?.planId
      ? {
          planId: subRow.planId,
          status: subRow.status,
          currentPeriodEnd: subRow.currentPeriodEnd ?? undefined,
          Plan: subRow.Plan
            ? {
                name: subRow.Plan.name,
                id: subRow.Plan.id,
                enableLifetimeAccess: subRow.Plan.enableLifetimeAccess
                  ? true
                  : undefined,
              }
            : undefined,
        }
      : null;
    if (!getPlanEntitlements(getUserPlanType(userSub)).canExecuteBulkActions) {
      return json(
        {
          error: bulkBlockedMessage(),
        },
        { status: 403 }
      );
    }

    const requestedScheduleCount =
      signedEvents.length +
      countSerializedScheduleEntries(repostSchedulesRaw) +
      countSerializedScheduleEntries(quoteSchedulesRaw);
    try {
      await assertScheduleCapacity(userId, requestedScheduleCount);
    } catch (error) {
      if (error instanceof ScheduleCapExceededError) {
        return json({ error: error.message }, { status: 403 });
      }
      throw error;
    }

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

        // Nominal slot time (unix sec) when a random window jittered the actual
        // publish time. Persisted so queue "next slot" cadence ignores jitter.
        const nominalScheduledForStr =
          index < nominalScheduledForRaw.length
            ? nominalScheduledForRaw[index]
            : "";
        const nominalScheduledForParsed =
          nominalScheduledForStr && nominalScheduledForStr.trim() !== ""
            ? Number(nominalScheduledForStr)
            : undefined;
        const nominalScheduledFor =
          nominalScheduledForParsed != null &&
          Number.isFinite(nominalScheduledForParsed)
            ? nominalScheduledForParsed
            : undefined;

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
          nominalScheduledFor, // Original queue slot time when jittered
          repost: signedEvent.kind === 6, // Mark as repost if it's kind 6
          isQuotedPost: isQuotePost, // Mark as quoted post
          repostOfPostId:
            mode === "repost" && originalPostId ? originalPostId : undefined,
          quoteOfPostId:
            mode === "quote" && originalPostId ? originalPostId : undefined,
          postKind:
            mode === "repost" ? "REPOST" : mode === "quote" ? "QUOTE" : "POST",
          skipScheduleCapacityCheck: true,
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
      const parentScheduledForUnix = toUnixSeconds(mainPost.scheduledAtUtc);
      const expectedParentEventId =
        (typeof mainPost.nostrEventId === "string" && mainPost.nostrEventId) ||
        getSignedEventIdFromUnknown(mainPost.signedEvent);
      const isAttachableParent = parentScheduledForUnix != null;
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
            signedEvent?: SignedEvent | null;
            minReactions?: number;
            minZaps?: number;
            minComments?: number;
            minReposts?: number;
            minSats?: number;
          }>;
          if (Array.isArray(repostList)) {
            for (const item of repostList) {
              const repostScheduledForDate = toPrismaDate(
                fromUnixTimestamp(item.scheduledFor, "UTC")
              );
              // Normalize signedEvent to a plain object so it survives JSON round-trip in outbox payload
              const raw = item.signedEvent;
              const normalizedRepostSignedEvent =
                raw != null && typeof raw === "object" && !Array.isArray(raw)
                  ? (JSON.parse(JSON.stringify(raw)) as SignedEvent)
                  : raw != null
                    ? (raw as SignedEvent)
                    : null;
              if (normalizedRepostSignedEvent == null) {
                logInfo("Bulk repost skipped: missing signedEvent", {
                  index: i,
                  mainPostId: mainPost.id,
                });
                continue;
              }
              const conditions: {
                minReactions?: number;
                minZaps?: number;
                minComments?: number;
                minReposts?: number;
                minSats?: number;
              } = {};
              if (item.minReactions != null && item.minReactions >= 0)
                conditions.minReactions = item.minReactions;
              if (item.minZaps != null && item.minZaps >= 0)
                conditions.minZaps = item.minZaps;
              if (item.minComments != null && item.minComments >= 0)
                conditions.minComments = item.minComments;
              if (item.minReposts != null && item.minReposts >= 0)
                conditions.minReposts = item.minReposts;
              if (item.minSats != null && item.minSats >= 0)
                conditions.minSats = item.minSats;
              const repostConditions =
                Object.keys(conditions).length > 0 ? conditions : null;
              const repostPost = await createPostWithOutbox(
                {
                  userId,
                  content: "",
                  caption: "",
                  fileUrl: [],
                  postType: mainPost.postType,
                  queueTypeId,
                  isRecyclable,
                  signedEvent: normalizedRepostSignedEvent,
                  scheduledAtUtc: repostScheduledForDate ?? item.scheduledFor,
                  tags: [],
                  repost: true,
                  isQuotedPost: false,
                  repostOfPostId: mainPost.id,
                  postKind: "REPOST",
                  ...(isAttachableParent
                    ? {
                        parentScheduledActionId: mainPost.id,
                        rootScheduledActionId:
                          typeof mainPost.rootScheduledActionId === "string" &&
                          mainPost.rootScheduledActionId
                            ? mainPost.rootScheduledActionId
                            : mainPost.id,
                        targetScheduledActionId: mainPost.id,
                        dependencyMode: "attached" as const,
                        targetMode: "scheduled_parent" as const,
                        followUpTimingMode: "offset_from_parent" as const,
                        followUpOffsetSeconds: Math.max(
                          0,
                          item.scheduledFor - parentScheduledForUnix
                        ),
                        expectedParentEventId:
                          expectedParentEventId ?? undefined,
                      }
                    : {
                        dependencyMode: "standalone" as const,
                        targetMode: "direct" as const,
                      }),
                  ...(repostConditions && { repostConditions }),
                  ...(signedFollowUpPersistence(normalizedRepostSignedEvent) ??
                    {}),
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
            signedEvent?: SignedEvent | null;
            caption?: string;
          }>;
          if (Array.isArray(quoteList)) {
            for (const item of quoteList) {
              const quoteScheduledForDate = toPrismaDate(
                fromUnixTimestamp(item.scheduledFor, "UTC")
              );
              const quoteCaption = item.caption ?? "";
              // Normalize signedEvent to a plain object so it survives JSON round-trip in outbox payload
              const raw = item.signedEvent;
              const normalizedQuoteSignedEvent =
                raw != null && typeof raw === "object" && !Array.isArray(raw)
                  ? (JSON.parse(JSON.stringify(raw)) as SignedEvent)
                  : raw != null
                    ? (raw as SignedEvent)
                    : null;
              if (normalizedQuoteSignedEvent == null) {
                logInfo("Bulk quote skipped: missing signedEvent", {
                  index: i,
                  mainPostId: mainPost.id,
                });
                continue;
              }
              const quotePost = await createPostWithOutbox(
                {
                  userId,
                  content: quoteCaption,
                  caption: quoteCaption,
                  fileUrl: [],
                  postType: mainPost.postType,
                  queueTypeId,
                  isRecyclable,
                  signedEvent: normalizedQuoteSignedEvent,
                  scheduledAtUtc: quoteScheduledForDate ?? item.scheduledFor,
                  tags: [],
                  repost: false,
                  isQuotedPost: true,
                  quoteOfPostId: mainPost.id,
                  postKind: "QUOTE",
                  ...(isAttachableParent
                    ? {
                        parentScheduledActionId: mainPost.id,
                        rootScheduledActionId:
                          typeof mainPost.rootScheduledActionId === "string" &&
                          mainPost.rootScheduledActionId
                            ? mainPost.rootScheduledActionId
                            : mainPost.id,
                        targetScheduledActionId: mainPost.id,
                        dependencyMode: "attached" as const,
                        targetMode: "scheduled_parent" as const,
                        followUpTimingMode: "offset_from_parent" as const,
                        followUpOffsetSeconds: Math.max(
                          0,
                          item.scheduledFor - parentScheduledForUnix
                        ),
                        expectedParentEventId:
                          expectedParentEventId ?? undefined,
                      }
                    : {
                        dependencyMode: "standalone" as const,
                        targetMode: "direct" as const,
                      }),
                  ...(signedFollowUpPersistence(normalizedQuoteSignedEvent) ??
                    {}),
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

    // When submitted from in-page modal, return JSON so the client can show success without navigating
    const inModal = formData.get("_inModal") === "1";
    if (inModal && firstPostId) {
      return json({
        bulkScheduled: true,
        count: createdPostCount,
        firstPostId,
        lastScheduledAt,
        queueSummary,
      });
    }

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

        await updatePostInRepo(createResult.post.id, userId, {
          draftGroupId: groupId,
        });

        return createResult.post;
      })
    );

    await updateDraftGroupRow(groupId, userId, { updatedAt: new Date() });
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
