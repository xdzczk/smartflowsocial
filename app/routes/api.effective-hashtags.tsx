import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import { getQueueTypes } from "~/models/user.server";

// Returns effective hashtags for a queue type
// This will return the hashtag preset assigned to the queue type, or empty if none assigned
export async function action({ request }: { request: Request }) {
  try {
    const userId = await requireUserId(request);
    const requestBody = await request.json();
    const { queueTypeName, queueTypeId } = requestBody;

    if ((!queueTypeName && !queueTypeId) || queueTypeName === "unassigned") {
      return json({ hashtags: "" });
    }

    // Get all queue types for the user
    const queueTypes = await getQueueTypes(userId);

    // Find the specified queue type - prefer ID over name
    let queueType;
    if (queueTypeId) {
      queueType = queueTypes.find((qt) => qt.id === queueTypeId);
    } else {
      queueType = queueTypes.find((qt) => qt.name === queueTypeName);
    }

    if (!queueType || !queueType.hashTagPreset) {
      return json({ hashtags: "" });
    }

    // Return the hashtag preset tags assigned to this queue type
    return json({ hashtags: queueType.hashTagPreset.tags || "" });
  } catch (error) {
    console.error("Error in effective hashtags API:", error);
    return json({ error: "Failed to get effective hashtags" }, { status: 400 });
  }
}
