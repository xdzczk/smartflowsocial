/**
 * Queue schedule service
 * Handles queue schedule time calculation for API endpoints
 */

import { json } from "@remix-run/node";

import { getUserTimezone, getQueueTypeByIdForUser } from "~/features/user";
import { NotFoundError, ValidationError } from "~/lib/errors";

import {
  calculateNextScheduleTime,
  formatScheduleTimeForInput,
} from "./schedulers";

/**
 * Calculate next schedule time for a queue type by ID.
 */
export async function calculateQueueScheduleTime(
  userId: string,
  queueTypeId: string
) {
  if (!queueTypeId || queueTypeId === "unassigned") {
    return json({ scheduledTime: "" });
  }

  const userTimezone = await getUserTimezone(userId);
  const selectedQueue = await getQueueTypeByIdForUser(userId, queueTypeId);

  if (!selectedQueue) {
    throw new NotFoundError("Queue type not found", {
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
    userTimezone ?? "UTC"
  );

  return json({ scheduledTime: formattedTime });
}

/**
 * Parse and validate queue schedule request body (queueTypeId required).
 */
export function parseQueueScheduleRequest(body: unknown): {
  queueTypeId: string;
} {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be an object", {
      bodyType: typeof body,
    });
  }

  const requestBody = body as { queueTypeId?: string };
  const queueTypeId =
    typeof requestBody.queueTypeId === "string"
      ? requestBody.queueTypeId.trim()
      : "";

  if (!queueTypeId) {
    throw new ValidationError("queueTypeId is required", { body: requestBody });
  }

  return { queueTypeId };
}
