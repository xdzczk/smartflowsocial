/**
 * Queue schedule service
 * Handles queue schedule time calculation for API endpoints
 */

import { json } from "@remix-run/node";

import { createSuccessResponse } from "~/lib/error-handler.server";
import { NotFoundError, ValidationError } from "~/lib/errors";
import {
  getQueueTypes,
  getUserTimezone,
  getQueueTypeByIdForUser,
} from "~/models/user.server";

import {
  calculateNextScheduleTime,
  formatScheduleTimeForInput,
} from "../schedulers";

/**
 * Calculate next schedule time for a queue type
 * Supports both queueTypeName (legacy) and queueTypeId (preferred)
 */
export async function calculateQueueScheduleTime(
  userId: string,
  queueTypeName?: string,
  queueTypeId?: string,
) {
  if ((!queueTypeName && !queueTypeId) || queueTypeName === "unassigned") {
    return json({ scheduledTime: "" });
  }

  // Get user timezone
  const userTimezone = await getUserTimezone(userId);

  let selectedQueue;

  if (queueTypeId) {
    // Use queue type ID for direct lookup (preferred method)
    selectedQueue = await getQueueTypeByIdForUser(userId, queueTypeId);
  } else if (queueTypeName) {
    // Fallback to name-based lookup for backward compatibility
    const queueTypes = await getQueueTypes(userId);
    selectedQueue = queueTypes.find((qt) => qt.name === queueTypeName);
  }

  if (!selectedQueue) {
    throw new NotFoundError("Queue type not found", {
      queueTypeName,
      queueTypeId,
      userId,
    });
  }

  // Calculate next schedule time with user timezone
  const nextScheduleTime = await calculateNextScheduleTime({
    queueType: selectedQueue,
    userId,
    userTimezone: userTimezone ?? "UTC",
  });

  // Format for datetime-local input in user's timezone
  const formattedTime = formatScheduleTimeForInput(
    nextScheduleTime,
    userTimezone ?? "UTC",
  );

  return createSuccessResponse({ scheduledTime: formattedTime });
}

/**
 * Parse and validate queue schedule request body
 */
export function parseQueueScheduleRequest(body: unknown): {
  queueTypeName?: string;
  queueTypeId?: string;
} {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be an object", {
      bodyType: typeof body,
    });
  }

  const requestBody = body as { queueTypeName?: string; queueTypeId?: string };

  return {
    queueTypeName: requestBody.queueTypeName,
    queueTypeId: requestBody.queueTypeId,
  };
}

