import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  calculateNextScheduleTime,
  formatScheduleTimeForInput,
} from "~/features/posts/schedulers";
import {
  getQueueTypes,
  getUserTimezone,
  getQueueTypeByIdForUser,
} from "~/models/user.server";
import { NotFoundError, ValidationError } from "~/lib/errors";
import {
  withActionErrorHandling,
  createSuccessResponse,
  assert,
} from "~/lib/error-handler.server";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    assert(request.method === "POST", "Method not allowed", {
      method: request.method,
    });

    const userId = await requireUserId(request);

    let requestBody: { queueTypeName?: string; queueTypeId?: string };
    try {
      requestBody = await request.json();
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    // Support both old format (queueTypeName) and new format (queueTypeId)
    const { queueTypeName, queueTypeId } = requestBody;

    if ((!queueTypeName && !queueTypeId) || queueTypeName === "unassigned") {
      return json({ scheduledTime: "" });
    }

    // Get user timezone
    const userTimezone = await getUserTimezone(userId);

    let selectedQueue;

    if (queueTypeId) {
      // Use queue type ID for direct lookup (preferred method)
      selectedQueue = await getQueueTypeByIdForUser(userId, queueTypeId);
    } else {
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
      userTimezone: userTimezone || "UTC",
    });

    // Format for datetime-local input in user's timezone
    const formattedTime = formatScheduleTimeForInput(
      nextScheduleTime,
      userTimezone || "UTC",
    );

    return createSuccessResponse({ scheduledTime: formattedTime });
  },
);
