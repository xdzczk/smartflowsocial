/**
 * Queue type action handlers
 */

import { json } from "@remix-run/node";

import {
  createQueueTypeSchema,
  updateQueueTypeSchema,
  deleteQueueTypeSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { getUserSubscription } from "~/models/payment.server";
import {
  deleteQueueType,
  hashTagPresetExistsForUser,
  updateQueueType,
} from "~/features/user";

export async function handleQueueTypeAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "create_queue_type") {
    // Check if user has a free subscription
    const subscription = await getUserSubscription(userId);
    if (subscription?.Plan && Number(subscription.Plan.price) === 0) {
      return json(
        {
          error:
            "Creating queue types is not available on the free plan. Please upgrade your subscription.",
        },
        { status: 403 },
      );
    }

    const result = validateFormDataOrRespond(formData, createQueueTypeSchema);
    if (!result.success) {
      return result.response;
    }

    const { data } = result;

    // Validate hashtag preset exists if provided
    if (data.hashTagPresetId) {
      const presetExists = await hashTagPresetExistsForUser(
        userId,
        data.hashTagPresetId,
      );
      if (!presetExists) {
        return json(
          { error: "Selected hashtag preset does not exist" },
          { status: 400 },
        );
      }
    }

    // Build schedule config based on schedule type
    let scheduleConfig: { useGlobalInterval?: boolean; intervalHours?: number; slots?: string[] } = {};
    if (data.scheduleType === "INTERVAL") {
      scheduleConfig = data.useGlobalInterval
        ? { useGlobalInterval: true }
        : { intervalHours: data.intervalHours };
    } else if (data.scheduleType === "FIXED_SLOTS") {
      scheduleConfig = { slots: data.slots };
    }

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

  if (action === "update_queue_type") {
    const result = validateFormDataOrRespond(formData, updateQueueTypeSchema);
    if (!result.success) {
      return result.response;
    }

    const { data } = result;

    // Validate hashtag preset exists if provided
    if (data.hashTagPresetId) {
      const presetExists = await hashTagPresetExistsForUser(
        userId,
        data.hashTagPresetId,
      );
      if (!presetExists) {
        return json(
          { error: "Selected hashtag preset does not exist" },
          { status: 400 },
        );
      }
    }

    // Build schedule config based on schedule type
    let scheduleConfig: { useGlobalInterval?: boolean; intervalHours?: number; slots?: string[] } = {};
    if (data.scheduleType === "INTERVAL") {
      scheduleConfig = data.useGlobalInterval
        ? { useGlobalInterval: true }
        : { intervalHours: data.intervalHours };
    } else if (data.scheduleType === "FIXED_SLOTS") {
      scheduleConfig = { slots: data.slots };
    }

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

  if (action === "delete_queue_type") {
    const result = validateFormDataOrRespond(formData, deleteQueueTypeSchema);
    if (!result.success) {
      return result.response;
    }
    await deleteQueueType(userId, result.data.id);
    return json({ success: true });
  }

  return null;
}
