/**
 * Queue type action handlers
 */

import { json } from "@remix-run/node";

import { getUserSubscription } from "~/features/payments/data";
import { queueCapExceededMessage } from "~/features/payments/entitlements/entitlement-messages";
import { getPlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";
import {
  getUserPlanType,
  type UserSubscription,
} from "~/features/payments/types";
import {
  pauseQueueById,
  resumeQueueById,
} from "~/features/posts/data/queue-pause-resume.server";
import { getQueueColorBundle } from "~/features/posts/queue-colors";
import {
  deleteLongFormPost,
  deletePost,
  getScheduledLongFormPosts,
  getScheduledPosts,
} from "~/features/posts/server";
import {
  deleteQueueType,
  getQueueTypeByIdForUser,
  hashTagPresetExistsForUser,
  updateQueueType,
} from "~/features/user";
import { countQueueTypesForUser } from "~/features/user/repositories/queue-types-data.server";
import { invalidateQueueTypesCache } from "~/features/user/services/user-cache.server";
import {
  createQueueTypeSchema,
  updateQueueTypeSchema,
  deleteQueueTypeSchema,
  queueStatusActionSchema,
  toggleQueueEnabledSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

// ============================================================================
// Helper Functions
// ============================================================================

/** Serialize a queue type for the client (create/update response) */
function queueTypeToClient(qt: Awaited<ReturnType<typeof updateQueueType>>): {
  id: string;
  name: string;
  colorToken: string | null;
  color: string | null;
  description: string | null;
  scheduleType: string;
  scheduleConfig: unknown;
  status: "active" | "paused" | "archived";
  isEnabled: boolean;
  userId: string;
  isDefault?: boolean;
  hashTagPreset?: {
    id: string;
    name: string;
    tags: string;
    description?: string | null;
  } | null;
  includeHashtagsInNoteBody: boolean;
} {
  /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for callers that may pass null/undefined */
  if (qt == null) {
    throw new Error("Queue type is required");
  }
  const preset = "hashTagPreset" in qt && qt.hashTagPreset;
  const token = qt.colorToken ?? null;
  const bundle = getQueueColorBundle(token);
  return {
    id: qt.id,
    name: qt.name,
    colorToken: token,
    color: bundle.accent,
    description: qt.description,
    scheduleType: qt.scheduleType,
    scheduleConfig: qt.scheduleConfig,
    status:
      qt.status === "PAUSED"
        ? "paused"
        : qt.status === "ARCHIVED"
          ? "archived"
          : "active",
    isEnabled: qt.isEnabled,
    userId: qt.userId,
    isDefault: "isDefault" in qt ? qt.isDefault : false,
    hashTagPreset:
      preset && typeof preset === "object" && "id" in preset && "name" in preset
        ? {
            id: String(preset.id),
            name: String(preset.name),
            tags:
              "tags" in preset && typeof preset.tags === "string"
                ? preset.tags
                : "",
            description:
              "description" in preset
                ? ((preset.description as string | null) ?? null)
                : null,
          }
        : null,
    includeHashtagsInNoteBody: qt.includeHashtagsInNoteBody !== false,
  };
}

function rowToUserSubscription(
  sub: Awaited<ReturnType<typeof getUserSubscription>>
): UserSubscription | null {
  if (!sub?.planId) return null;
  return {
    planId: sub.planId,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd ?? undefined,
    Plan: sub.Plan
      ? {
          name: sub.Plan.name,
          id: sub.Plan.id,
          enableLifetimeAccess: sub.Plan.enableLifetimeAccess
            ? true
            : undefined,
        }
      : undefined,
  };
}

async function checkQueueCreationCap(userId: string): Promise<Response | null> {
  const row = await getUserSubscription(userId);
  const planType = getUserPlanType(rowToUserSubscription(row));
  const { maxQueues } = getPlanEntitlements(planType);
  if (maxQueues == null) return null;
  const count = await countQueueTypesForUser(userId);
  if (count >= maxQueues) {
    return json(
      {
        error: queueCapExceededMessage(maxQueues),
      },
      { status: 403 }
    );
  }
  return null;
}

async function validateHashtagPreset(
  userId: string,
  hashTagPresetId: string | null | undefined
): Promise<Response | null> {
  if (!hashTagPresetId) {
    return null;
  }
  const presetExists = await hashTagPresetExistsForUser(
    userId,
    hashTagPresetId
  );
  if (!presetExists) {
    return json(
      { error: "Selected hashtag preset does not exist" },
      { status: 400 }
    );
  }
  return null;
}

function normalizeWeeklySlotTime(time: string): string | null {
  const parts = String(time).trim().split(":");
  if (parts.length !== 2) {
    return null;
  }
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeAndDedupeWeeklySlots(
  weeklySlots: Array<{ dayOfWeek: number; time: string }> | undefined
): Array<{ dayOfWeek: number; time: string }> {
  if (!weeklySlots || weeklySlots.length === 0) {
    return [];
  }

  const unique = new Map<string, { dayOfWeek: number; time: string }>();
  for (const slot of weeklySlots) {
    const dayOfWeek = Number(slot.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      continue;
    }
    const normalizedTime = normalizeWeeklySlotTime(slot.time);
    if (!normalizedTime) {
      continue;
    }
    const key = `${dayOfWeek}-${normalizedTime}`;
    if (!unique.has(key)) {
      unique.set(key, { dayOfWeek, time: normalizedTime });
    }
  }

  return [...unique.values()].sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) {
      return a.dayOfWeek - b.dayOfWeek;
    }
    return a.time.localeCompare(b.time);
  });
}

