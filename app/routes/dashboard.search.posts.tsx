import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import {
  SearchForm,
  SearchResult,
  SearchToast,
  useSearchState,
  handleSearchAction,
  loadSearchData,
} from "~/features/search";
import { withCSRFProtection } from "~/lib/csrf";
import {
  searchActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import {
  validateSearchResultData,
  validateSearchResultDisplay,
  validateSearchStats,
} from "~/lib/validation/search-result.server";
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const data = await loadSearchData(userId);
  return json(data);
}

export const action = withCSRFProtection(async ({ request }: ActionFunctionArgs) => {
  try {
    const formData = await request.formData();
    
    const result = validateFormDataOrRespond(formData, searchActionSchema);
    if (!result.success) {
      return result.response;
    }

    const validatedData = result.data;
    
    if (validatedData._action === "searchEvent") {
      const searchResult = await handleSearchAction(validatedData.eventInput);
      return json(searchResult);
    }

    const { ValidationError } = await import("~/lib/errors");
    throw new ValidationError("Invalid action", { action: validatedData._action });
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
});

export default function SearchPosts() {
  const { user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const {
    form,
    eventInput: _eventInput,
    toast,
    isSearching,
    searchResult,
    searchStats,
    setToast,
    handleSearch,
    handleScheduleQuote,
    handleScheduleRepost,
    clearSearch,
  } = useSearchState({
    user,
    fetcherData: validateSearchResultData(fetcher.data),
  });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">Search Posts</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Search for any Nostr post by event ID, note1, or nevent1 format
        </p>
      </div>

      <SearchForm
        form={form}
        onSubmit={(e) => { e.preventDefault(); void handleSearch(e); }}
        isSearching={isSearching}
      />

      {searchResult ? (
        <SearchResult
          result={
            validateSearchResultDisplay(searchResult) ?? {
              id: "",
              pubkey: "",
              created_at: 0,
              kind: 0,
              content: "",
              tags: [],
              authorName: "",
              authorImage: null,
              mediaUrls: [],
            }
          }
          stats={validateSearchStats(searchStats) ?? null}
          onClear={clearSearch}
          onScheduleQuote={handleScheduleQuote}
          onScheduleRepost={handleScheduleRepost}
        />
      ) : null}

      <SearchToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
