import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  calculateNextScheduleTime,
  formatScheduleTimeForInput,
} from "~/features/posts/schedulers";
import { getQueueTypes, getUserTimezone, getQueueTypeByIdForUser } from "~/models/user.server";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const userId = await requireUserId(request);
    const requestBody = await request.json();

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
      return json({ error: "Queue type not found" }, { status: 404 });
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


    return json({ scheduledTime: formattedTime });
  } catch (error) {
    console.error("Error calculating queue schedule:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
}