function buildScheduleConfig(data: {
  scheduleType: "INTERVAL" | "FIXED_SLOTS" | "WEEKLY_SLOTS";
  useGlobalInterval?: boolean;
  intervalHours?: number;
  slots?: string[];
  weeklySlots?: Array<{ dayOfWeek: number; time: string }>;
  scheduleRandomWindowMinutes?: number;
}): {
  useGlobalInterval?: boolean;
  intervalHours?: number;
  slots?: string[];
  weeklySlots?: Array<{ dayOfWeek: number; time: string }>;
  scheduleRandomWindowMinutes?: number;
} {
  const randomWindow =
    typeof data.scheduleRandomWindowMinutes === "number" &&
    data.scheduleRandomWindowMinutes > 0
      ? { scheduleRandomWindowMinutes: data.scheduleRandomWindowMinutes }
      : {};
  if (data.scheduleType === "INTERVAL") {
    return data.useGlobalInterval
      ? { useGlobalInterval: true, ...randomWindow }
      : { intervalHours: data.intervalHours, ...randomWindow };
  }
  if (data.scheduleType === "WEEKLY_SLOTS") {
    return {
      weeklySlots: normalizeAndDedupeWeeklySlots(data.weeklySlots),
      ...randomWindow,
    };
  }
  return { slots: data.slots!, ...randomWindow };
}

async function handleCreateQueueType(
  userId: string,
  formData: FormData
): Promise<Response> {
  const queueCapCheck = await checkQueueCreationCap(userId);
  if (queueCapCheck) {
    return queueCapCheck;
  }

  const result = validateFormDataOrRespond(formData, createQueueTypeSchema);
  if (!result.success) {
    return result.response;
  }

  const { data } = result;

  const presetCheck = await validateHashtagPreset(userId, data.hashTagPresetId);
  if (presetCheck) {
    return presetCheck;
  }

  const scheduleConfig = buildScheduleConfig(data);

  const created = await updateQueueType(userId, {
    name: data.name,
    scheduleType: data.scheduleType,
    scheduleConfig,
    colorToken: data.colorToken,
    description: data.description,
    hashTagPresetId: data.hashTagPresetId,
    includeHashtagsInNoteBody: data.includeHashtagsInNoteBody,
  });
  await invalidateQueueTypesCache(userId);
  return json({
    success: true,
    queueType: queueTypeToClient(created),
  });
}

async function handleUpdateQueueType(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, updateQueueTypeSchema);
  if (!result.success) {
    return result.response;
  }

  const { data } = result;

  const presetCheck = await validateHashtagPreset(userId, data.hashTagPresetId);
  if (presetCheck) {
    return presetCheck;
  }

  const scheduleConfig = buildScheduleConfig(data);

  const updated = await updateQueueType(userId, {
    id: data.id,
    name: data.name,
    scheduleType: data.scheduleType,
    scheduleConfig,
    colorToken: data.colorToken,
    description: data.description,
    isEnabled: data.isEnabled,
    hashTagPresetId: data.hashTagPresetId,
    includeHashtagsInNoteBody: data.includeHashtagsInNoteBody,
  });
  await invalidateQueueTypesCache(userId);
  return json({
    success: true,
    queueType: queueTypeToClient(updated),
  });
}

