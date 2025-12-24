/**
 * Client-side utility functions for queue type operations
 */

interface QueueType {
  id: string;
  name: string;
  scheduleType: string;
  color?: string;
}

/**
 * Find a queue type by name and extract its ID
 */
export function findQueueTypeId(queueTypes: QueueType[], queueTypeName: string): string | null {
  const selectedQueueType = queueTypes.find(qt => 
    (typeof qt === "string" ? qt : qt.name) === queueTypeName
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
    return null;
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
        queueTypeName, // Keep for backward compatibility
        userId,
      }),
    });

    if (response.ok) {
      const { scheduledTime } = await response.json();
      return scheduledTime;
    } else {
      const errorData = await response.json();
      console.error(`[queueTypes.client] API error:`, errorData?.error || 'Unknown error');
      return null;
    }
  } catch (error) {
    console.error("Error calculating schedule time:", error);
    return null;
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
    return "";
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
      const data = await response.json();
      return data.hashtags || "";
    } else {
      console.error(`[queueTypes.client] Hashtags API error`);
      return "";
    }
  } catch (error) {
    console.error("Error fetching effective hashtags:", error);
    return "";
  }
}