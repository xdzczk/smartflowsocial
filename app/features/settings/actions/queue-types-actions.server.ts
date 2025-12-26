/**
 * Queue type action handlers
 */

import { json } from "@remix-run/node";
import { getUserSubscription } from "~/models/payment.server";
import {
  updateQueueType,
  deleteQueueType,
  hashTagPresetExistsForUser,
} from "~/models/user.server";

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

    const name = formData.get("name") as string;
    const scheduleType = formData.get("scheduleType") as
      | "INTERVAL"
      | "FIXED_SLOTS";
    const color = formData.get("color") as string;
    const description = formData.get("description") as string;
    const hashTagPresetId = formData.get("hashTagPresetId") as string;
    const processedHashTagPresetId =
      hashTagPresetId === "none" || !hashTagPresetId ? null : hashTagPresetId;

    // Validate hashtag preset exists if provided
    if (processedHashTagPresetId) {
      const presetExists = await hashTagPresetExistsForUser(userId, processedHashTagPresetId);
      if (!presetExists) {
        return json(
          { error: "Selected hashtag preset does not exist" },
          { status: 400 },
        );
      }
    }

    let scheduleConfig = {};
    if (scheduleType === "INTERVAL") {
      const intervalHours = parseInt(
        formData.get("intervalHours") as string,
        10,
      );
      const useGlobalInterval = formData.get("useGlobalInterval") === "on";
      scheduleConfig = useGlobalInterval
        ? { useGlobalInterval: true }
        : { intervalHours };
    } else if (scheduleType === "FIXED_SLOTS") {
      const slots = (formData.get("slots") as string)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      scheduleConfig = { slots };
    }

    await updateQueueType(userId, {
      name,
      scheduleType,
      scheduleConfig,
      color,
      description,
      hashTagPresetId: processedHashTagPresetId,
    });
    return json({ success: true });
  }

  if (action === "update_queue_type") {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const scheduleType = formData.get("scheduleType") as
      | "INTERVAL"
      | "FIXED_SLOTS";
    const color = formData.get("color") as string;
    const description = formData.get("description") as string;
    const isEnabled = formData.get("isEnabled") === "on";
    const hashTagPresetId = formData.get("hashTagPresetId") as string;
    const processedHashTagPresetId =
      hashTagPresetId === "none" || !hashTagPresetId ? null : hashTagPresetId;

    // Validate hashtag preset exists if provided
    if (processedHashTagPresetId) {
      const presetExists = await hashTagPresetExistsForUser(userId, processedHashTagPresetId);
      if (!presetExists) {
        return json(
          { error: "Selected hashtag preset does not exist" },
          { status: 400 },
        );
      }
    }

    let scheduleConfig = {};
    if (scheduleType === "INTERVAL") {
      const intervalHours = parseInt(
        formData.get("intervalHours") as string,
        10,
      );
      const useGlobalInterval = formData.get("useGlobalInterval") === "on";
      scheduleConfig = useGlobalInterval
        ? { useGlobalInterval: true }
        : { intervalHours };
    } else if (scheduleType === "FIXED_SLOTS") {
      const slots = (formData.get("slots") as string)
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s);
      scheduleConfig = { slots };
    }

    await updateQueueType(userId, {
      id,
      name,
      scheduleType,
      scheduleConfig,
      color,
      description,
      isEnabled,
      hashTagPresetId: processedHashTagPresetId,
    });
    return json({ success: true });
  }

  if (action === "delete_queue_type") {
    const id = formData.get("id") as string;
    await deleteQueueType(userId, id);
    return json({ success: true });
  }

  return null;
}




