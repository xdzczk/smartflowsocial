import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { SearchForm } from "~/features/search/components/SearchForm";
import { SearchResult } from "~/features/search/components/SearchResult";
import { SearchToast } from "~/features/search/components/SearchToast";
import { useSearchState } from "~/features/search/hooks/useSearchState";
import { loadSearchData } from "~/features/search/services/search-loader.server";
import { handleSearchEvent } from "~/features/search/services/search-action.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const data = await loadSearchData(userId);
  return json(data);
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const _action = formData.get("_action");

    if (_action === "searchEvent") {
      const eventInput = formData.get("eventInput") as string;
      const result = await handleSearchEvent(eventInput);
      return json(result);
    }

    const { ValidationError } = await import("~/lib/errors");
    throw new ValidationError("Invalid action", { action: _action });
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

export default function SearchPosts() {
  const { user } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const {
    eventInput,
    toast,
    isSearching,
    searchResult,
    searchStats,
    setEventInput,
    setToast,
    handleSearch,
    handleScheduleQuote,
    handleScheduleRepost,
    clearSearch,
  } = useSearchState({ user, fetcherData: fetcher.data });

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">Search Posts</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Search for any Nostr post by event ID, note1, or nevent1 format
        </p>
      </div>

      <SearchForm
        eventInput={eventInput}
        onInputChange={setEventInput}
        onSubmit={handleSearch}
        isSearching={isSearching}
      />

      {searchResult ? (
        <SearchResult
          result={searchResult}
          stats={searchStats}
          onClear={clearSearch}
          onScheduleQuote={handleScheduleQuote}
          onScheduleRepost={handleScheduleRepost}
        />
      ) : null}

      <SearchToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
