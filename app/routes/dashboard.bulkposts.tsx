import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { requireFeatureAccess } from "~/features/payments";
import { getBulkPostsDashboardData } from "~/features/posts/server";
import { BulkPostsPage } from "~/features/posts/ui";

export { bulkPostsAction as action } from "~/features/posts/bulkposts.action.server";

export async function loader({ request }: { request: Request }) {
  try {
    const userId = await requireUserId(request);

    // Check if user has access to bulk scheduling feature
    await requireFeatureAccess(userId, "bulkScheduling");
    const url = new URL(request.url);
    const groupId = url.searchParams.get("groupId");
    const data = await getBulkPostsDashboardData(
      userId,
      groupId && groupId.length > 0 ? groupId : null
    );

    return json(data);
  } catch (error) {
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {
      tags: [],
      queueTypes: [],
      hashTagPresets: [],
      mode: null,
    });
  }
}
export default BulkPostsPage;
