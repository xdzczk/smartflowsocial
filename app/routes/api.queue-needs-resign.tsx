import { json, type LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import { loadNeedsResignItemsForQueue } from "~/features/posts/data/queue-needs-resign.server";
import { handleActionError } from "~/lib/error-handler.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    await requireAnySubscription(userId);
    const url = new URL(request.url);
    const queueTypeId = url.searchParams.get("queueTypeId");
    if (!queueTypeId || queueTypeId.length === 0) {
      return json({ error: "queueTypeId is required" }, { status: 400 });
    }
    const result = await loadNeedsResignItemsForQueue(userId, queueTypeId);
    if ("error" in result) {
      return json({ error: result.error }, { status: result.status });
    }
    return json(result);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    return handleActionError(error);
  }
}
