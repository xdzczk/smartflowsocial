/**
 * Queue schedule service
 * Handles queue schedule time calculation for API endpoints
 */

import { json } from "@remix-run/node";

import {
  getUserTimezone,
  getQueueTypeByIdForUser,
  getQueueTypeByNameForUser,
} from "~/features/user";
import { NotFoundError, ValidationError } from "~/lib/errors";

import {
  calculateNextScheduleTime,
  formatScheduleTimeForInput,
} from "./schedulers";

export interface ParsedQueueScheduleRequest {
  queueTypeId?: string;
  queueTypeName?: string;
}

async function resolveQueueTypeIdForSchedule(
  userId: string,
  input: ParsedQueueScheduleRequest
): Promise<string | null> {
  const idTrim = input.queueTypeId?.trim() ?? "";
  if (idTrim === "unassigned") {
    return null;
  }
  if (idTrim.length > 0) {
    return idTrim;
  }
  const nameTrim = input.queueTypeName?.trim() ?? "";
  if (!nameTrim) {
    return null;
  }
  const found = await getQueueTypeByNameForUser(userId, nameTrim);
  return found?.id ?? null;
}

/**
 * Calculate next schedule time for a queue type (by id and/or name).
 */
export async function calculateQueueScheduleTime(
  userId: string,
  input: ParsedQueueScheduleRequest
) {
  const queueTypeId = await resolveQueueTypeIdForSchedule(userId, input);

  if (!queueTypeId) {
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
 * Parse and validate queue schedule request body (queueTypeId and/or queueTypeName).
 */
export function parseQueueScheduleRequest(
  body: unknown
): ParsedQueueScheduleRequest {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be an object", {
      bodyType: typeof body,
    });
  }

  const requestBody = body as { queueTypeId?: string; queueTypeName?: string };
  const queueTypeId =
    typeof requestBody.queueTypeId === "string"
      ? requestBody.queueTypeId.trim()
      : "";
  const queueTypeName =
    typeof requestBody.queueTypeName === "string"
      ? requestBody.queueTypeName.trim()
      : "";

  if (!queueTypeId && !queueTypeName) {
    throw new ValidationError("queueTypeId or queueTypeName is required", {
      body: requestBody,
    });
  }

  const result: ParsedQueueScheduleRequest = {};
  if (queueTypeId) result.queueTypeId = queueTypeId;
  if (queueTypeName) result.queueTypeName = queueTypeName;
  return result;
}
