/**
 * Queue type action handlers
 */

import { json } from "@remix-run/node";

import {
  deleteQueueType,
  hashTagPresetExistsForUser,
  updateQueueType,
} from "~/features/user";
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
  scheduleType: "INTERVAL" | "FIXED_SLOTS";
  useGlobalInterval?: boolean;
  intervalHours?: number;
  slots?: string[];
}): {
  useGlobalInterval?: boolean;
  intervalHours?: number;
  slots?: string[];
} {
  if (data.scheduleType === "INTERVAL") {
    return data.useGlobalInterval
      ? { useGlobalInterval: true }
      : { intervalHours: data.intervalHours };
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

  await updateQueueType(userId, {
    name: data.name,
    scheduleType: data.scheduleType,
    scheduleConfig,
    color: data.color,
    description: data.description,
    hashTagPresetId: data.hashTagPresetId,
  });
  return json({ success: true });
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

  await updateQueueType(userId, {
    id: data.id,
    name: data.name,
    scheduleType: data.scheduleType,
    scheduleConfig,
    color: data.color,
    description: data.description,
    isEnabled: data.isEnabled,
    hashTagPresetId: data.hashTagPresetId,
  });
  return json({ success: true });
}

async function handleDeleteQueueType(
  userId: string,
  formData: FormData
): Promise<Response> {
  const result = validateFormDataOrRespond(formData, deleteQueueTypeSchema);
  if (!result.success) {
    return result.response;
  }
  await deleteQueueType(userId, result.data.id);
  return json({ success: true });
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
