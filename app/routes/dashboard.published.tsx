import { requireUserId } from "~/features/auth";
import { requireAnySubscription } from "~/features/payments";
import {
  getPublishedDashboardData,
  type LongFormPostType as _LongFormPostType,
} from "~/features/posts/server";
import { PublishedPostsPage } from "~/features/posts/ui";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { publishedPostsLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
// Re-export action from server module
export { publishedPostsAction as action } from "~/features/posts/published.action.server";

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { queueType?: string };
}) {
  try {
    const userId = await requireUserId(request);
    // Require that the user has at least a subscription record
    await requireAnySubscription(userId);

    const url = new URL(request.url);

    const data = await getPublishedDashboardData({ userId, params, url });

    // Validate loader response with Zod schema
    return validateLoaderResponse(data, publishedPostsLoaderDataSchema);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}

type _LoaderData = Awaited<ReturnType<typeof loader>>;

export default PublishedPostsPage;
