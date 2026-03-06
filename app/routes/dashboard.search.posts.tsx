import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  SearchPostsPage,
  handleSearchAction,
  loadSearchData,
} from "~/features/search";
import { withCSRFProtection } from "~/lib/csrf";
import {
  searchActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const data = await loadSearchData(userId);
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();

  if (!q) {
    return json(data);
  }

  try {
    const searchResult = await handleSearchAction(q);
    return json({
      ...data,
      searchResult: {
        event: searchResult.event,
        stats: searchResult.stats,
      },
    });
  } catch (error) {
    return json({
      ...data,
      searchResult: {
        error: error instanceof Error ? error.message : "Failed to load post",
      },
    });
  }
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const formData = await request.formData();

      const result = validateFormDataOrRespond(formData, searchActionSchema);
      if (!result.success) {
        return result.response;
      }

      const validatedData = result.data;

      // TypeScript guarantees this is "searchEvent" (only option in discriminated union)
      const searchResult = await handleSearchAction(validatedData.eventInput);
      return json(searchResult);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default SearchPostsPage;
