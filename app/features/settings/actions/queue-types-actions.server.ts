/**
 * Queue type action handlers
 */

import { json } from "@remix-run/node";

import { getUserSubscription } from "~/features/payments/data";
import { getQueueColorBundle } from "~/features/posts/queue-colors";
import {
  deleteQueueType,
  hashTagPresetExistsForUser,
  updateQueueType,
} from "~/features/user";
import { invalidateQueueTypesCache } from "~/features/user/services/user-cache.server";
import {
  createQueueTypeSchema,
  updateQueueTypeSchema,
  deleteQueueTypeSchema,
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

async function checkFreePlanRestriction(
  userId: string
): Promise<Response | null> {
  const subscription = await getUserSubscription(userId);
  if (subscription?.Plan && Number(subscription.Plan.price) === 0) {
    return json(
      {
        error:
          "Creating queue types is not available on the free plan. Please upgrade your subscription.",
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
  const freePlanCheck = await checkFreePlanRestriction(userId);
  if (freePlanCheck) {
    return freePlanCheck;
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

async function handleDeleteQueueType(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, deleteQueueTypeSchema);
  if (!result.success) {
    return result.response;
  }
  const deletedId = result.data.id;
  await deleteQueueType(userId, deletedId);
  await invalidateQueueTypesCache(userId);
  return json({ success: true, deletedId });
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

  if (action === "delete_queue_type") {
    return handleDeleteQueueType(userId, formData);
  }

  return null;
}
