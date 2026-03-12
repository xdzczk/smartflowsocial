/**
 * Client-side utility functions for queue type operations
 */

const COMPONENT_NAME = "queueTypes.client";
const ACTION_NAME = "calculateQueueScheduleTime";

interface QueueType {
  id: string;
  name: string;
  scheduleType: string;
  color?: string;
}

/**
 * Find a queue type by name and extract its ID
 */
export function findQueueTypeId(
  queueTypes: QueueType[],
  queueTypeName: string
): string | null {
  const selectedQueueType = queueTypes.find(
    (qt) => (typeof qt === "string" ? qt : qt.name) === queueTypeName
  );
  return typeof selectedQueueType === "object" ? selectedQueueType.id : null;
}

/**
 * Calculate the next schedule time for a queue using the ID-based API
 */
export async function calculateQueueScheduleTime(
  queueTypes: QueueType[],
  queueTypeName: string,
  userId?: string
): Promise<string | null> {
  if (queueTypeName === "unassigned") {
    return Promise.resolve(null);
  }

  const queueTypeId = findQueueTypeId(queueTypes, queueTypeName);

  try {
    const response = await fetch("/api/queue-schedule", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queueTypeId,
        userId,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { scheduledTime?: string };
      const scheduledTime = data.scheduledTime;
      return scheduledTime ?? null;
    } else {
      const errorData = (await response.json()) as {
        error?: { message?: string };
        message?: string;
      };
      const { logClientError } = await import("~/lib/error-handler.client");
      logClientError(
        new Error(
          errorData.error?.message ?? errorData.message ?? "Unknown error"
        ),
        {
          component: COMPONENT_NAME,
          action: ACTION_NAME,
        },
        "warning"
      );
      return Promise.resolve(null);
    }
  } catch (error) {
    const { handleErrorSafely } = await import("~/lib/error-handler.client");
    handleErrorSafely(error, {
      component: COMPONENT_NAME,
      action: ACTION_NAME,
    });
    return Promise.resolve(null);
  }
}

/**
 * Fetch effective hashtags for a queue using the ID-based API
 */
export async function fetchEffectiveHashtags(
  queueTypes: QueueType[],
  queueTypeName: string,
  userId?: string
): Promise<string> {
  if (queueTypeName === "unassigned") {
    return Promise.resolve("");
  }

  const queueTypeId = findQueueTypeId(queueTypes, queueTypeName);

  try {
    const response = await fetch("/api/effective-hashtags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queueTypeId,
        queueTypeName, // Keep for backward compatibility
        userId,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        hashtags?: string;
        effectiveHashtags?: string[];
      };
      return data.hashtags ?? data.effectiveHashtags?.join(" ") ?? "";
    } else {
      const { logClientError } = await import("~/lib/error-handler.client");
      logClientError(
        new Error("Hashtags API error"),
        {
          component: COMPONENT_NAME,
          action: "fetchEffectiveHashtags",
        },
        "warning"
      );
      return Promise.resolve("");
    }
  } catch (error) {
    const { handleErrorSafely } = await import("~/lib/error-handler.client");
    handleErrorSafely(error, {
      component: COMPONENT_NAME,
      action: "fetchEffectiveHashtags",
    });
    return Promise.resolve("");
  }
}