async function handleToggleQueueEnabled(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, toggleQueueEnabledSchema);
  if (!result.success) {
    return result.response;
  }
  const { id, isEnabled } = result.data;
  const existing = await getQueueTypeByIdForUser(userId, id);
  if (!existing) {
    return json({ error: "Queue type not found" }, { status: 404 });
  }
  if (isEnabled) {
    const resumed = await resumeQueueById({ userId, queueTypeId: id });
    await invalidateQueueTypesCache(userId);
    return json({
      success: true,
      queueType: queueTypeToClient(resumed.queue),
      resumedCount: resumed.resumedCount,
      needsResignCount: resumed.needsResignCount,
    });
  }

  const paused = await pauseQueueById({ userId, queueTypeId: id });
  await invalidateQueueTypesCache(userId);
  return json({
    success: true,
    queueType: queueTypeToClient(paused.queue),
    pausedPostCount: paused.pausedPostCount,
    pausedLongFormCount: paused.pausedLongFormCount,
  });
}

async function handlePauseQueue(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, queueStatusActionSchema);
  if (!result.success) {
    return result.response;
  }
  const queue = await pauseQueueById({
    userId,
    queueTypeId: result.data.id,
  });
  await invalidateQueueTypesCache(userId);
  return json({
    success: true,
    queueType: queueTypeToClient(queue.queue),
    pausedPostCount: queue.pausedPostCount,
    pausedLongFormCount: queue.pausedLongFormCount,
  });
}

async function handleResumeQueue(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, queueStatusActionSchema);
  if (!result.success) {
    return result.response;
  }
  const queue = await resumeQueueById({
    userId,
    queueTypeId: result.data.id,
  });
  await invalidateQueueTypesCache(userId);
  return json({
    success: true,
    queueType: queueTypeToClient(queue.queue),
    resumedCount: queue.resumedCount,
    needsResignCount: queue.needsResignCount,
  });
}

async function handleDeleteQueueType(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, deleteQueueTypeSchema);
  if (!result.success) {
    return result.response;
  }
  const deletedId = result.data.id;
  const deleteMode = result.data.deleteMode;

  if (deleteMode === "queue_and_scheduled") {
    const queueType = await getQueueTypeByIdForUser(userId, deletedId);
    if (!queueType) {
      return json({ error: "Queue type not found" }, { status: 404 });
    }
    await deleteScheduledContentForQueue(userId, queueType.name);
  }

  await deleteQueueType(userId, deletedId);
  await invalidateQueueTypesCache(userId);
  return json({ success: true, deletedId, deleteMode });
}

async function deleteScheduledContentForQueue(
  userId: string,
  queueTypeName: string
): Promise<void> {
  const pageSize = 100;

  // Keep fetching page 1 to avoid skip/offset issues as rows are deleted.
  for (;;) {
    const { posts } = await getScheduledPosts({
      userId,
      queueType: queueTypeName,
      page: 1,
      limit: pageSize,
    });
    if (posts.length === 0) break;
    await Promise.all(posts.map((post) => deletePost({ id: post.id, userId })));
  }

  // Same approach for longform scheduled content.
  for (;;) {
    const { posts } = await getScheduledLongFormPosts({
      userId,
      queueType: queueTypeName,
      page: 1,
      limit: pageSize,
    });
    if (posts.length === 0) break;
    await Promise.all(
      posts.map((post) => deleteLongFormPost({ id: post.id, userId }))
    );
  }
}

export async function handleQueueTypeAction(
  userId: string,
  action: string,
  formData: FormData
) {
  if (action === "create_queue_type") {
    return handleCreateQueueType(userId, formData);
  }

  if (action === "update_queue_type") {
    return handleUpdateQueueType(userId, formData);
  }

  if (action === "toggle_queue_enabled") {
    return handleToggleQueueEnabled(userId, formData);
  }

  if (action === "pause_queue") {
    return handlePauseQueue(userId, formData);
  }

  if (action === "resume_queue") {
    return handleResumeQueue(userId, formData);
  }

  if (action === "delete_queue_type") {
    return handleDeleteQueueType(userId, formData);
  }

  return null;
}
