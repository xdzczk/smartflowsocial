import {
  defer,
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  SearchPostsPage,
  handleSearchAction,
  loadSearchData,
  serializeLookupLoaderError,
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

  const searchResultPromise = (async () => {
    try {
      const searchResult = await handleSearchAction(q);
      return {
        event: searchResult.event,
        stats: searchResult.stats,
        replies: searchResult.replies,
      };
    } catch (error: unknown) {
      return {
        error: serializeLookupLoaderError(error),
      };
    }
  })();

  return defer({
    ...data,
    searchResultPromise,
  });
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
