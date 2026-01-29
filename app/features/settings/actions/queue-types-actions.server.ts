/**
 * Queue type action handlers
 */

import { json } from "@remix-run/node";

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
import { getUserSubscription } from "~/models/payment.server";

// ============================================================================
// Helper Functions
// ============================================================================

/** Serialize a queue type for the client (create/update response) */
function queueTypeToClient(qt: Awaited<ReturnType<typeof updateQueueType>>): {
  id: string;
  name: string;
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
} {
  const preset = "hashTagPreset" in qt && qt.hashTagPreset;
  return {
    id: qt.id,
    name: qt.name,
    color: qt.color,
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

function buildScheduleConfig(data: {
  scheduleType: "INTERVAL" | "FIXED_SLOTS" | "WEEKLY_SLOTS";
  useGlobalInterval?: boolean;
  intervalHours?: number;
  slots?: string[];
  weeklySlots?: Array<{ dayOfWeek: number; time: string }>;
}): {
  useGlobalInterval?: boolean;
  intervalHours?: number;
  slots?: string[];
  weeklySlots?: Array<{ dayOfWeek: number; time: string }>;
} {
  if (data.scheduleType === "INTERVAL") {
    return data.useGlobalInterval
      ? { useGlobalInterval: true }
      : { intervalHours: data.intervalHours };
  }
  if (data.scheduleType === "WEEKLY_SLOTS") {
    return { weeklySlots: data.weeklySlots! };
  }
  return { slots: data.slots! };
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
    color: data.color,
    description: data.description,
    hashTagPresetId: data.hashTagPresetId,
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
    color: data.color,
    description: data.description,
    isEnabled: data.isEnabled,
    hashTagPresetId: data.hashTagPresetId,
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
